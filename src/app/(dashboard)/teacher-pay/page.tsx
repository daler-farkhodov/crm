import { format } from "date-fns";
import {
  applyAttendanceFines,
  createTeacherEarning,
  deleteTeacherFine,
  generateTeacherSalaries,
  waiverTeacherFine,
} from "@/app/actions/operations";
import { Card, Input, Label, PageTitle, Select, Submit, Table } from "@/components/ui";
import { TeacherEarningPaidToggle } from "@/components/TeacherEarningPaidToggle";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function TeacherPayPage() {
  const locale = await getLocale();
  const m = getMessages(locale);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [rows, teachers, expenses, fines, balances] = await Promise.all([
    prisma.teacherEarnings.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { teacher: true },
    }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
    prisma.expense.findMany({
      where: { teacherId: { not: null } },
      orderBy: { date: "desc" },
      include: { teacher: true },
    }),
    prisma.teacherFine.findMany({
      orderBy: { date: "desc" },
      include: { teacher: true },
    }),
    prisma.teacherLedger.groupBy({
      by: ["teacherId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const balanceByTeacher = new Map(balances.map((b) => [b.teacherId, b._sum.amount ?? 0]));

  return (
    <div className="space-y-10">
      <PageTitle title={t(m, "teacherPay.title")} subtitle={t(m, "teacherPay.subtitle")} />

      {/* Live current-month balance */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
          {t(m, "teacherPay.balanceTitle")}
        </h2>
        <Table
          emptyMessage={t(m, "ui.noRecords")}
          headers={[t(m, "teacherPay.colTeacher"), t(m, "teacherPay.colBalance")]}
          rows={teachers.map((tc) => [
            tc.fullName,
            (balanceByTeacher.get(tc.id) ?? 0).toFixed(2),
          ])}
        />
        <Card className="mt-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t(m, "teacherPay.settleTitle")}
          </h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {t(m, "teacherPay.settleHint")}
          </p>
          <form action={generateTeacherSalaries} className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>{t(m, "teacherPay.month")}</Label>
              <Input name="month" type="number" min={1} max={12} defaultValue={now.getMonth() + 1} required />
            </div>
            <div>
              <Label>{t(m, "teacherPay.year")}</Label>
              <Input name="year" type="number" min={2000} max={2100} defaultValue={now.getFullYear()} required />
            </div>
            <div className="flex items-end">
              <Submit variant="orange">{t(m, "teacherPay.settleBtn")}</Submit>
            </div>
          </form>
        </Card>
      </section>

      {/* Earnings */}
      <section>
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t(m, "teacherPay.addAccrual")}
          </h2>
          <form action={createTeacherEarning} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label>{t(m, "teacherPay.teacher")}</Label>
              <Select name="teacherId" required>
                {teachers.map((tc) => (
                  <option key={tc.id} value={tc.id}>{tc.fullName}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t(m, "teacherPay.month")}</Label>
              <Input name="month" type="number" min={1} max={12} required />
            </div>
            <div>
              <Label>{t(m, "teacherPay.year")}</Label>
              <Input name="year" type="number" min={2000} max={2100} required />
            </div>
            <div>
              <Label>{t(m, "teacherPay.amount")}</Label>
              <Input name="totalAmount" type="number" step="0.01" required />
            </div>
            <div className="sm:col-span-4">
              <Submit variant="orange">{t(m, "teacherPay.save")}</Submit>
            </div>
          </form>
        </Card>
        <Table
          emptyMessage={t(m, "ui.noRecords")}
          headers={[
            t(m, "teacherPay.colTeacher"),
            t(m, "teacherPay.colPeriod"),
            t(m, "teacherPay.colAmount"),
            t(m, "teacherPay.colPaid"),
            t(m, "teacherPay.colToggle"),
          ]}
          rows={rows.map((r) => [
            r.teacher.fullName,
            `${r.month}/${r.year}`,
            r.totalAmount.toFixed(2),
            r.isPaid ? t(m, "teacherPay.yes") : t(m, "teacherPay.no"),
            <TeacherEarningPaidToggle
              key={r.id}
              id={r.id}
              isPaid={r.isPaid}
              totalAmount={r.totalAmount}
              markPaidLabel={t(m, "teacherPay.markPaid")}
              markUnpaidLabel={t(m, "teacherPay.markUnpaid")}
            />,
          ])}
        />
      </section>

      {/* Advances (read-only, sourced from /expenses) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
          {t(m, "teacherPay.advancesTitle")}
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {t(m, "teacherPay.advancesHint")}
        </p>
        <Table
          emptyMessage={t(m, "ui.noRecords")}
          headers={[
            t(m, "teacherPay.colTeacher"),
            t(m, "teacherPay.colAmount"),
            t(m, "teacherPay.advanceDate"),
            t(m, "teacherPay.deductPeriod"),
            t(m, "teacherPay.colDeducted"),
            t(m, "teacherPay.advanceNote"),
          ]}
          rows={expenses.map((a) => [
            a.teacher?.fullName ?? "—",
            a.amount.toFixed(2),
            format(a.date, "MMM d, yyyy"),
            a.deductMonth && a.deductYear ? `${a.deductMonth}/${a.deductYear}` : "—",
            <span
              key="deducted"
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                a.isDeducted
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {a.isDeducted ? t(m, "teacherPay.deducted") : t(m, "teacherPay.pending")}
            </span>,
            a.note ?? "—",
          ])}
        />
      </section>

      {/* Fines (Item 10) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
          {t(m, "teacherPay.finesTitle")}
        </h2>
        <Card className="mb-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t(m, "teacherPay.applyFines")}
          </h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {t(m, "teacherPay.finesHint")}
          </p>
          <form action={applyAttendanceFines} className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>{t(m, "teacherPay.checkDate")}</Label>
              <Input name="checkDate" type="date" required />
            </div>
            <div>
              <Label>{t(m, "teacherPay.fineAmount")}</Label>
              <Input name="fineAmount" type="number" step="0.01" required />
            </div>
            <div className="flex items-end">
              <Submit variant="orange">{t(m, "teacherPay.applyFinesBtn")}</Submit>
            </div>
          </form>
        </Card>
        <Table
          emptyMessage={t(m, "ui.noRecords")}
          headers={[
            t(m, "teacherPay.colTeacher"),
            t(m, "teacherPay.colDate"),
            t(m, "teacherPay.colAmount"),
            t(m, "teacherPay.fineReason"),
            t(m, "teacherPay.colWaived"),
            t(m, "teacherPay.colActions"),
          ]}
          rows={fines.map((f) => [
            f.teacher.fullName,
            format(f.date, "MMM d, yyyy"),
            f.amount.toFixed(2),
            f.reason ?? "—",
            <span
              key="waived"
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                f.isWaived
                  ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {f.isWaived ? t(m, "teacherPay.waived") : t(m, "teacherPay.active")}
            </span>,
            <div key="actions" className="flex gap-3">
              <form action={waiverTeacherFine}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="isWaived" value={f.isWaived ? "false" : "true"} />
                <button type="submit" className="text-xs text-blue-700 underline dark:text-blue-400">
                  {f.isWaived ? t(m, "teacherPay.reinstate") : t(m, "teacherPay.waive")}
                </button>
              </form>
              <form action={deleteTeacherFine}>
                <input type="hidden" name="id" value={f.id} />
                <button type="submit" className="text-xs text-red-700 underline dark:text-red-400">
                  {t(m, "expenses.delete")}
                </button>
              </form>
            </div>,
          ])}
        />
      </section>
    </div>
  );
}
