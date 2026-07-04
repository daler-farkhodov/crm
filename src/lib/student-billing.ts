import { InvoiceStatus, Prisma, PrismaClient } from "@prisma/client";
import { startOfDay } from "date-fns";
import { countSessionsBetween, nthScheduledSessionDate } from "@/lib/billing-cycle";
import { prisma } from "@/lib/prisma";

/**
 * Sets nextPaymentDue to the latest (among active classes) date of the 3rd scheduled session
 * after each class's enrollment start — but only if the student has no pending/paid invoices yet.
 * After the first invoice, `nextPaymentDue` is driven only by billing actions.
 */
export async function refreshStudentNextPaymentDue(studentId: string) {
  const invCount = await prisma.invoice.count({
    where: {
      studentId,
      status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PAID] },
    },
  });
  if (invCount > 0) return;

  const rows = await prisma.studentClass.findMany({
    where: { studentId, endDate: null },
    include: { class: true },
  });

  if (rows.length === 0) {
    await prisma.student.update({
      where: { id: studentId },
      data: { nextPaymentDue: null },
    });
    return;
  }

  const thirdDates: Date[] = [];
  for (const sc of rows) {
    const d = nthScheduledSessionDate(sc.startDate, sc.class.scheduleDays, 3);
    if (d) thirdDates.push(d);
  }

  if (thirdDates.length === 0) {
    await prisma.student.update({
      where: { id: studentId },
      data: { nextPaymentDue: null },
    });
    return;
  }

  const nextDue = new Date(Math.max(...thirdDates.map((d) => d.getTime())));
  await prisma.student.update({
    where: { id: studentId },
    data: { nextPaymentDue: startOfDay(nextDue) },
  });
}

/**
 * Item 15: refund for the unused remainder of an enrollment ending mid-period.
 * Finds the invoice (PAID or PENDING) covering endDate and prorates the
 * sessions after endDate against the period's total sessions. Returns 0 if
 * the enrollment is free or no covering invoice exists. Shared by
 * endEnrollment and transferStudent so the math stays in one place.
 */
export async function computeEarlyDropRefund(
  db: Prisma.TransactionClient | PrismaClient,
  sc: {
    studentId: string;
    classId: string;
    customRate: number | null;
    isFree: boolean;
    class: { pricePerMonth: number; scheduleDays: string[] };
  },
  endDate: Date,
): Promise<number> {
  if (sc.isFree) return 0;

  const activeInvoice = await db.invoice.findFirst({
    where: {
      studentId: sc.studentId,
      status: { in: [InvoiceStatus.PAID, InvoiceStatus.PENDING] },
      periodStart: { lte: endDate },
      periodEnd: { gte: endDate },
    },
    orderBy: { periodStart: "desc" },
  });
  if (!activeInvoice) return 0;

  const rate = sc.customRate ?? sc.class.pricePerMonth;
  const periodStart = activeInvoice.periodStart;
  const periodEnd = activeInvoice.periodEnd;

  const closures = await db.schoolClosure.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      OR: [{ classId: sc.classId }, { classId: null }],
    },
    select: { date: true, isPaid: true },
  });

  const totalSessions = countSessionsBetween(sc.class.scheduleDays, periodStart, periodEnd, closures);
  const refundSessions = countSessionsBetween(
    sc.class.scheduleDays,
    new Date(endDate.getTime() + 86_400_000), // day after end
    periodEnd,
    closures,
  );

  if (totalSessions === 0 || refundSessions === 0) return 0;
  const refundAmount = (refundSessions / totalSessions) * rate;
  return refundAmount > 0.01 ? Math.round(refundAmount * 100) / 100 : 0;
}
