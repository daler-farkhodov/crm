import { format } from "date-fns";
import {
  createRecurringExpense,
  deleteExpense,
  deleteRecurringExpense,
  generateDueRecurringExpenses,
  toggleRecurringExpenseActive,
} from "@/app/actions/operations";
import { AddExpenseForm } from "@/components/AddExpenseForm";
import { Card, Input, Label, PageTitle, Select, Submit, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "one-time" } = await searchParams;
  const locale = await getLocale();
  const m = getMessages(locale);
  const [rows, recurring, expenseTypes, teachers] = await Promise.all([
    prisma.expense.findMany({ orderBy: { date: "desc" }, include: { teacher: true } }),
    prisma.recurringExpense.findMany({ orderBy: { createdAt: "desc" }, include: { expenseType: true } }),
    prisma.expenseType.findMany({ orderBy: { name: "asc" } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  const isRecurring = tab === "recurring";

  const tabLink = (to: string, label: string) => {
    const active = tab === to;
    return (
      <a
        href={`?tab=${to}`}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        {label}
      </a>
    );
  };

  return (
    <div>
      <PageTitle title={t(m, "expenses.title")} subtitle={t(m, "expenses.subtitle")} />

      {/* Tab bar */}
      <div className="mb-6 flex gap-2">
        {tabLink("one-time", t(m, "expenses.tabOneTime"))}
        {tabLink("recurring", t(m, "expenses.tabRecurring"))}
      </div>

      {!isRecurring && (
        <>
          <Card className="mb-8">
            <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t(m, "expenses.addExpense")}
            </h2>
            <AddExpenseForm
              teachers={teachers}
              labels={{
                titleField: t(m, "expenses.titleField"),
                amount: t(m, "expenses.amount"),
                date: t(m, "expenses.date"),
                teacher: t(m, "expenses.teacher"),
                teacherNone: t(m, "expenses.teacherNone"),
                deductMonth: t(m, "expenses.deductMonth"),
                deductYear: t(m, "expenses.deductYear"),
                teacherHint: t(m, "expenses.teacherHint"),
                paymentMethod: t(m, "ledger.paymentMethod"),
                save: t(m, "expenses.save"),
              }}
            />
          </Card>
          <Table
            emptyMessage={t(m, "ui.noRecords")}
            headers={[
              t(m, "expenses.colDate"),
              t(m, "expenses.colTitle"),
              t(m, "expenses.colTeacher"),
              t(m, "expenses.colAmount"),
              t(m, "expenses.colActions"),
            ]}
            rows={rows.map((e) => [
              format(e.date, "MMM d, yyyy"),
              e.title,
              e.teacher?.fullName ?? "—",
              e.amount.toFixed(2),
              e.isDeducted ? (
                <span key="deducted" className="text-xs text-slate-400">
                  {t(m, "expenses.deducted")}
                </span>
              ) : (
                <form key={e.id} action={deleteExpense}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className="text-xs text-red-700 underline dark:text-red-400">
                    {t(m, "expenses.delete")}
                  </button>
                </form>
              ),
            ])}
          />
        </>
      )}

      {isRecurring && (
        <>
          <Card className="mb-8">
            <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t(m, "expenses.addRecurring")}
            </h2>
            <form action={createRecurringExpense} className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label>{t(m, "expenses.titleField")}</Label>
                <Input name="title" required />
              </div>
              <div>
                <Label>{t(m, "expenses.amount")}</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <div>
                <Label>{t(m, "expenses.interval")}</Label>
                <Select name="interval" required>
                  <option value="WEEKLY">{t(m, "expenses.intervalWeekly")}</option>
                  <option value="BIWEEKLY">{t(m, "expenses.intervalBiweekly")}</option>
                  <option value="MONTHLY">{t(m, "expenses.intervalMonthly")}</option>
                </Select>
              </div>
              <div>
                <Label>{t(m, "expenses.nextDue")}</Label>
                <Input name="nextDueDate" type="date" required />
              </div>
              <div>
                <Label>{t(m, "expenses.category")}</Label>
                <Select name="expenseTypeId">
                  <option value="">{t(m, "expenses.categoryNone")}</option>
                  {expenseTypes.map((et) => (
                    <option key={et.id} value={et.id}>{et.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end md:col-span-4">
                <Submit variant="blue">{t(m, "expenses.save")}</Submit>
              </div>
            </form>
          </Card>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t(m, "expenses.recurringList")}
            </h2>
            <form action={generateDueRecurringExpenses}>
              <Submit variant="orange">{t(m, "expenses.generateDue")}</Submit>
            </form>
          </div>

          <Table
            emptyMessage={t(m, "ui.noRecords")}
            headers={[
              t(m, "expenses.colTitle"),
              t(m, "expenses.colAmount"),
              t(m, "expenses.interval"),
              t(m, "expenses.nextDue"),
              t(m, "expenses.colCategory"),
              t(m, "expenses.colStatus"),
              t(m, "expenses.colActions"),
            ]}
            rows={recurring.map((r) => [
              r.title,
              r.amount.toFixed(2),
              r.interval,
              format(r.nextDueDate, "MMM d, yyyy"),
              r.expenseType?.name ?? "—",
              <span
                key="status"
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  r.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {r.isActive ? t(m, "expenses.active") : t(m, "expenses.paused")}
              </span>,
              <div key="actions" className="flex gap-3">
                <form action={toggleRecurringExpenseActive}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                  <button type="submit" className="text-xs text-blue-700 underline dark:text-blue-400">
                    {r.isActive ? t(m, "expenses.pause") : t(m, "expenses.resume")}
                  </button>
                </form>
                <form action={deleteRecurringExpense}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="text-xs text-red-700 underline dark:text-red-400">
                    {t(m, "expenses.delete")}
                  </button>
                </form>
              </div>,
            ])}
          />
        </>
      )}
    </div>
  );
}
