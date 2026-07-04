import { expect, test } from "@playwright/test";

test.describe("Expenses", () => {
  test("add and delete a one-time expense", async ({ page }) => {
    const title = `E2E Expense ${Date.now()}`;
    await page.goto("/expenses");

    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="amount"]').fill("42.75");
    await page.locator('input[name="date"]').fill("2026-06-15");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/expenses");

    const row = page.locator("tr", { hasText: title });
    await expect(row).toContainText("42.75");

    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: title })).toHaveCount(0);
  });

  test("a due recurring expense can be generated into a one-time expense", async ({
    page,
  }) => {
    const title = `E2E Recurring ${Date.now()}`;
    await page.goto("/expenses?tab=recurring");

    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="amount"]').fill("19.99");
    await page.locator('select[name="interval"]').selectOption("MONTHLY");
    await page.locator('input[name="nextDueDate"]').fill("2020-01-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/tab=recurring/);

    const recurringRow = page.locator("tr", { hasText: title });
    await expect(recurringRow).toContainText("Jan 1, 2020");

    await page.getByRole("button", { name: "Generate due" }).click();
    await expect(page).toHaveURL(/tab=recurring/);

    // nextDueDate should have advanced to a date after the original due date.
    await expect(page.locator("tr", { hasText: title })).not.toContainText(
      "Jan 1, 2020",
    );

    await page.goto("/expenses");
    // Every overdue occurrence shares the same title, so many rows can
    // legitimately match — just confirm at least one was materialized.
    const generatedRow = page.locator("tr", { hasText: title }).first();
    await expect(generatedRow).toContainText("19.99");
  });
});
