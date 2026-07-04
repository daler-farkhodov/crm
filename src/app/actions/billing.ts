"use server";

import { InvoiceStatus, LedgerType, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import {
  billingAnchorFromEnrollments,
  billingPeriodForCycle,
  countSessionsBetween,
  nextAnniversaryDueAfterCycle,
} from "@/lib/billing-cycle";
import { validateSplit } from "@/lib/payment-split";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

const invoiceStatuses = new Set(Object.values(InvoiceStatus));
const ledgerTypes = new Set(Object.values(LedgerType));

export async function createInvoice(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const classId = String(formData.get("classId") || "");
  const periodStart = String(formData.get("periodStart") || "");
  const periodEnd = String(formData.get("periodEnd") || "");
  const totalAmount = Number(formData.get("totalAmount"));
  const creditApplied = Number(formData.get("creditApplied"));
  if (
    !studentId ||
    !periodStart ||
    !periodEnd ||
    Number.isNaN(totalAmount) ||
    Number.isNaN(creditApplied)
  )
    return;
  if (creditApplied < 0 || creditApplied > totalAmount) return;
  const finalAmount = totalAmount - creditApplied;
  if (finalAmount < 0) return;
  const actor = await getActorUserId();
  const inv = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        studentId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalAmount,
        creditApplied,
        finalAmount,
        status: InvoiceStatus.PENDING,
      },
    });
    // No ledger entry on invoice creation — balance is driven by attendance DEBITs
    // and invoice PAYMENTs only. The invoice is purely a billing document.
    if (classId) {
      await tx.invoiceLine.create({
        data: { invoiceId: created.id, classId, amount: totalAmount },
      });
    }
    return created;
  });
  await writeAudit(actor, "CREATE", "Invoice", inv.id);
  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/");
}

/** Creates a monthly invoice from enrollments when payment is due; advances nextPaymentDue.
 *
 * Supports:
 * - Item 5: customRate — uses the student-specific rate instead of class price
 * - Item 6: isFree — skips free enrollments entirely (no charge)
 * - Item 8: mid-month transfer proration — includes ended enrollments that overlap the period,
 *   prorates each by sessions attended within the enrollment window vs total class sessions
 */
