"use server";

import { AttendanceStatus, LedgerType, Prisma } from "@prisma/client";
import { endOfMonth, parseISO, startOfDay, startOfMonth, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { countScheduledSessionsInMonth, perClassCreditAmount } from "@/lib/billing-cycle";
import {
  LEDGER_REF_ATTENDANCE_DEBIT,
  LEDGER_REF_ATTENDANCE_SERIOUS_CREDIT,
} from "@/lib/ledger-constants";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";
import { postAssistantAccrual, postTeacherAccrual, reverseAssistantAccrual, reverseTeacherAccrual } from "@/lib/teacher-ledger";

type PrismaTx = Prisma.TransactionClient;

const statuses = new Set(Object.values(AttendanceStatus));

/**
 * Posts the per-session DEBIT for a chargeable attendance row (PRESENT,
 * ABSENT_NON_SERIOUS, or a paid-closure SCHOOL_CLOSED/CLASS_CANCELED row) and
 * the matching teacher ACCRUAL. No-op if the enrollment no longer exists.
 * Free enrollments skip the student debit but still accrue teacher pay,
 * valued at the class's normal price (virtual income).
 */
async function postAttendanceDebit(
  tx: PrismaTx,
  params: {
    studentId: string;
    classId: string;
    attendanceId: string;
    attDate: Date;
    cls: { pricePerMonth: number; scheduleDays: string[] };
  },
) {
  const { studentId, classId, attendanceId, attDate, cls } = params;
  const sc = await tx.studentClass.findFirst({
    where: { studentId, classId, endDate: null },
    select: { customRate: true, isFree: true },
  });
  if (!sc) return;

  const closures = await tx.schoolClosure.findMany({
    where: {
      date: { gte: startOfMonth(attDate), lte: endOfMonth(attDate) },
      OR: [{ classId }, { classId: null }],
    },
    select: { date: true, isPaid: true },
  });
  const sessionsInMonth = countScheduledSessionsInMonth(cls.scheduleDays, attDate, closures);

  if (!sc.isFree) {
    const rate = sc.customRate ?? cls.pricePerMonth;
    const debit = perClassCreditAmount(rate, sessionsInMonth);
    if (debit > 0) {
      await tx.ledger.create({
        data: {
          studentId,
          type: LedgerType.DEBIT,
          amount: -debit,
          referenceId: attendanceId,
          referenceType: LEDGER_REF_ATTENDANCE_DEBIT,
        },
      });
    }
  }

  const teacherRate = sc.isFree ? cls.pricePerMonth : (sc.customRate ?? cls.pricePerMonth);
  await postTeacherAccrual(tx, {
    classId,
    date: attDate,
    attendanceId,
    rate: teacherRate,
    scheduleDays: cls.scheduleDays,
    closures,
  });
}

export async function createAttendance(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const classId = String(formData.get("classId") || "");
  const teacherIdRaw = String(formData.get("teacherId") || "");
  const date = String(formData.get("date") || "");
  const status = String(formData.get("status") || "");
  const isTrial = String(formData.get("isTrial") || "") === "on";
  if (!studentId || !classId || !date || !statuses.has(status as AttendanceStatus))
    return;
  const actor = await getActorUserId();

  const row = await prisma.$transaction(async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: { pricePerMonth: true, scheduleDays: true },
    });
    if (!cls) return null;

    // Use the same local-midnight parsing as cancelClass/setAssistantAttendance
    // (startOfDay(parseISO(...))) instead of `new Date(date)` (which parses a
    // date-only string as UTC midnight). Mixing the two meant Attendance.date
    // and the SchoolClosure/ClassTeacherOverride rows it's matched against by
    // exact equality would silently disagree by the server's UTC offset on
    // any non-UTC deployment — breaking paid-closure detection and teacher
    // substitution redirects.
    const attDate = startOfDay(parseISO(date));

    const att = await tx.attendance.create({
      data: {
        studentId,
        classId,
        teacherId: teacherIdRaw || null,
        date: attDate,
        status: status as AttendanceStatus,
        isTrial,
      },
    });

    // Chargeable statuses: PRESENT, ABSENT_NON_SERIOUS always charge.
    // SCHOOL_CLOSED / CLASS_CANCELED only charge when the closure covering
    // that class/date is marked paid. ABSENT_SERIOUS and TRIAL never charge.
    let chargeable =
      status === AttendanceStatus.PRESENT || status === AttendanceStatus.ABSENT_NON_SERIOUS;
    if (status === AttendanceStatus.SCHOOL_CLOSED || status === AttendanceStatus.CLASS_CANCELED) {
      const closure = await tx.schoolClosure.findFirst({
        where: { date: attDate, OR: [{ classId }, { classId: null }] },
        select: { isPaid: true },
      });
      chargeable = closure?.isPaid === true;
    }

    if (!isTrial && chargeable) {
      await postAttendanceDebit(tx, {
        studentId,
        classId,
        attendanceId: att.id,
        attDate,
        cls,
      });
    }

    return att;
  });

  if (!row) return;
  await writeAudit(actor, "CREATE", "Attendance", row.id);
  revalidatePath("/attendance");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/ledger");
  revalidatePath("/invoices");
}

