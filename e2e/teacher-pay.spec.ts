import { expect, test } from "@playwright/test";

test.describe("Teacher pay", () => {
  test("add an earnings accrual and toggle it paid", async ({ page }) => {
    await page.goto("/teacher-pay");

    const form = page.locator('form:has(input[name="totalAmount"])');
    await form.locator('select[name="teacherId"]').selectOption({ index: 0 });
    await form.locator('input[name="month"]').fill("6");
    await form.locator('input[name="year"]').fill("2026");
    await form.locator('input[name="totalAmount"]').fill("555.25");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/teacher-pay");

    const row = page.locator("tr", { hasText: "555.25" });
    await expect(row).toContainText("6/2026");
    await expect(row).toContainText("No");

    // "Mark paid" first reveals a payment-method picker (defaults to Cash)
    // rather than confirming immediately; the same-labeled submit button
    // inside that form is the second, confirming click.
    await row.getByRole("button", { name: "Mark paid" }).click();
    await row.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.locator("tr", { hasText: "555.25" })).toContainText("Yes");
  });

  test("record a teacher advance from Expenses and see it reflected read-only on Teacher pay", async ({
    page,
  }) => {
    // Advances are recorded as teacher-linked expenses on /expenses and
    // deducted immediately; /teacher-pay's Advances list is read-only
    // (see teacherPay.advancesHint), so this exercises that full path
    // rather than a nonexistent add-advance form on /teacher-pay.
    const title = `E2E Advance ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await page.goto("/expenses");

    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="amount"]').fill("100");
    await page.locator('input[name="date"]').fill("2026-06-01");
    await page.locator('select[name="teacherId"]').selectOption({ index: 1 });
    await page.locator('input[name="deductMonth"]').fill("7");
    await page.locator('input[name="deductYear"]').fill("2026");
    await page.getByRole("button", { name: "Save" }).click();
    // The form doesn't navigate away, so the URL check alone doesn't confirm
    // the write landed — wait for the new row itself before navigating off
    // this page, or /teacher-pay can render before the expense exists.
    await expect(page.locator("tr", { hasText: title })).toBeVisible();

    await page.goto("/teacher-pay");
    // The Advances table doesn't render the expense title, and seed data
    // already has its own $100.00 advance — disambiguate on the advance
    // date instead, which this test controls and seed data doesn't share.
    const row = page.locator("tr", { hasText: "100.00" }).filter({ hasText: "Jun 1, 2026" });
    await expect(row).toContainText("7/2026");
    await expect(row).toContainText("Deducted");
  });
});
