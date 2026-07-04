import { Suspense } from "react";
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { PageTitle } from "@/components/ui";
import { AccountingTabs, type IncomeRow, type ExpenseRow } from "@/components/AccountingTabs";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";
import type { ChartPoint } from "@/components/AccountingChart";

type SearchParams = {
  tab?: string;
  from?: string;
  to?: string;
  class?: string;
  teacher?: string;
  type?: string;
  q?: string;
};

// default: current month
function defaultFrom() {
  return format(startOfMonth(new Date()), "yyyy-MM-dd");
}
function defaultTo() {
  return format(endOfMonth(new Date()), "yyyy-MM-dd");
}

async function AccountingContent({ sp }: { sp: SearchParams }) {
  const from = sp.from ? new Date(sp.from) : startOfMonth(new Date());
  const to = sp.to ? new Date(sp.to + "T23:59:59") : endOfMonth(new Date());

  const [
    paidInvoices,
    pendingInvoices,
    expenses,
    teacherEarnings,
    expenseTypes,
    classes,
    teachers,
    paidInvoiceLines,
    ledgerByMethod,
  ] = await Promise.all([
    // Paid invoices in range — include student + their active class enrollments
    prisma.invoice.findMany({
      where: {
        status: "PAID",
        createdAt: { gte: from, lte: to },
      },
      include: {
        student: {
          include: {
            classes: {
              include: { class: true },
              orderBy: { startDate: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Pending invoices for outstanding debt
    prisma.invoice.aggregate({
      where: { status: "PENDING" },
      _sum: { finalAmount: true },
    }),
    // Expenses in range
    prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      include: { expenseType: true },
      orderBy: { date: "desc" },
    }),
    // Teacher earnings in range (by createdAt)
    prisma.teacherEarnings.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { teacher: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expenseType.findMany({ orderBy: { name: "asc" } }),
    prisma.class.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    // InvoiceLine rows for paid invoices in range — drives income-by-class
    // (a correction invoice's negative line nets out of its original class
    // automatically, no separate correction handling needed here).
    prisma.invoiceLine.findMany({
      where: { invoice: { status: "PAID", createdAt: { gte: from, lte: to } } },
      include: { class: true },
    }),
    // §3.8: incoming money by method — PAYMENT/ADJUSTMENT ledger rows tagged
    // with a paymentMethod (ADJUSTMENT rows from correction invoices are
    // negative, so they net out of the incoming total automatically).
    prisma.ledger.groupBy({
      by: ["paymentMethod"],
      where: {
        type: { in: ["PAYMENT", "ADJUSTMENT"] },
        paymentMethod: { not: null },
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
  ]);

  // ── Teacher filter on invoices (filter by teacher whose class the student is in) ──
  const teacherFilter = sp.teacher ?? "";
  const filteredInvoices = teacherFilter
    ? paidInvoices.filter((inv) =>
        inv.student.classes.some((sc) =>
          // we'd need to know which teacher is in the class — approximate via classes + teachers
          // For now filter by classId that has the teacher
          true, // teacher filter applied client-side via class membership
        ),
      )
    : paidInvoices;

  // ── Income rows ──────────────────────────────────────────────────────────
  // Correction ("rewritten") invoices don't represent new income — their
  // finalAmount is the retained sliver of the original invoice, already
  // counted when that original was paid. What actually moves the needle here
  // is returnedAmount, posted as a negative row once the correction itself
  // is marked PAID (i.e. the money was physically handed back).
  const incomeRows: IncomeRow[] = filteredInvoices.map((inv) => {
    const activeClasses = inv.student.classes
      .filter((sc) => !sc.endDate || sc.endDate >= inv.periodStart)
      .map((sc) => sc.class.name);
    const isCorrection = inv.originalInvoiceId !== null;
    return {
      id: inv.id,
      studentName: inv.student.fullName,
      classes: (activeClasses.join(", ") || "—") + (isCorrection ? " (correction)" : ""),
      amount: isCorrection ? -(inv.returnedAmount ?? 0) : inv.finalAmount,
      date: inv.createdAt.toISOString(),
    };
  });

  // ── Expense rows (manual expenses + teacher salaries) ────────────────────
  const expenseRows: ExpenseRow[] = [
    ...expenses.map((e): ExpenseRow => ({
      id: e.id,
      title: e.expenseType?.name ?? e.title,
      typeName: e.expenseType?.name ?? "Other",
      amount: e.amount,
      note: e.note,
      date: e.date.toISOString(),
      isTeacherSalary: false,
    })),
    ...teacherEarnings.map((te): ExpenseRow => ({
      id: `te-${te.id}`,
      title: te.teacher.fullName,
      typeName: "Teacher salary",
      amount: te.totalAmount,
      note: `${te.month}/${te.year} — ${te.isPaid ? "paid" : "pending"}`,
      date: te.createdAt.toISOString(),
      isTeacherSalary: true,
      teacherEarningId: te.id,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Totals ───────────────────────────────────────────────────────────────
  // income = sum(finalAmount of PAID invoices with no originalInvoiceId)
  //        − sum(returnedAmount of PAID correction invoices)
  const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);
  const outstandingDebt = pendingInvoices._sum.finalAmount ?? 0;

  // ── Income by class ──────────────────────────────────────────────────────
  // sum(InvoiceLine.amount) grouped by class — a correction invoice's
  // negative line automatically nets out of its original class's total.
  const classIncomeMap = new Map<string, number>();
  for (const line of paidInvoiceLines) {
    classIncomeMap.set(
      line.class.name,
      (classIncomeMap.get(line.class.name) ?? 0) + line.amount,
    );
  }
  const incomeByClass = [...classIncomeMap.entries()]
    .map(([className, total]) => ({ className, total }))
    .sort((a, b) => b.total - a.total);

  // ── Cash / Transfer KPIs (§3.8) ─────────────────────────────────────────
  // Incoming: PAYMENT/ADJUSTMENT ledger rows by paymentMethod (fetched above).
  // Outgoing: Expense + paid TeacherEarnings amounts by paymentMethod/split.
  const incomingByMethod = { CASH: 0, TRANSFER: 0 };
  for (const g of ledgerByMethod) {
    if (g.paymentMethod === "CASH" || g.paymentMethod === "TRANSFER") {
      incomingByMethod[g.paymentMethod] += g._sum.amount ?? 0;
    }
  }
  let outgoingCash = 0;
  let outgoingTransfer = 0;
  for (const e of expenses) {
    if (e.isSplit) {
      outgoingCash += e.cashAmount ?? 0;
      outgoingTransfer += e.transferAmount ?? 0;
    } else if (e.paymentMethod === "TRANSFER") {
      outgoingTransfer += e.amount;
    } else {
      outgoingCash += e.amount;
    }
  }
  for (const te of teacherEarnings) {
    if (!te.isPaid) continue;
    if (te.isSplit) {
      outgoingCash += te.cashAmount ?? 0;
      outgoingTransfer += te.transferAmount ?? 0;
    } else if (te.paymentMethod === "TRANSFER") {
      outgoingTransfer += te.totalAmount;
    } else {
      outgoingCash += te.totalAmount;
    }
  }
  const cashNet = incomingByMethod.CASH - outgoingCash;
  const transferNet = incomingByMethod.TRANSFER - outgoingTransfer;

  // ── Chart data (monthly breakdown) ──────────────────────────────────────
  // Use a wider window — last 6 months or whatever the selected range spans
  const chartFrom = from < subMonths(new Date(), 5) ? from : subMonths(endOfMonth(new Date()), 5);
  const months = eachMonthOfInterval({ start: chartFrom, end: to });

  // fetch monthly income — net of correction invoices' returnedAmount
  const [monthlyIncomeSums, monthlyExpenseSums] = await Promise.all([
    Promise.all(
      months.map(async (m) => {
        const [original, corrections] = await Promise.all([
          prisma.invoice.aggregate({
            where: {
              status: "PAID",
              originalInvoiceId: null,
              createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) },
            },
            _sum: { finalAmount: true },
          }),
          prisma.invoice.aggregate({
            where: {
              status: "PAID",
              originalInvoiceId: { not: null },
              createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) },
            },
            _sum: { returnedAmount: true },
          }),
        ]);
        return (original._sum.finalAmount ?? 0) - (corrections._sum.returnedAmount ?? 0);
      }),
    ),
    Promise.all(
      months.map((m) =>
        Promise.all([
          prisma.expense.aggregate({
            where: { date: { gte: startOfMonth(m), lte: endOfMonth(m) } },
            _sum: { amount: true },
          }),
          prisma.teacherEarnings.aggregate({
            where: { createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) } },
            _sum: { totalAmount: true },
          }),
        ]),
      ),
    ),
  ]);

  const chartData: ChartPoint[] = months.map((m, i) => ({
    label: format(m, "MMM yy"),
    income: monthlyIncomeSums[i],
    expenses:
      (monthlyExpenseSums[i][0]._sum.amount ?? 0) +
      (monthlyExpenseSums[i][1]._sum.totalAmount ?? 0),
  }));

  return (
    <AccountingTabs
      incomeRows={incomeRows}
      expenseRows={expenseRows}
      chartData={chartData}
      incomeByClass={incomeByClass}
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      outstandingDebt={outstandingDebt}
      cashNet={cashNet}
      transferNet={transferNet}
      expenseTypes={expenseTypes}
      classes={classes}
      teachers={teachers}
      defaultDateFrom={defaultFrom()}
      defaultDateTo={defaultTo()}
    />
  );
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const sp = await searchParams;

  return (
    <div>
      <PageTitle title={t(m, "accounting.title")} subtitle={t(m, "accounting.subtitle")} />
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        }
      >
        <AccountingContent sp={sp} />
      </Suspense>
    </div>
  );
}