export async function deleteAttendance(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();

  const existing = await prisma.attendance.findUnique({
    where: { id },
    select: { studentId: true },
  });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    // Remove any ledger entry tied to this attendance (debit for PRESENT,
    // or legacy serious-absence credit if created before the model change).
    await tx.ledger.deleteMany({
      where: {
        referenceId: id,
        referenceType: { in: [LEDGER_REF_ATTENDANCE_DEBIT, LEDGER_REF_ATTENDANCE_SERIOUS_CREDIT] },
      },
    });
    await reverseTeacherAccrual(tx, id);
    await tx.attendance.delete({ where: { id } });
  });

  await writeAudit(actor, "DELETE", "Attendance", id);
  revalidatePath("/attendance");
  revalidatePath("/students");
  revalidatePath(`/students/${existing.studentId}`);
  revalidatePath("/ledger");
  revalidatePath("/invoices");
}

export async function cancelClass(formData: FormData) {
  const datesJson = formData.get("dates") as string;
  const classIdsJson = formData.get("classIds") as string;
  const allClasses = formData.get("allClasses") === "true";
  const reasonType = formData.get("reasonType") as string;
  const customReason = (formData.get("customReason") as string) || "";
  const isPaid = formData.get("isPaid") === "true";

  const dates: string[] = JSON.parse(datesJson || "[]");
  const classIds: string[] = JSON.parse(classIdsJson || "[]");

  const reasonText =
    reasonType === "other"
      ? customReason.slice(0, 200)
      : reasonType === "teacher_absent"
        ? "Teacher absent"
        : "School closed";

  if (dates.length === 0) return;
  const actor = await getActorUserId();

  for (const dateStr of dates) {
    const date = startOfDay(parseISO(dateStr));
    const dayCode = format(date, "EEE").toUpperCase().slice(0, 3);

    if (allClasses) {
      // Global closure — affects all classes scheduled that day
      const existingGlobal = await prisma.schoolClosure.findFirst({
        where: { date, classId: null },
      });
      if (!existingGlobal) {
        await prisma.schoolClosure.create({
          data: { date, classId: null, reason: reasonText, isPaid },
        });
      }

      const scheduledClasses = await prisma.class.findMany({
        where: { scheduleDays: { has: dayCode } },
        include: {
          students: {
            where: { OR: [{ endDate: null }, { endDate: { gte: date } }] },
          },
        },
      });

      for (const cls of scheduledClasses) {
        for (const sc of cls.students) {
          const exists = await prisma.attendance.findFirst({
            where: { studentId: sc.studentId, classId: cls.id, date },
          });
          if (!exists) {
            const att = await prisma.attendance.create({
              data: {
                studentId: sc.studentId,
                classId: cls.id,
                date,
                status: AttendanceStatus.SCHOOL_CLOSED,
                isTrial: false,
              },
            });
            if (isPaid) {
              await postAttendanceDebit(prisma, {
                studentId: sc.studentId,
                classId: cls.id,
                attendanceId: att.id,
                attDate: date,
                cls,
              });
            }
          }
        }
      }
    } else {
      for (const classId of classIds) {
        const existing = await prisma.schoolClosure.findFirst({
          where: { date, classId },
        });
        if (!existing) {
          await prisma.schoolClosure.create({
            data: { date, classId, reason: reasonText, isPaid },
          });
        }

        const cls = await prisma.class.findUnique({
          where: { id: classId },
          select: { pricePerMonth: true, scheduleDays: true },
        });
        if (!cls) continue;

        const studentClasses = await prisma.studentClass.findMany({
          where: { classId, OR: [{ endDate: null }, { endDate: { gte: date } }] },
        });

        for (const sc of studentClasses) {
          const exists = await prisma.attendance.findFirst({
            where: { studentId: sc.studentId, classId, date },
          });
          if (!exists) {
            const att = await prisma.attendance.create({
              data: {
                studentId: sc.studentId,
                classId,
                date,
                status: AttendanceStatus.CLASS_CANCELED,
                isTrial: false,
              },
            });
            if (isPaid) {
              await postAttendanceDebit(prisma, {
                studentId: sc.studentId,
                classId,
                attendanceId: att.id,
                attDate: date,
                cls,
              });
            }
          }
        }
      }
    }
  }

  await writeAudit(actor, "CREATE", "SchoolClosure", "bulk");
  revalidatePath("/attendance");
  revalidatePath("/accounting");
  revalidatePath("/students");
  revalidatePath("/ledger");
  revalidatePath("/invoices");
}