export async function generateDueStudentInvoice(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  if (!studentId) return;

  // Need the anchor from ALL enrollments (active + historical)
  const allEnrollments = await prisma.studentClass.findMany({
    where: { studentId },
    include: { class: true },
    orderBy: { startDate: "asc" },
  });
  if (allEnrollments.length === 0) return;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student?.nextPaymentDue) return;

  const anchor = billingAnchorFromEnrollments(allEnrollments.map((sc) => sc.startDate));
  if (!anchor) return;

  const cycleIndex = await prisma.invoice.count({
    where: {
      studentId,
      status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PAID] },
    },
  });

  const { periodStart, periodEnd } = billingPeriodForCycle(anchor, cycleIndex);

  // Guard: don't create a duplicate for the same period
  const overlap = await prisma.invoice.findFirst({
    where: {
      studentId,
      status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PAID] },
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
  });
  if (overlap) return;

  // ── Item 8: find all enrollments overlapping this billing period ────────────
  const periodEnrollments = allEnrollments.filter(
    (sc) =>
      sc.startDate <= periodEnd &&
      (sc.endDate === null || sc.endDate >= periodStart),
  );

  // Pre-fetch closures for all classes in the period
  const classIds = [...new Set(periodEnrollments.map((sc) => sc.classId))];
  const closureRows = await prisma.schoolClosure.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      OR: [{ classId: { in: classIds } }, { classId: null }],
    },
    select: { classId: true, date: true, isPaid: true },
  });
  const closuresByClass = new Map<string | null, { date: Date; isPaid: boolean }[]>();
  for (const c of closureRows) {
    const key = c.classId;
    closuresByClass.set(key, [
      ...(closuresByClass.get(key) ?? []),
      { date: c.date, isPaid: c.isPaid },
    ]);
  }
  const globalClosures = closuresByClass.get(null) ?? [];

  // ── Calculate prorated amount per enrollment ────────────────────────────────
  let totalAmount = 0;
  const lines: { classId: string; amount: number }[] = [];
  for (const sc of periodEnrollments) {
    if (sc.isFree) continue; // Item 6: free students are not billed

    const rate = sc.customRate ?? sc.class.pricePerMonth; // Item 5: custom rate

    // Enrollment window clipped to billing period
    const windowStart = sc.startDate > periodStart ? sc.startDate : periodStart;
    const windowEnd = sc.endDate && sc.endDate < periodEnd ? sc.endDate : periodEnd;

    const classClosures = [
      ...globalClosures,
      ...(closuresByClass.get(sc.classId) ?? []),
    ];

    const totalSessions = countSessionsBetween(
      sc.class.scheduleDays, periodStart, periodEnd, classClosures,
    );
    const windowSessions = countSessionsBetween(
      sc.class.scheduleDays, windowStart, windowEnd, classClosures,
    );

    if (totalSessions === 0) continue;

    // Item 8: prorate — if full period, windowSessions === totalSessions → no change
    const lineAmount = Math.round(rate * (windowSessions / totalSessions) * 100) / 100;
    if (lineAmount <= 0) continue;
    totalAmount += lineAmount;
    lines.push({ classId: sc.classId, amount: lineAmount });
  }

  totalAmount = Math.round(totalAmount * 100) / 100;
  if (totalAmount <= 0) return;

  const ledgerAgg = await prisma.ledger.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  // Positive balance = student has prepaid credit → apply against this invoice.
  // Negative balance = student owes → no credit to apply.
  const balance = ledgerAgg._sum.amount ?? 0;

  // Transfer-earmarked credit (positive CREDIT rows tagged with one of this
  // invoice's classIds, from a prior transferStudent call) applies first and
  // isn't netted against unrelated debits elsewhere on the account.
  const earmarkedAgg = await prisma.ledger.aggregate({
    where: { studentId, type: LedgerType.CREDIT, classId: { in: classIds }, amount: { gt: 0 } },
    _sum: { amount: true },
  });
  const earmarkedCredit = earmarkedAgg._sum.amount ?? 0;
  const genericCredit = Math.max(0, balance - earmarkedCredit);
  const creditApplied = Math.min(totalAmount, earmarkedCredit + genericCredit);
  const finalAmount = Math.max(0, totalAmount - creditApplied);
  const actor = await getActorUserId();

  const newInvoiceId = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        studentId,
        periodStart,
        periodEnd,
        totalAmount,
        creditApplied,
        finalAmount,
        status: InvoiceStatus.PENDING,
      },
    });
    // No ledger entry on creation — PAYMENT entry added when invoice is marked PAID.
    for (const line of lines) {
      await tx.invoiceLine.create({
        data: { invoiceId: inv.id, classId: line.classId, amount: line.amount },
      });
    }
    return inv.id;
  });

  await writeAudit(actor, "CREATE", "Invoice", newInvoiceId);
  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/");
}

const paymentMethods = new Set(Object.values(PaymentMethod));

export async function updateInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const paymentMethodRaw = String(formData.get("paymentMethod") || "CASH");
  if (!id || !invoiceStatuses.has(status as InvoiceStatus)) return;

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { studentId: true, finalAmount: true, originalInvoiceId: true, returnedAmount: true },
  });
  if (!existing) return;

  const isCorrection = existing.originalInvoiceId !== null;
  const amountToPost = isCorrection ? existing.returnedAmount ?? 0 : existing.finalAmount;

  // §3.8: full cash/transfer posts a single tagged row; a split posts two,
  // one per method, after validating they sum exactly to the invoice amount.
  // Validate before any write so a bad split is rejected outright.
  const splitRows: { amount: number; paymentMethod: PaymentMethod }[] = [];
  if (status === InvoiceStatus.PAID && amountToPost > 0) {
    if (paymentMethodRaw === "SPLIT") {
      const cashAmount = Number(formData.get("cashAmount") ?? 0);
      const transferAmount = Number(formData.get("transferAmount") ?? 0);
      const check = validateSplit(amountToPost, cashAmount, transferAmount);
      if (!check.ok) return;
      if (cashAmount > 0) splitRows.push({ amount: cashAmount, paymentMethod: PaymentMethod.CASH });
      if (transferAmount > 0)
        splitRows.push({ amount: transferAmount, paymentMethod: PaymentMethod.TRANSFER });
    } else if (paymentMethods.has(paymentMethodRaw as PaymentMethod)) {
      splitRows.push({ amount: amountToPost, paymentMethod: paymentMethodRaw as PaymentMethod });
    } else {
      splitRows.push({ amount: amountToPost, paymentMethod: PaymentMethod.CASH });
    }
  }

  const actor = await getActorUserId();

  const inv = await prisma.invoice.update({
    where: { id },
    data: { status: status as InvoiceStatus },
    select: { studentId: true },
  });

  if (splitRows.length > 0) {
    // Correction ("rewritten") invoice: marking it PAID means the student's
    // returned credit is actually walking out the door — post ADJUSTMENT
    // debit(s) instead of the normal PAYMENT credit.
    await prisma.ledger.createMany({
      data: splitRows.map((r) => ({
        studentId: inv.studentId,
        type: isCorrection ? LedgerType.ADJUSTMENT : LedgerType.PAYMENT,
        amount: isCorrection ? -r.amount : r.amount,
        paymentMethod: r.paymentMethod,
        referenceId: id,
        referenceType: "Invoice",
      })),
    });
  }

  await writeAudit(actor, "UPDATE_STATUS", "Invoice", id);
  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/students");
  revalidatePath(`/students/${inv.studentId}`);
  revalidatePath("/");
}

