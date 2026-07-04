import { expect, test } from "@playwright/test";

test.describe("Billing & ledger", () => {
  async function createStudent(page: import("@playwright/test").Page) {
    const name = `E2E Billing ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await page.goto("/students");
    await page.getByRole("button", { name: "Add Student" }).click();
    await page.getByPlaceholder("Jordan Lee").fill(name);
    await page.locator('input[type="date"]').first().fill("2026-04-01");
    await page.getByRole("button", { name: "Create student" }).click();
    await expect(page).toHaveURL(/\/students\/[^/]+$/);
    const studentId = page.url().split("/students/")[1];
    return { name, studentId };
  }

  async function postLedgerEntry(
    page: import("@playwright/test").Page,
    opts: { studentName: string; type: "CREDIT" | "DEBIT"; amount: number },
  ) {
    await page.goto("/ledger");
    const optionValue = await page
      .locator('select[name="studentId"] option', { hasText: opts.studentName })
      .getAttribute("value");
    await page.locator('select[name="studentId"]').selectOption(optionValue as string);
    await page.locator('select[name="type"]').selectOption(opts.type);
    await page.locator('input[name="amount"]').fill(String(opts.amount));
    await page.getByRole("button", { name: "Post" }).click();
    // The post form doesn't navigate away, so wait for the new row itself
    // (not just the URL, which never changes) to confirm the write landed.
    await expect(
      page.locator("tr", { hasText: opts.studentName }).filter({ hasText: opts.type }),
    ).toBeVisible();
  }

  test("invoice creation auto-applies prepaid credit up to the class price", async ({
    page,
  }) => {
    const { name } = await createStudent(page);

    // Positive ledger amount = prepaid credit on the student's account.
    await postLedgerEntry(page, { studentName: name, type: "CREDIT", amount: 40 });

    await page.goto("/invoices");
    await page.getByRole("button", { name: "Create invoice" }).click();

    const combobox = page.getByRole("combobox", { name: "Student" });
    await combobox.fill(name);
    await page.getByRole("option", { name: new RegExp(name) }).click();

    // Ledger balance banner should reflect the $40 credit we just posted.
    await expect(page.getByText(/Account balance \(ledger\):/)).toContainText("40.00");

    await page.locator('select').filter({ hasText: "/mo" }).selectOption({ index: 1 });

    const totalInput = page.locator('input[name="totalAmount"]');
    const creditInput = page.locator('input[name="creditApplied"]');
    await expect(creditInput).toHaveValue("40.00");

    const total = Number(await totalInput.inputValue());
    const expectedFinal = (total - 40).toFixed(2);

    await page.getByRole("button", { name: "Create + ledger" }).click();
    await expect(page).toHaveURL("/invoices");

    const row = page.locator("tr", { hasText: name });
    await expect(row).toContainText("40.00");
    await expect(row).toContainText(expectedFinal);
    await expect(row).toContainText("PENDING");
  });

  test("marking an invoice PAID posts a PAYMENT ledger entry that restores balance", async ({
    page,
  }) => {
    const { name } = await createStudent(page);

    await page.goto("/invoices");
    await page.getByRole("button", { name: "Create invoice" }).click();
    const combobox = page.getByRole("combobox", { name: "Student" });
    await combobox.fill(name);
    await page.getByRole("option", { name: new RegExp(name) }).click();
    await page.locator("select").filter({ hasText: "/mo" }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Create + ledger" }).click();
    await expect(page).toHaveURL("/invoices");

    const row = page.locator("tr", { hasText: name });
    await expect(row).toBeVisible();
    const finalAmountText = (await row.locator("td").nth(5).innerText()).trim();

    await row.locator('select[name="status"]').selectOption("PAID");
    await row.getByRole("button", { name: "Save" }).click();
    // Check the plain status column (td index 6), not the whole row — the
    // status <select> itself shows "PAID" optimistically the instant it's
    // chosen, before the server write (and the ledger PAYMENT entry it
    // creates) actually completes.
    await expect(page.locator("tr", { hasText: name }).first().locator("td").nth(6)).toContainText(
      "PAID",
    );

    await page.goto("/ledger");
    const ledgerRow = page.locator("tr", { hasText: name }).first();
    await expect(ledgerRow).toContainText("PAYMENT");
    await expect(ledgerRow).toContainText(finalAmountText);
  });

  test("a student who owes money can generate a due invoice from the delete dialog", async ({
    page,
  }) => {
    const { name } = await createStudent(page);

    // Negative ledger amount = the student owes money.
    await postLedgerEntry(page, { studentName: name, type: "DEBIT", amount: -75 });

    await page.goto("/students");
    const row = page.locator("tr", { hasText: name });
    await expect(row).toContainText("-$75");

    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(/currently owes/)).toBeVisible();
    await expect(page.getByText("$75.00")).toBeVisible();

    // The confirm dialog closes optimistically on submit (before the server
    // action finishes), so wait for the actual POST to complete — otherwise
    // the immediately-following navigation can render before the invoice
    // was actually created.
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.request().method() === "POST" && resp.url().includes("/students"),
      ),
      page.getByRole("button", { name: "Generate Invoice" }).click(),
    ]);

    await page.goto("/invoices");
    // A brand-new student has no prior invoices, so exactly one row should
    // exist for them after generating the due invoice.
    const invoicesAfter = page.locator("tr", { hasText: name });
    await expect(invoicesAfter).toHaveCount(1);
  });
});
