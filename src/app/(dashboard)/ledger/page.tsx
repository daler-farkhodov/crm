import { LedgerType } from "@prisma/client";
import { format } from "date-fns";
import { createLedgerEntry } from "@/app/actions/billing";
import { Card, Input, Label, PageTitle, Submit, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function LedgerPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const [entries, students, invoices] = await Promise.all([
    prisma.ledger.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { student: true },
    }),
    prisma.student.findMany({ orderBy: { fullName: "asc" } }),
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { student: true },
    }),
  ]);

  // referenceId is polymorphic (Invoice/Attendance/StudentClass id depending
  // on referenceType) and has no DB-level FK to Invoice — resolve the
  // invoice period label manually, gated on referenceType, instead of via a
  // Prisma relation include.
  const invoiceRefIds = entries
    .filter((e) => e.referenceType === "Invoice" && e.referenceId)
    .map((e) => e.referenceId as string);
  const referencedInvoices = invoiceRefIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceRefIds } },
        select: { id: true, periodStart: true },
      })
    : [];
  const invoiceById = new Map(referencedInvoices.map((i) => [i.id, i]));

  return (
    <div>
      <PageTitle title={t(m, "ledger.title")} subtitle={t(m, "ledger.subtitle")} />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          {t(m, "ledger.manualEntry")}
        </h2>
        <form action={createLedgerEntry} className="grid gap-3 lg:grid-cols-3">
          <div>
            <Label>{t(m, "ledger.student")}</Label>
            <select
              name="studentId"
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t(m, "ledger.type")}</Label>
            <select
              name="type"
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
            >
              {Object.values(LedgerType).map((lt) => (
                <option key={lt} value={lt}>
                  {lt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t(m, "ledger.amountHint")}</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>{t(m, "ledger.paymentMethod")}</Label>
            <select
              name="paymentMethod"
              defaultValue="CASH"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
            >
              <option value="CASH">{t(m, "ledger.cash")}</option>
              <option value="TRANSFER">{t(m, "ledger.transfer")}</option>
            </select>
          </div>
          <div>
            <Label>{t(m, "ledger.invoiceRef")}</Label>
            <select
              name="referenceId"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.student.fullName} · {format(inv.periodStart, "MMM yyyy")} ·{" "}
                  {inv.finalAmount.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t(m, "ledger.referenceNote")}</Label>
            <Input name="referenceType" placeholder="Check #123" />
          </div>
          <div className="flex items-end">
            <Submit variant="blue">{t(m, "ledger.post")}</Submit>
          </div>
        </form>
      </Card>
      <Table
        emptyMessage={t(m, "ui.noRecords")}
        headers={[
          t(m, "ledger.colWhen"),
          t(m, "ledger.colStudent"),
          t(m, "ledger.colType"),
          t(m, "ledger.colAmount"),
          t(m, "ledger.colRef"),
        ]}
        rows={entries.map((e) => {
          const refInvoice =
            e.referenceType === "Invoice" && e.referenceId
              ? invoiceById.get(e.referenceId)
              : undefined;
          return [
            format(e.createdAt, "MMM d, yyyy HH:mm"),
            e.student.fullName,
            e.type,
            e.amount.toFixed(2),
            refInvoice
              ? `${t(m, "ledger.invoicePrefix")} ${format(refInvoice.periodStart, "MMM yyyy")}`
              : e.referenceType ?? "—",
          ];
        })}
      />
    </div>
  );
}
