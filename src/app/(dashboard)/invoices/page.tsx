import { format } from "date-fns";
import { InvoiceCreateModal } from "@/components/InvoiceCreateModal";
import { InvoiceStatusForm } from "@/components/InvoiceStatusForm";
import { PageTitle, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function InvoicesPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const [invoices, studentsRaw, ledgerSums] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { student: true, originalInvoice: { select: { invoiceNumber: true } } },
    }),
    prisma.student.findMany({
      orderBy: { fullName: "asc" },
      include: {
        classes: {
          where: { endDate: null },
          include: { class: true },
          orderBy: { startDate: "asc" },
        },
      },
    }),
    prisma.ledger.groupBy({
      by: ["studentId"],
      _sum: { amount: true },
    }),
  ]);

  const balanceMap = Object.fromEntries(
    ledgerSums.map((g) => [g.studentId, g._sum.amount ?? 0]),
  );

  const studentsForForm = studentsRaw.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    studentNumber: s.studentNumber,
    balance: balanceMap[s.id] ?? 0,
    classes: s.classes.map((sc) => ({
      classId: sc.classId,
      name: sc.class.name,
      pricePerMonth: sc.class.pricePerMonth,
    })),
  }));

  return (
    <div>
      <PageTitle title={t(m, "invoices.title")} subtitle={t(m, "invoices.subtitle")} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          {t(m, "invoices.newIntro")}
        </p>
        <InvoiceCreateModal students={studentsForForm} />
      </div>
      <Table
        emptyMessage={t(m, "ui.noRecords")}
        headers={[
          t(m, "invoices.colNumber"),
          t(m, "invoices.colStudent"),
          t(m, "invoices.colPeriod"),
          t(m, "invoices.colTotal"),
          t(m, "invoices.colCredit"),
          t(m, "invoices.colFinal"),
          t(m, "invoices.colStatus"),
          t(m, "invoices.colSetStatus"),
        ]}
        rows={invoices.map((inv) => [
          <span key="num" className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
            {inv.originalInvoice
              ? `#${String(inv.originalInvoice.invoiceNumber).padStart(4, "0")}-re`
              : `#${String(inv.invoiceNumber).padStart(4, "0")}`}
            {inv.originalInvoice && (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {t(m, "invoices.correctionBadge")}
              </span>
            )}
          </span>,
          inv.student.fullName,
          `${format(inv.periodStart, "MMM d")} – ${format(inv.periodEnd, "MMM d, yyyy")}`,
          inv.totalAmount.toFixed(2),
          inv.creditApplied.toFixed(2),
          inv.originalInvoice ? (
            <span key="final" className="text-orange-600 dark:text-orange-400">
              {inv.finalAmount.toFixed(2)}
              <span className="ml-1 text-[10px] text-slate-400">
                ({t(m, "invoices.returnedAmount")} ${(inv.returnedAmount ?? 0).toFixed(2)})
              </span>
            </span>
          ) : (
            inv.finalAmount.toFixed(2)
          ),
          inv.status,
          <InvoiceStatusForm
            key={inv.id}
            invoiceId={inv.id}
            currentStatus={inv.status}
            amountToPost={inv.originalInvoice ? inv.returnedAmount ?? 0 : inv.finalAmount}
            saveLabel={t(m, "invoices.save")}
          />,
        ])}
      />
    </div>
  );
}
