"use server";

import { ClassRole, Prisma, SalaryType } from "@prisma/client";
import { endOfMonth, parseISO, startOfDay, startOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { refreshStudentNextPaymentDue } from "@/lib/student-billing";
import { getActorUserId } from "@/lib/session";
import { postTeacherAccrual } from "@/lib/teacher-ledger";

type PrismaTx = Prisma.TransactionClient;

function parseTimeField(raw: string, fallbackHour: number): { hour: number; minute: number } {
  const [h, m] = String(raw).split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? Math.max(0, Math.min(23, Math.floor(h))) : fallbackHour,
    minute: Number.isFinite(m) ? Math.max(0, Math.min(59, Math.floor(m))) : 0,
  };
}

export async function createClass(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const roomId = String(formData.get("roomId") || "").trim() || null;
  const pricePerMonth = Number(formData.get("pricePerMonth"));
  const { hour: startHour, minute: startMinute } = parseTimeField(String(formData.get("startTime") || ""), 9);
  const { hour: endHourRaw, minute: endMinute } = parseTimeField(String(formData.get("endTime") || ""), 10);
  const endHour = Math.max(startHour + 1, endHourRaw);
  if (!name || Number.isNaN(pricePerMonth)) return;
  const actor = await getActorUserId();
  const row = await prisma.class.create({
    data: { name, roomId, startHour, startMinute, endHour, endMinute, pricePerMonth },
  });
  await writeAudit(actor, "CREATE", "Class", row.id);
  revalidatePath("/classes");
}

export async function updateClass(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const pricePerMonth = Number(formData.get("pricePerMonth"));
  if (!id || !name || Number.isNaN(pricePerMonth)) return;
  const actor = await getActorUserId();
  await prisma.class.update({
    where: { id },
    data: { name, pricePerMonth },
  });
  await writeAudit(actor, "UPDATE", "Class", id);
  revalidatePath("/classes");
  revalidatePath(`/classes/${id}`);
}

const dayCodes = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

export async function updateClassDetails(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const pricePerMonth = Number(formData.get("pricePerMonth"));
  const roomId = String(formData.get("roomId") || "").trim() || null;
  const { hour: startHour, minute: startMinute } = parseTimeField(String(formData.get("startTime") || ""), 9);
  const { hour: endHourRaw, minute: endMinute } = parseTimeField(String(formData.get("endTime") || ""), 10);
  const endHour = Math.max(startHour + 1, endHourRaw);
  const leadTeacherId = String(formData.get("leadTeacherId") || "").trim();
  const rawDays = formData.getAll("scheduleDays").map(String);
  const scheduleDays = rawDays.filter((d) => dayCodes.has(d));
  if (!id || !name || Number.isNaN(pricePerMonth)) return;
  const actor = await getActorUserId();

  await prisma.$transaction(async (tx) => {
    await tx.class.update({
      where: { id },
      data: { name, roomId, startHour, startMinute, endHour, endMinute, pricePerMonth, scheduleDays },
    });
    if (leadTeacherId) {
      await tx.classTeacher.deleteMany({ where: { classId: id } });
      await tx.classTeacher.create({
        data: { classId: id, teacherId: leadTeacherId, percentage: 100 },
      });
    }
  });

  await writeAudit(actor, "UPDATE", "Class", id);

  const enrolled = await prisma.studentClass.findMany({
    where: { classId: id, endDate: null },
    select: { studentId: true },
  });
  const studentIds = [...new Set(enrolled.map((e) => e.studentId))];
  await Promise.all(studentIds.map((sid) => refreshStudentNextPaymentDue(sid)));

  revalidatePath("/classes");
  revalidatePath(`/classes/${id}`);
}

export async function assignClassTeacher(formData: FormData) {
  const classId = String(formData.get("classId") || "");
  const teacherId = String(formData.get("teacherId") || "");
  const roleRaw = String(formData.get("role") || "TEACHER");
  const salaryTypeRaw = String(formData.get("salaryType") || "PERCENTAGE");
  const percentage = Number(formData.get("percentage") || 0);
  const fixedAmountRaw = Number(formData.get("fixedAmount") || 0);
  if (!classId || !teacherId) return;
  const role = roleRaw === "ASSISTANT" ? ClassRole.ASSISTANT : ClassRole.TEACHER;
  const salaryType = salaryTypeRaw === "FIXED" ? SalaryType.FIXED : SalaryType.PERCENTAGE;
  const fixedAmount = salaryType === SalaryType.FIXED ? fixedAmountRaw : null;
  const actor = await getActorUserId();
  const row = await prisma.classTeacher.create({
    data: { classId, teacherId, role, salaryType, percentage, fixedAmount },
  });
  await writeAudit(actor, "CREATE", "ClassTeacher", row.id);
  revalidatePath("/classes");
  revalidatePath(`/classes/${classId}`);
}

