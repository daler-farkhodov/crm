"use server";

import { PaymentMethod, TeacherLedgerType, UserRole } from "@prisma/client";
import { addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { validateSplit } from "@/lib/payment-split";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

const roles = new Set(Object.values(UserRole));
const paymentMethods = new Set(Object.values(PaymentMethod));

/** §3.8: reads the shared Cash/Transfer/Split fields off a FormData payload. */
function readPaymentSplit(formData: FormData, total: number) {
  const raw = String(formData.get("paymentMethod") || "CASH");
  if (raw === "SPLIT") {
    const cashAmount = Number(formData.get("cashAmount") ?? 0);
    const transferAmount = Number(formData.get("transferAmount") ?? 0);
    const check = validateSplit(total, cashAmount, transferAmount);
    if (!check.ok) return null;
    return { paymentMethod: PaymentMethod.CASH, isSplit: true, cashAmount, transferAmount };
  }
  if (!paymentMethods.has(raw as PaymentMethod)) return null;
  return { paymentMethod: raw as PaymentMethod, isSplit: false, cashAmount: null, transferAmount: null };
}

export async function createTeacherEarning(formData: FormData) {
  const teacherId = String(formData.get("teacherId") || "");
  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  const totalAmount = Number(formData.get("totalAmount"));
  if (!teacherId || Number.isNaN(month) || Number.isNaN(year) || Number.isNaN(totalAmount))
    return;
  const actor = await getActorUserId();
  const row = await prisma.teacherEarnings.create({
    data: { teacherId, month, year, totalAmount, isPaid: false },
  });
  await writeAudit(actor, "CREATE", "TeacherEarnings", row.id);
  revalidatePath("/teacher-pay");
}

export async function toggleTeacherEarningPaid(formData: FormData) {
  const id = String(formData.get("id") || "");
  const isPaid = String(formData.get("isPaid") || "") === "true";
  if (!id) return;
  const actor = await getActorUserId();

  const existing = await prisma.teacherEarnings.findUnique({ where: { id } });
  if (!existing || existing.isPaid === isPaid) return;

  const split = isPaid ? readPaymentSplit(formData, existing.totalAmount) : null;
  if (isPaid && !split) return;

  await prisma.$transaction(async (tx) => {
    await tx.teacherEarnings.update({
      where: { id },
      data: {
        isPaid,
        ...(split
          ? {
              paymentMethod: split.paymentMethod,
              isSplit: split.isSplit,
              cashAmount: split.cashAmount,
              transferAmount: split.transferAmount,
            }
          : {}),
      },
    });
    // Zero out the settled balance on payout; reverse if un-marking paid.
    // Dated within the settled month so it nets against that month's accrual sum.
    await tx.teacherLedger.create({
      data: {
        teacherId: existing.teacherId,
        date: new Date(existing.year, existing.month - 1, 1),
        type: TeacherLedgerType.PAYOUT,
        amount: isPaid ? -existing.totalAmount : existing.totalAmount,
        referenceId: existing.id,
      },
    });
  });

  await writeAudit(actor, "UPDATE", "TeacherEarnings", id);
  revalidatePath("/teacher-pay");
}

export async function createExpense(formData: FormData) {
  const expenseTypeId = String(formData.get("expenseTypeId") || "").trim();
  const customType = String(formData.get("customType") || formData.get("title") || "")
    .trim()
    .slice(0, 50);
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") || "").trim().slice(0, 150);
  const dateRaw = String(formData.get("date") || "");
  const teacherId = String(formData.get("teacherId") || "").trim() || null;
  const deductMonthRaw = Number(formData.get("deductMonth"));
  const deductYearRaw = Number(formData.get("deductYear"));
  const deductMonth = teacherId && Number.isFinite(deductMonthRaw) ? deductMonthRaw : null;
  const deductYear = teacherId && Number.isFinite(deductYearRaw) ? deductYearRaw : null;
  // derive title from type name or custom
  const title = expenseTypeId
    ? (await prisma.expenseType.findUnique({ where: { id: expenseTypeId }, select: { name: true } }))?.name ?? customType
    : customType;
  if (!title || Number.isNaN(amount) || !dateRaw) return;
  const split = readPaymentSplit(formData, amount);
  if (!split) return;
  const actor = await getActorUserId();

  const row = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        title,
        amount,
        date: new Date(dateRaw),
        note: note || null,
        expenseTypeId: expenseTypeId || null,
        teacherId,
        deductMonth,
        deductYear,
        isDeducted: !!teacherId,
        paymentMethod: split.paymentMethod,
        isSplit: split.isSplit,
        cashAmount: split.cashAmount,
        transferAmount: split.transferAmount,
      },
    });
    // Teacher pre-payments deduct immediately rather than waiting for month-end settle,
    // but are dated to the deduct month/year so they land in the right month's totals.
    if (teacherId) {
      const deductDate = deductMonth && deductYear ? new Date(deductYear, deductMonth - 1, 1) : new Date(dateRaw);
      await tx.teacherLedger.create({
        data: {
          teacherId,
          date: deductDate,
          type: TeacherLedgerType.ADVANCE_DEDUCTION,
          amount: -amount,
          referenceId: expense.id,
        },
      });
    }
    return expense;
  });

  await writeAudit(actor, "CREATE", "Expense", row.id);
  revalidatePath("/expenses");
  revalidatePath("/accounting");
  if (teacherId) revalidatePath("/teacher-pay");
}

