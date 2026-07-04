import { format } from "date-fns";
import { createClosure, deleteClosure } from "@/app/actions/operations";
import { Card, Input, Label, PageTitle, Submit, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function ClosuresPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const [rows, classes] = await Promise.all([
    prisma.schoolClosure.findMany({
      orderBy: { date: "desc" },
      include: { class: true },
    }),
    prisma.class.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageTitle title={t(m, "closures.title")} subtitle={t(m, "closures.subtitle")} />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
          {t(m, "closures.addClosure")}
        </h2>
        <form action={createClosure} className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>{t(m, "closures.date")}</Label>
            <Input name="date" type="date" required />
          </div>
          <div>
            <Label>{t(m, "closures.classScope")}</Label>
            <select
              name="classId"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t(m, "closures.global")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t(m, "closures.reason")}</Label>
            <Input name="reason" placeholder={t(m, "closures.reasonPlaceholder")} />
          </div>
          <div>
            <Label>{t(m, "closures.paidLabel")}</Label>
            <select
              name="isPaid"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="false">{t(m, "closures.unpaid")}</option>
              <option value="true">{t(m, "closures.paid")}</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <Submit variant="orange">{t(m, "closures.save")}</Submit>
          </div>
        </form>
      </Card>
      <Table
        emptyMessage={t(m, "ui.noRecords")}
        headers={[
          t(m, "closures.colDate"),
          t(m, "closures.colScope"),
          t(m, "closures.colReason"),
          t(m, "closures.colPaid"),
          t(m, "closures.colActions"),
        ]}
        rows={rows.map((c) => [
          format(c.date, "MMM d, yyyy"),
          c.class ? c.class.name : t(m, "closures.allSchool"),
          c.reason ?? "—",
          <span
            key="paid"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              c.isPaid
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {c.isPaid ? t(m, "closures.paid") : t(m, "closures.unpaid")}
          </span>,
          <form key={c.id} action={deleteClosure}>
            <input type="hidden" name="id" value={c.id} />
            <button type="submit" className="text-xs text-red-700 underline dark:text-red-400">
              {t(m, "closures.delete")}
            </button>
          </form>,
        ])}
      />
    </div>
  );
}
