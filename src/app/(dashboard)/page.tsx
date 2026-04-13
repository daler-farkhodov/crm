import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const [
    students,
    teachers,
    classes,
    pendingInvoices,
    openTeacherPay,
    expensesMonth,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.invoice.count({ where: { status: "PENDING" } }),
    prisma.teacherEarnings.count({ where: { isPaid: false } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  const tiles = [
    {
      label: "Active students",
      value: students,
      accent: "orange" as const,
    },
    { label: "Teachers", value: teachers, accent: "blue" as const },
    { label: "Classes", value: classes, accent: "orange" as const },
    {
      label: "Pending invoices",
      value: pendingInvoices,
      accent: "blue" as const,
    },
    {
      label: "Unpaid teacher periods",
      value: openTeacherPay,
      accent: "orange" as const,
    },
    {
      label: "Expenses this month",
      value: expensesMonth._sum.amount?.toFixed(0) ?? "0",
      accent: "blue" as const,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Snapshot of enrollment, billing, and payroll health."
        accent="blue"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <Card
            key={t.label}
            className={
              t.accent === "orange"
                ? "border-accent-orange/30 bg-accent-orange-soft/60"
                : "border-accent-blue/30 bg-accent-blue-soft/60"
            }
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {t.value}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