export async function updateClassTeacherShare(formData: FormData) {
  const id = String(formData.get("id") || "");
  const salaryTypeRaw = String(formData.get("salaryType") || "PERCENTAGE");
  const percentage = Number(formData.get("percentage") || 0);
  const fixedAmountRaw = Number(formData.get("fixedAmount") || 0);
  if (!id) return;
  const salaryType = salaryTypeRaw === "FIXED" ? SalaryType.FIXED : SalaryType.PERCENTAGE;
  const fixedAmount = salaryType === SalaryType.FIXED ? fixedAmountRaw : null;
  const actor = await getActorUserId();
  const existing = await prisma.classTeacher.findUnique({
    where: { id },
    select: { classId: true },
  });
  await prisma.classTeacher.update({
    where: { id },
    data: { salaryType, percentage, fixedAmount },
  });
  await writeAudit(actor, "UPDATE", "ClassTeacher", id);
  revalidatePath("/classes");
  if (existing) revalidatePath(`/classes/${existing.classId}`);
}

export async function removeClassTeacher(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  const existing = await prisma.classTeacher.findUnique({
    where: { id },
    select: { classId: true },
  });
  await prisma.classTeacher.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "ClassTeacher", id);
  revalidatePath("/classes");
  if (existing) revalidatePath(`/classes/${existing.classId}`);
}

// ── Day-specific teacher override (substitute) ────────────────────────────────

/**
 * Redirects any accrual the original teacher already earned for this exact
 * class/date/attendance before the override existed — e.g. attendance was
 * logged first, and the substitution was only recorded afterward.
 * postTeacherAccrual only redirects pay at the moment attendance is created,
 * so without this, the original teacher would silently keep pay for a
 * session they didn't actually teach. Nets per attendance (referenceId) so
 * it's safe to call even if some rows were already reversed elsewhere.
 */
async function reconcilePastAccrualForOverride(
  tx: PrismaTx,
  params: { classId: string; date: Date; originalTeacherId: string; substituteTeacherId: string },
) {
  const { classId, date, originalTeacherId, substituteTeacherId } = params;
  const existing = await tx.teacherLedger.findMany({
    where: { teacherId: originalTeacherId, classId, date, type: "ACCRUAL" },
  });
  if (existing.length === 0) return;

  const byReference = new Map<string, number>();
  for (const row of existing) {
    const key = row.referenceId ?? "";
    byReference.set(key, (byReference.get(key) ?? 0) + row.amount);
  }

  for (const [referenceId, net] of byReference.entries()) {
    if (!net) continue;
    await tx.teacherLedger.create({
      data: {
        teacherId: originalTeacherId,
        classId,
        date,
        type: "ACCRUAL",
        amount: -net,
        referenceId: referenceId || null,
      },
    });
    await tx.teacherLedger.create({
      data: {
        teacherId: substituteTeacherId,
        classId,
        date,
        type: "ACCRUAL",
        amount: net,
        referenceId: referenceId || null,
      },
    });
  }
}

export async function createTeacherOverride(formData: FormData) {
  const classId = String(formData.get("classId") || "");
  const dateRaw = String(formData.get("date") || "");
  const originalTeacherId = String(formData.get("originalTeacherId") || "");
  const substituteTeacherId = String(formData.get("substituteTeacherId") || "").trim();
  const reason = String(formData.get("reason") || "").trim().slice(0, 200) || null;
  if (!classId || !dateRaw || !originalTeacherId || !substituteTeacherId) return;
  const date = startOfDay(parseISO(dateRaw));
  const actor = await getActorUserId();

  const row = await prisma.$transaction(async (tx) => {
    // Remove existing override for same class+date+original teacher if any
    await tx.classTeacherOverride.deleteMany({
      where: { classId, date, originalTeacherId },
    });
    const created = await tx.classTeacherOverride.create({
      data: { classId, date, originalTeacherId, substituteTeacherId, reason },
    });
    await reconcilePastAccrualForOverride(tx, { classId, date, originalTeacherId, substituteTeacherId });
    return created;
  });
  await writeAudit(actor, "CREATE", "ClassTeacherOverride", row.id);
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/attendance");
  revalidatePath("/teacher-pay");
}

