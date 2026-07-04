import { expect, test } from "@playwright/test";

test.describe("Student enrollment lifecycle", () => {
  test("custom rate, free toggle, and end enrollment update the detail page", async ({
    page,
  }) => {
    const name = `E2E Lifecycle ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await page.goto("/students");
    await page.getByRole("button", { name: "Add Student" }).click();
    await page.getByPlaceholder("Jordan Lee").fill(name);
    await page.locator('input[type="date"]').first().fill("2026-04-01");
    await page.getByRole("button", { name: "Create student" }).click();
    await expect(page).toHaveURL(/\/students\/[^/]+$/);

    // Set a custom rate below the standard price and confirm the badge appears.
    // Scoped to this form: a separate "mark as free" form also carries a
    // hidden customRate field, making the bare input locator ambiguous.
    const rateForm = page.locator("form", {
      has: page.getByRole("button", { name: "Set rate" }),
    });
    await rateForm.locator('input[name="customRate"]').fill("50");
    await rateForm.getByRole("button", { name: "Set rate" }).click();
    await expect(page.getByText(/Custom rate|Below rate/)).toBeVisible();

    // Mark the enrollment as free.
    // exact: true avoids matching the "Mark as free"/"Mark as paying" button
    // labels, which otherwise substring-collide with the "Free" badge text.
    await page.getByRole("button", { name: "Mark as free" }).click();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();

    // Revert to paying so end-enrollment refund logic (isFree students are skipped) isn't hit.
    await page.getByRole("button", { name: "Mark as paying" }).click();
    await expect(page.getByText("Free", { exact: true })).toHaveCount(0);

    // End the enrollment.
    await page.locator('input[name="endDate"]').fill("2026-04-15");
    await page.getByRole("button", { name: "End enrollment" }).click();

    await expect(page.getByText("No active enrollments.")).toBeVisible();
    await expect(page.getByText("Ended: 15 Apr 2026")).toBeVisible();
  });
});
