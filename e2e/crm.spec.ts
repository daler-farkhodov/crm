import { expect, test } from "@playwright/test";

test.describe("LMS CRM", () => {
  test("dashboard loads with module metrics", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Active students")).toBeVisible();
    await expect(page.getByText("Pending invoices")).toBeVisible();
  });

  test("navigation reaches core modules", async ({ page }) => {
    await page.goto("/students");
    await expect(page.getByRole("heading", { name: "Students" })).toBeVisible();

    await page.goto("/classes");
    await expect(page.getByRole("heading", { name: "Classes" })).toBeVisible();

    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await page.goto("/ledger");
    await expect(page.getByRole("heading", { name: "Ledger" })).toBeVisible();
  });

  test("login flow sets session and returns to dashboard", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("student CRUD: create with class then visible in list", async ({
    page,
  }) => {
    await page.goto("/students");
    const name = `E2E Student ${Date.now()}`;
    await page.getByPlaceholder("Jordan Lee").fill(name);
    await page.locator('input[type="date"]').first().fill("2026-04-01");
    await page.getByRole("button", { name: "Create student" }).click();
    await expect(page).toHaveURL(/\/students\/[^/]+$/);
    await page.goto("/students");
    await expect(page.getByRole("link", { name })).toBeVisible();
  });
});