/**
 * Toggles an assistant's presence for one session. present="true" creates
 * the AssistantAttendance row and accrues their fixed pay for that session;
 * present="false" (or re-toggling) removes any existing row and reverses
 * its accrual. An unmarked session has no row at all — it defaults to
 * absent/unpaid rather than defaulting a written row to true.
 */
export async function setAssistantAttendance(formData: FormData) {
  const classTeacherId = String(formData.get("classTeacherId") || "");
  const dateRaw = String(formData.get("date") || "");
  const present = String(formData.get("present") || "") === "true";
  if (!classTeacherId || !dateRaw) return;
  const date = startOfDay(parseISO(dateRaw));
  const actor = await getActorUserId();

  const ct = await prisma.classTeacher.findUnique({
    where: { id: classTeacherId },
    select: {
      role: true,
      teacherId: true,
      classId: true,
      fixedAmount: true,
      class: { select: { scheduleDays: true } },
    },
  });
  if (!ct || ct.role !== "ASSISTANT") return;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.assistantAttendance.findFirst({ where: { classTeacherId, date } });
    if (existing) {
      await reverseAssistantAccrual(tx, existing.id);
      await tx.assistantAttendance.delete({ where: { id: existing.id } });
    }
    if (!present) return null;

    const created = await tx.assistantAttendance.create({
      data: { classTeacherId, date, present: true },
    });
    const closures = await tx.schoolClosure.findMany({
      where: {
        date: { gte: startOfMonth(date), lte: endOfMonth(date) },
        OR: [{ classId: ct.classId }, { classId: null }],
      },
      select: { date: true, isPaid: true },
    });
    await postAssistantAccrual(tx, {
      teacherId: ct.teacherId,
      classId: ct.classId,
      date,
      fixedAmount: ct.fixedAmount ?? 0,
      scheduleDays: ct.class.scheduleDays,
      closures,
      referenceId: created.id,
    });
    return created;
  });

  await writeAudit(actor, present ? "CREATE" : "DELETE", "AssistantAttendance", result?.id ?? classTeacherId);
  revalidatePath(`/classes/${ct.classId}`);
  revalidatePath("/attendance");
  revalidatePath("/teacher-pay");
}
