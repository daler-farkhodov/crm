import { PrismaClient, SalaryType, TeacherLedgerType } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { parseISO, startOfDay } from "date-fns";

// Regression test for createTeacherOverride's retroactive-reconciliation fix:
// creating an override for a date that already has posted TeacherLedger
// ACCRUAL rows (i.e. attendance was logged before the override existed) must
// move the existing accrual from the original teacher to the substitute, not
// just redirect future postings. See reconcilePastAccrualForOverride in
// src/app/actions/classes.ts.
const prisma = new PrismaClient();

test.describe("Teacher substitution — retroactive reconciliation", () => {
  test("recording an override after the fact moves the existing accrual to the substitute", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const original = await prisma.teacher.create({ data: { fullName: `E2E Original ${suffix}` } });
    const sub = await prisma.teacher.create({ data: { fullName: `E2E Substitute ${suffix}` } });
    const cls = await prisma.class.create({
      data: { name: `E2E Sub Class ${suffix}`, pricePerMonth: 200, scheduleDays: ["TUE", "THU"] },
    });
    await prisma.classTeacher.create({
      data: { classId: cls.id, teacherId: original.id, salaryType: SalaryType.PERCENTAGE, percentage: 100 },
    });
    // Match the app's date parsing (startOfDay(parseISO(...)), same as
    // createAttendance/cancelClass/createTeacherOverride) rather than
    // `new Date("2026-08-04")`, which parses as UTC midnight and would not
    // equal the override's local-midnight date outside a UTC server TZ.
    const subDate = startOfDay(parseISO("2026-08-04")); // a Tuesday
    const student = await prisma.student.create({
      data: { fullName: `E2E Sub Student ${suffix}`, startDate: subDate },
    });
    await prisma.studentClass.create({
      data: { studentId: student.id, classId: cls.id, startDate: subDate },
    });
    const attendance = await prisma.attendance.create({
      data: { studentId: student.id, classId: cls.id, date: subDate, status: "PRESENT", teacherId: original.id },
    });
    // Simulate the accrual postAttendanceDebit would have posted for this
    // PRESENT session, before any override existed.
    await prisma.teacherLedger.create({
      data: {
        teacherId: original.id,
        classId: cls.id,
        date: subDate,
        type: TeacherLedgerType.ACCRUAL,
        amount: 25,
        referenceId: attendance.id,
      },
    });

    try {
      await page.goto(`/classes/${cls.id}`);
      const overrideForm = page.locator("form", { has: page.locator('select[name="originalTeacherId"]') });
      await overrideForm.locator('input[name="date"]').fill("2026-08-04");
      await overrideForm.locator('select[name="originalTeacherId"]').selectOption(original.id);
      await overrideForm.locator('select[name="substituteTeacherId"]').selectOption(sub.id);
      await overrideForm.locator('input[name="reason"]').fill("E2E sick leave");
      await overrideForm.getByRole("button", { name: "Record" }).click();

      await expect(page.locator("tr", { hasText: "E2E sick leave" })).toBeVisible({ timeout: 45000 });

      const rows = await prisma.teacherLedger.findMany({ where: { classId: cls.id, date: subDate } });
      const originalNet = rows.filter((r) => r.teacherId === original.id).reduce((s, r) => s + r.amount, 0);
      const subNet = rows.filter((r) => r.teacherId === sub.id).reduce((s, r) => s + r.amount, 0);
      expect(originalNet).toBeCloseTo(0, 6);
      expect(subNet).toBeCloseTo(25, 6);
    } finally {
      await prisma.teacherLedger.deleteMany({ where: { classId: cls.id } });
      await prisma.classTeacherOverride.deleteMany({ where: { classId: cls.id } });
      await prisma.attendance.deleteMany({ where: { classId: cls.id } });
      await prisma.studentClass.deleteMany({ where: { classId: cls.id } });
      await prisma.classTeacher.deleteMany({ where: { classId: cls.id } });
      await prisma.student.delete({ where: { id: student.id } });
      await prisma.class.delete({ where: { id: cls.id } });
      await prisma.teacher.delete({ where: { id: original.id } });
      await prisma.teacher.delete({ where: { id: sub.id } });
    }
  });
});
