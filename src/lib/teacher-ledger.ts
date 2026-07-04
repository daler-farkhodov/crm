import { Prisma, SalaryType, TeacherLedgerType } from "@prisma/client";
import { type ClosureRecord, countScheduledSessionsInMonth } from "@/lib/billing-cycle";

type PrismaTx = Prisma.TransactionClient;

/**
 * Posts per-session ACCRUAL rows to TeacherLedger for the teacher(s)
 * responsible for a chargeable session (role TEACHER on the class).
 * Redirects a teacher's accrual to their substitute when a
 * ClassTeacherOverride exists for that class/date/original-teacher pair.
 * Assistant pay is handled separately by postAssistantAccrual, driven by
 * AssistantAttendance rather than student attendance.
 */
export async function postTeacherAccrual(
  tx: PrismaTx,
  params: {
    classId: string;
    date: Date;
    attendanceId: string;
    rate: number;
    scheduleDays: string[];
    closures: ClosureRecord[];
  },
) {
  const { classId, date, attendanceId, rate, scheduleDays, closures } = params;
  const sessionsInMonth = countScheduledSessionsInMonth(scheduleDays, date, closures);
  if (sessionsInMonth < 1) return;
  const sessionValue = rate / sessionsInMonth;

  const teacherRows = await tx.classTeacher.findMany({
    where: { classId, role: "TEACHER" },
  });
  if (teacherRows.length === 0) return;

  const overrides = await tx.classTeacherOverride.findMany({
    where: { classId, date, originalTeacherId: { in: teacherRows.map((t) => t.teacherId) } },
  });
  const overrideByOriginal = new Map(overrides.map((o) => [o.originalTeacherId, o.substituteTeacherId]));

  for (const ct of teacherRows) {
    const amount =
      ct.salaryType === SalaryType.FIXED
        ? (ct.fixedAmount ?? 0) / sessionsInMonth
        : (ct.percentage / 100) * sessionValue;
    if (!amount) continue;
    const payTeacherId = overrideByOriginal.get(ct.teacherId) ?? ct.teacherId;
    await tx.teacherLedger.create({
      data: {
        teacherId: payTeacherId,
        classId,
        date,
        type: TeacherLedgerType.ACCRUAL,
        amount,
        referenceId: attendanceId,
      },
    });
  }
}

/**
 * Reverses every ACCRUAL row tied to an attendance row by posting negated
 * counter-entries (keeps ledger history instead of deleting it).
 */
export async function reverseTeacherAccrual(tx: PrismaTx, attendanceId: string) {
  const rows = await tx.teacherLedger.findMany({
    where: { referenceId: attendanceId, type: TeacherLedgerType.ACCRUAL },
  });
  for (const row of rows) {
    await tx.teacherLedger.create({
      data: {
        teacherId: row.teacherId,
        classId: row.classId,
        date: row.date,
        type: TeacherLedgerType.ACCRUAL,
        amount: -row.amount,
        referenceId: attendanceId,
      },
    });
  }
}

/**
 * Posts a single ACCRUAL row for an assistant marked present for a session.
 * No AssistantAttendance row (or present: false) means no accrual — an
 * unmarked session defaults to absent/unpaid.
 */
export async function postAssistantAccrual(
  tx: PrismaTx,
  params: {
    teacherId: string;
    classId: string;
    date: Date;
    fixedAmount: number;
    scheduleDays: string[];
    closures: ClosureRecord[];
    referenceId: string;
  },
) {
  const { teacherId, classId, date, fixedAmount, scheduleDays, closures, referenceId } = params;
  const sessionsInMonth = countScheduledSessionsInMonth(scheduleDays, date, closures);
  if (sessionsInMonth < 1) return;
  const amount = fixedAmount / sessionsInMonth;
  if (!amount) return;
  await tx.teacherLedger.create({
    data: {
      teacherId,
      classId,
      date,
      type: TeacherLedgerType.ACCRUAL,
      amount,
      referenceId,
    },
  });
}

/** Reverses ACCRUAL row(s) tied to an AssistantAttendance-driven reference. */
export async function reverseAssistantAccrual(tx: PrismaTx, referenceId: string) {
  const rows = await tx.teacherLedger.findMany({
    where: { referenceId, type: TeacherLedgerType.ACCRUAL },
  });
  for (const row of rows) {
    await tx.teacherLedger.create({
      data: {
        teacherId: row.teacherId,
        classId: row.classId,
        date: row.date,
        type: TeacherLedgerType.ACCRUAL,
        amount: -row.amount,
        referenceId,
      },
    });
  }
}