export async function updateExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") || "").trim().slice(0, 150);
  if (!id || Number.isNaN(amount)) return;
  // paymentMethod is only present when the caller exposes the field (the
  // /expenses edit form); a quick inline amount-only edit omits it entirely
  // so the existing Cash/Transfer/Split choice on the row is left untouched.
  const split = formData.has("paymentMethod") ? readPaymentSplit(formData, amount) : undefined;
  if (split === null) return;
  const actor = await getActorUserId();
  await prisma.expense.update({
    where: { id },
    data: {
      amount,
      note: note || null,
      ...(split
        ? {
            paymentMethod: split.paymentMethod,
            isSplit: split.isSplit,
            cashAmount: split.cashAmount,
            transferAmount: split.transferAmount,
          }
        : {}),
    },
  });
  await writeAudit(actor, "UPDATE", "Expense", id);
  revalidatePath("/expenses");
  revalidatePath("/accounting");
}

export async function createExpenseType(formData: FormData) {
  const name = String(formData.get("name") || "").trim().slice(0, 50);
  if (!name) return;
  const actor = await getActorUserId();
  const row = await prisma.expenseType.create({ data: { name } });
  await writeAudit(actor, "CREATE", "ExpenseType", row.id);
  revalidatePath("/settings");
  revalidatePath("/accounting");
}

export async function deleteExpenseType(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.expenseType.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "ExpenseType", id);
  revalidatePath("/settings");
  revalidatePath("/accounting");
}

/**
 * "Settle the month" — teacher pay now accrues live per-session into
 * TeacherLedger (see src/lib/teacher-ledger.ts), so this no longer
 * recomputes anything from scratch. It just sums that month's TeacherLedger
 * rows per teacher and upserts a TeacherEarnings row with the total
 * (isPaid: false). No-op if a row for that teacher/month/year already
 * exists. Does not post a PAYOUT — that happens when the earnings row is
 * marked paid (see toggleTeacherEarningPaid).
 */
export async function generateTeacherSalaries(formData: FormData) {
  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  if (Number.isNaN(month) || Number.isNaN(year)) return;
  const actor = await getActorUserId();

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const entries = await prisma.teacherLedger.findMany({
    where: { date: { gte: from, lte: to } },
    select: { teacherId: true, amount: true },
  });

  const totalsByTeacher = new Map<string, number>();
  for (const e of entries) {
    totalsByTeacher.set(e.teacherId, (totalsByTeacher.get(e.teacherId) ?? 0) + e.amount);
  }

  for (const [teacherId, rawAmount] of totalsByTeacher.entries()) {
    const totalAmount = Math.round(rawAmount * 100) / 100;
    const existing = await prisma.teacherEarnings.findFirst({ where: { teacherId, month, year } });
    if (!existing) {
      const row = await prisma.teacherEarnings.create({
        data: { teacherId, month, year, totalAmount, isPaid: false },
      });
      await writeAudit(actor, "CREATE", "TeacherEarnings", row.id);
    }
  }

  revalidatePath("/teacher-pay");
  revalidatePath("/accounting");
}

export async function updateTeacherEarningAmount(formData: FormData) {
  const id = String(formData.get("id") || "");
  const totalAmount = Number(formData.get("totalAmount"));
  if (!id || Number.isNaN(totalAmount)) return;
  const actor = await getActorUserId();
  await prisma.teacherEarnings.update({ where: { id }, data: { totalAmount } });
  await writeAudit(actor, "UPDATE", "TeacherEarnings", id);
  revalidatePath("/teacher-pay");
  revalidatePath("/accounting");
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  const existing = await prisma.expense.findUnique({ where: { id }, select: { isDeducted: true } });
  if (!existing || existing.isDeducted) return;
  await prisma.expense.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "Expense", id);
  revalidatePath("/expenses");
  revalidatePath("/accounting");
}