/**
 * Reports whether deleting this override would reverse anything already
 * posted to the substitute (an ACCRUAL and/or an active fine). Used by the
 * UI to decide whether to show a confirmation dialog before calling
 * deleteTeacherOverride.
 */
export async function getOverrideReversalImpact(id: string) {
  const empty = { hasImpact: false, accrualTotal: 0, fineTotal: 0 };
  if (!id) return empty;
  const existing = await prisma.classTeacherOverride.findUnique({ where: { id } });
  if (!existing) return empty;

  const [accruals, fines] = await Promise.all([
    prisma.teacherLedger.findMany({
      where: {
        teacherId: existing.substituteTeacherId,
        classId: existing.classId,
        date: existing.date,
        type: "ACCRUAL",
      },
    }),
    prisma.teacherFine.findMany({
      where: {
        teacherId: existing.substituteTeacherId,
        classId: existing.classId,
        date: existing.date,
        isWaived: false,
      },
    }),
  ]);
  const accrualTotal = accruals.reduce((s, a) => s + a.amount, 0);
  const fineTotal = fines.reduce((s, f) => s + f.amount, 0);
  return { hasImpact: accrualTotal !== 0 || fines.length > 0, accrualTotal, fineTotal };
}

/**
 * Deleting an override reverses whatever it caused for the substitute (their
 * ACCRUAL rows and any active fine for that session), then re-accrues the
 * original teacher for the same sessions. History is kept via reversing
 * counter-entries rather than deleting ledger rows.
 */
export async function deleteTeacherOverride(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();

  const existing = await prisma.classTeacherOverride.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    const accruals = await tx.teacherLedger.findMany({
      where: {
        teacherId: existing.substituteTeacherId,
        classId: existing.classId,
        date: existing.date,
        type: "ACCRUAL",
      },
    });
    for (const row of accruals) {
      await tx.teacherLedger.create({
        data: {
          teacherId: row.teacherId,
          classId: row.classId,
          date: row.date,
          type: "ACCRUAL",
          amount: -row.amount,
          referenceId: row.referenceId,
        },
      });
    }

    const fines = await tx.teacherFine.findMany({
      where: {
        teacherId: existing.substituteTeacherId,
        classId: existing.classId,
        date: existing.date,
        isWaived: false,
      },
    });
    for (const fine of fines) {
      await tx.teacherFine.update({ where: { id: fine.id }, data: { isWaived: true } });
      await tx.teacherLedger.create({
        data: {
          teacherId: fine.teacherId,
          classId: fine.classId,
          date: fine.date,
          type: "FINE_DEDUCTION",
          amount: fine.amount,
          referenceId: fine.id,
        },
      });
    }

    // Delete the override before re-accruing so postTeacherAccrual pays the
    // original teacher directly instead of redirecting back to the substitute.
    await tx.classTeacherOverride.delete({ where: { id } });

    const attendanceIds = [
      ...new Set(accruals.map((a) => a.referenceId).filter((x): x is string => !!x)),
    ];
    if (attendanceIds.length > 0) {
      const cls = await tx.class.findUnique({
        where: { id: existing.classId },
        select: { pricePerMonth: true, scheduleDays: true },
      });
      if (cls) {
        const closures = await tx.schoolClosure.findMany({
          where: {
            date: { gte: startOfMonth(existing.date), lte: endOfMonth(existing.date) },
            OR: [{ classId: existing.classId }, { classId: null }],
          },
          select: { date: true, isPaid: true },
        });
        for (const attendanceId of attendanceIds) {
          const att = await tx.attendance.findUnique({
            where: { id: attendanceId },
            select: { studentId: true },
          });
          if (!att) continue;
          const sc = await tx.studentClass.findFirst({
            where: { studentId: att.studentId, classId: existing.classId, endDate: null },
            select: { customRate: true, isFree: true },
          });
          const rate = sc?.isFree ? cls.pricePerMonth : (sc?.customRate ?? cls.pricePerMonth);
          await postTeacherAccrual(tx, {
            classId: existing.classId,
            date: existing.date,
            attendanceId,
            rate,
            scheduleDays: cls.scheduleDays,
            closures,
          });
        }
      }
    }
  });

  await writeAudit(actor, "DELETE", "ClassTeacherOverride", id);
  revalidatePath(`/classes/${existing.classId}`);
  revalidatePath("/attendance");
  revalidatePath("/teacher-pay");
}
