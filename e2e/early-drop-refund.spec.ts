import { PrismaClient, InvoiceStatus } from "@prisma/client";
import { expect, test } from "@playwright/test";

// Regression test for the Ledger.referenceId FK bug: Ledger had a hard FK to
// Invoice.id, but endEnrollment's early-drop refund writes a StudentClass.id
// into that same column (referenceType "EarlyDropRefund"). That made every
// refund with a nonzero amount throw P2003 and crash the request. See
// prisma/migrations/20260702130000_drop_ledger_reference_fk.
const prisma = new PrismaClient();

test.describe("Early-drop refund (Ledger.referenceId polymorphic write)", () => {
  test("ending an enrollment mid-period posts a CREDIT refund instead of crashing", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cls = await prisma.class.create({
      data: {
        name: `E2E Refund Class ${suffix}`,
        pricePerMonth: 300,
        scheduleDays: ["MON", "WED", "FRI"],
      },
    });
    const student = await prisma.student.create({
      data: { fullName: `E2E Refund Student ${suffix}`, startDate: new Date("2026-04-06") },
    });
    const sc = await prisma.studentClass.create({
      data: { studentId: student.id, classId: cls.id, startDate: new Date("2026-04-06") },
    });
    // A PAID invoice covering the whole billing period so computeEarlyDropRefund
    // finds it and the refund is nonzero.
    const invoice = await prisma.invoice.create({
      data: {
        studentId: student.id,
        periodStart: new Date("2026-04-06"),
        periodEnd: new Date("2026-05-05"),
        totalAmount: 300,
        creditApplied: 0,
        finalAmount: 300,
        status: InvoiceStatus.PAID,
        lines: { create: { classId: cls.id, amount: 300 } },
      },
    });

    try {
      await page.goto(`/students/${student.id}`);
      // End the enrollment 10 days into the period, leaving unused sessions.
      await page.locator('input[name="endDate"]').fill("2026-04-16");
      await page.getByRole("button", { name: "End enrollment" }).click();

      // Before the fix this request threw P2003 and never reached this state.
      await expect(page.getByText("No active enrollments.")).toBeVisible({ timeout: 45000 });
      await expect(page.getByText("Ended: 16 Apr 2026")).toBeVisible();

      const ledgerRows = await prisma.ledger.findMany({
        where: { studentId: student.id, referenceType: "EarlyDropRefund" },
      });
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]!.referenceId).toBe(sc.id);
      // Refund is posted as a negative CREDIT (nets against prior DEBITs).
      expect(ledgerRows[0]!.amount).toBeLessThan(0);
      // 8 of 13 scheduled MON/WED/FRI sessions remain after Apr 16 in the
      // Apr 6 - May 5 window → 8/13 * 300 ≈ 184.62 refunded.
      expect(Math.abs(ledgerRows[0]!.amount)).toBeCloseTo(184.62, 1);
    } finally {
      await prisma.ledger.deleteMany({ where: { studentId: student.id } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoice.delete({ where: { id: invoice.id } });
      await prisma.studentClass.deleteMany({ where: { classId: cls.id } });
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.class.delete({ where: { id: cls.id } });
    }
  });
});