export async function createClosure(formData: FormData) {
  const date = String(formData.get("date") || "");
  const classId = String(formData.get("classId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const isPaid = String(formData.get("isPaid") || "") === "true";
  if (!date) return;
  const actor = await getActorUserId();
  const row = await prisma.schoolClosure.create({
    data: {
      date: new Date(date),
      classId: classId || null,
      reason: reason || null,
      isPaid,
    },
  });
  await writeAudit(actor, "CREATE", "SchoolClosure", row.id);
  revalidatePath("/closures");
}

export async function deleteClosure(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.schoolClosure.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "SchoolClosure", id);
  revalidatePath("/closures");
}

export async function createUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const role = String(formData.get("role") || "");
  if (!email || !fullName || !roles.has(role as UserRole)) return;
  const actor = await getActorUserId();
  const row = await prisma.user.create({
    data: { email, fullName, role: role as UserRole },
  });
  await writeAudit(actor, "CREATE", "User", row.id);
  revalidatePath("/users");
}

// ── Item 10: Teacher fines ────────────────────────────────────────────────────

export async function applyAttendanceFines(formData: FormData) {
  const fineAmount = Number(formData.get("fineAmount"));
  const checkDate = String(formData.get("checkDate") || "");
  if (Number.isNaN(fineAmount) || fineAmount <= 0 || !checkDate) return;
  const actor = await getActorUserId();

  const date = new Date(checkDate);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dayName = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()];

  // Classes scheduled on this day (not cancelled)
  const classes = await prisma.class.findMany({
    where: { scheduleDays: { has: dayName } },
    include: {
      teachers: true,
      closures: { where: { date: { gte: dayStart, lte: dayEnd } } },
      teacherOverrides: { where: { date: { gte: dayStart, lte: dayEnd } } },
    },
  });

  const globalClosureCount = await prisma.schoolClosure.count({
    where: { date: { gte: dayStart, lte: dayEnd }, classId: null },
  });

  for (const cls of classes) {
    if (globalClosureCount > 0 || cls.closures.length > 0) continue; // class was cancelled

    // Find which teachers logged attendance for this class on this day
    const logged = await prisma.attendance.findMany({
      where: { classId: cls.id, date: { gte: dayStart, lte: dayEnd } },
      select: { teacherId: true },
    });
    const loggedTeacherIds = new Set(logged.map((a) => a.teacherId).filter(Boolean));

    for (const ct of cls.teachers) {
      // A substitute override for this teacher/date exempts the original
      // teacher entirely — the substitute is fined (or not) instead.
      const override = cls.teacherOverrides.find((o) => o.originalTeacherId === ct.teacherId);
      const targetTeacherId = override?.substituteTeacherId ?? ct.teacherId;
      if (loggedTeacherIds.has(targetTeacherId)) continue;
      // Check no fine already exists for this teacher/class/date
      const existing = await prisma.teacherFine.findFirst({
        where: { teacherId: targetTeacherId, classId: cls.id, date: { gte: dayStart, lte: dayEnd } },
      });
      if (existing) continue;
      const row = await prisma.$transaction(async (tx) => {
        const fine = await tx.teacherFine.create({
          data: {
            teacherId: targetTeacherId,
            classId: cls.id,
            date: dayStart,
            amount: fineAmount,
            reason: "Attendance not logged by midnight",
          },
        });
        await tx.teacherLedger.create({
          data: {
            teacherId: targetTeacherId,
            classId: cls.id,
            date: dayStart,
            type: TeacherLedgerType.FINE_DEDUCTION,
            amount: -fineAmount,
            referenceId: fine.id,
          },
        });
        return fine;
      });
      await writeAudit(actor, "CREATE", "TeacherFine", row.id);
    }
  }

  revalidatePath("/teacher-pay");
}