/**
 * Item 15/§3.5c: when an enrollment ends mid-period leaving a positive
 * balance (the plain per-session refund didn't cover it), generate a
 * correction invoice against the single PAID invoice that covered the
 * enrollment's period — "returning" the balance by reducing that invoice's
 * effective total instead of leaving a silent credit sitting on the account.
 * Requires exactly one unambiguous PAID invoice covering endDate; if none or
 * multiple match, returns null so the caller can fall back to a plain
 * write-off (see softDeleteStudent/endEnrollment).
 */
export async function generateRewrittenInvoice(
  studentId: string,
  classId: string,
  endDate: Date,
): Promise<{ invoiceId: string } | null> {
  const matches = await prisma.invoice.findMany({
    where: {
      studentId,
      status: InvoiceStatus.PAID,
      originalInvoiceId: null,
      periodStart: { lte: endDate },
      periodEnd: { gte: endDate },
    },
  });
  if (matches.length !== 1) return null;
  const originalInvoice = matches[0];

  const ledgerAgg = await prisma.ledger.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  const returnedAmount = Math.round(Math.max(0, ledgerAgg._sum.amount ?? 0) * 100) / 100;
  if (returnedAmount <= 0) return null;

  const retainedAmount =
    Math.round((originalInvoice.finalAmount - returnedAmount) * 100) / 100;

  const actor = await getActorUserId();
  const newInvoiceId = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        studentId,
        periodStart: originalInvoice.periodStart,
        periodEnd: originalInvoice.periodEnd,
        totalAmount: retainedAmount,
        creditApplied: 0,
        finalAmount: retainedAmount,
        status: InvoiceStatus.PENDING,
        originalInvoiceId: originalInvoice.id,
        returnedAmount,
      },
    });
    await tx.invoiceLine.create({
      data: { invoiceId: inv.id, classId, amount: -returnedAmount },
    });
    return inv.id;
  });

  await writeAudit(actor, "CREATE", "Invoice", newInvoiceId);
  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/");
  return { invoiceId: newInvoiceId };
}

export async function createLedgerEntry(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const type = String(formData.get("type") || "");
  const amount = Number(formData.get("amount"));
  const referenceId = String(formData.get("referenceId") || "");
  const referenceType = String(formData.get("referenceType") || "");
  const paymentMethodRaw = String(formData.get("paymentMethod") || "");
  if (!studentId || !ledgerTypes.has(type as LedgerType) || Number.isNaN(amount))
    return;
  if (type === LedgerType.PAYMENT && !paymentMethods.has(paymentMethodRaw as PaymentMethod))
    return;
  const actor = await getActorUserId();
  if (type === LedgerType.INVOICE && !referenceId) return;
  const row = await prisma.ledger.create({
    data: {
      studentId,
      type: type as LedgerType,
      amount,
      paymentMethod:
        type === LedgerType.PAYMENT ? (paymentMethodRaw as PaymentMethod) : null,
      referenceId: type === LedgerType.INVOICE ? referenceId : null,
      referenceType:
        type === LedgerType.INVOICE ? referenceType || "Invoice" : null,
    },
  });
  await writeAudit(actor, "CREATE", "Ledger", row.id);
  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/");
}
