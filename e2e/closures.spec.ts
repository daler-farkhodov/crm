import { expect, test } from "@playwright/test";

test.describe("School closures", () => {
  test("add and delete a global school closure", async ({ page }) => {
    const reason = `E2E Closure ${Date.now()}`;
    await page.goto("/closures");

    await page.locator('input[name="date"]').fill("2026-08-01");
    await page.locator('input[name="reason"]').fill(reason);
    await page.locator('select[name="isPaid"]').selectOption("true");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/closures");

    const row = page.locator("tr", { hasText: reason });
    await expect(row).toContainText("All school");
    await expect(row).toContainText("Paid");

    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: reason })).toHaveCount(0);
  });
});