export async function waiverTeacherFine(formData: FormData) {
  const id = String(formData.get("id") || "");
  const isWaived = String(formData.get("isWaived") || "") === "true";
  if (!id) return;
  const actor = await getActorUserId();

  const existing = await prisma.teacherFine.findUnique({ where: { id } });
  if (!existing || existing.isWaived === isWaived) return;

  await prisma.$transaction(async (tx) => {
    await tx.teacherFine.update({ where: { id }, data: { isWaived } });
    // Waiving reverses the deduction (positive counter-entry); reinstating re-deducts.
    await tx.teacherLedger.create({
      data: {
        teacherId: existing.teacherId,
        classId: existing.classId,
        date: existing.date,
        type: TeacherLedgerType.FINE_DEDUCTION,
        amount: isWaived ? existing.amount : -existing.amount,
        referenceId: existing.id,
      },
    });
  });

  await writeAudit(actor, "UPDATE", "TeacherFine", id);
  revalidatePath("/teacher-pay");
}

export async function deleteTeacherFine(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();

  const existing = await prisma.teacherFine.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    // Reverse any still-active deduction before removing the fine record.
    if (!existing.isWaived) {
      await tx.teacherLedger.create({
        data: {
          teacherId: existing.teacherId,
          classId: existing.classId,
          date: existing.date,
          type: TeacherLedgerType.FINE_DEDUCTION,
          amount: existing.amount,
          referenceId: existing.id,
        },
      });
    }
    await tx.teacherFine.delete({ where: { id } });
  });

  await writeAudit(actor, "DELETE", "TeacherFine", id);
  revalidatePath("/teacher-pay");
}

// ── Item 17: Recurring expenses ───────────────────────────────────────────────

export async function createRecurringExpense(formData: FormData) {
  const title = String(formData.get("title") || "").trim().slice(0, 100);
  const amount = Number(formData.get("amount"));
  const interval = String(formData.get("interval") || "");
  const nextDueDate = String(formData.get("nextDueDate") || "");
  const expenseTypeId = String(formData.get("expenseTypeId") || "").trim();
  if (!title || Number.isNaN(amount) || !["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(interval) || !nextDueDate) return;
  const actor = await getActorUserId();
  const row = await prisma.recurringExpense.create({
    data: {
      title,
      amount,
      interval: interval as "WEEKLY" | "BIWEEKLY" | "MONTHLY",
      nextDueDate: new Date(nextDueDate),
      expenseTypeId: expenseTypeId || null,
    },
  });
  await writeAudit(actor, "CREATE", "RecurringExpense", row.id);
  revalidatePath("/expenses");
}

export async function toggleRecurringExpenseActive(formData: FormData) {
  const id = String(formData.get("id") || "");
  const isActive = String(formData.get("isActive") || "") === "true";
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.recurringExpense.update({ where: { id }, data: { isActive } });
  await writeAudit(actor, "UPDATE", "RecurringExpense", id);
  revalidatePath("/expenses");
}

export async function deleteRecurringExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.recurringExpense.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "RecurringExpense", id);
  revalidatePath("/expenses");
}

/** Materialize all overdue recurring expenses as Expense rows and advance their nextDueDate. */
export async function generateDueRecurringExpenses() {
  const actor = await getActorUserId();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await prisma.recurringExpense.findMany({
    where: { isActive: true, nextDueDate: { lte: today } },
  });

  for (const rec of due) {
    // Materialize one expense per overdue occurrence. Compute all occurrence
    // dates in memory first, then write them in a single createMany — a
    // recurring expense that's been overdue for years would otherwise mean
    // one sequential DB round-trip per occurrence, which is slow enough to
    // exceed request timeouts.
    const occurrences: Date[] = [];
    let next = new Date(rec.nextDueDate);
    while (next <= today) {
      occurrences.push(next);
      // Advance by interval
      if (rec.interval === "WEEKLY") {
        next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (rec.interval === "BIWEEKLY") {
        next = new Date(next.getTime() + 14 * 24 * 60 * 60 * 1000);
      } else {
        // MONTHLY: same day next month. Use date-fns addMonths (not
        // setMonth) — setMonth overflows into the following month for
        // day-of-month > days-in-target-month (e.g. Jan 31 + 1 "month" via
        // setMonth lands on Mar 2/3, skipping February entirely). addMonths
        // correctly clamps to the last day of the target month instead.
        next = addMonths(next, 1);
      }
    }
    await prisma.expense.createMany({
      data: occurrences.map((date) => ({
        title: rec.title,
        amount: rec.amount,
        date,
        expenseTypeId: rec.expenseTypeId ?? null,
      })),
    });
    await prisma.recurringExpense.update({
      where: { id: rec.id },
      data: { nextDueDate: next },
    });
    await writeAudit(actor, "GENERATE", "RecurringExpense", rec.id);
  }

  revalidatePath("/expenses");
  revalidatePath("/accounting");
}
