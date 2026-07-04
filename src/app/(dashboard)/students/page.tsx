import Link from "next/link";
import { Suspense } from "react";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { AddStudentModal } from "@/components/AddStudentModal";
import { DeleteStudentButton } from "@/components/DeleteStudentButton";
import { StudentActiveToggle } from "@/components/StudentActiveToggle";
import { StudentFilters } from "@/components/StudentFilters";
import { StudentsCsvExport } from "@/components/StudentsCsvExport";
import { PageTitle } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import {
  buildStudentWhere,
  debtStudentIdsFromLedger,
  type StudentSearchParams,
} from "@/lib/student-list";
import { prisma } from "@/lib/prisma";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<StudentSearchParams>;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const sp = await searchParams;

  const [classes, ledgerSums, activeCount, totalCount] = await Promise.all([
    prisma.class.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.ledger.groupBy({
      by: ["studentId"],
      _sum: { amount: true },
    }),
    prisma.student.count({ where: { isActive: true } }),
    prisma.student.count(),
  ]);

  const debtIds = debtStudentIdsFromLedger(ledgerSums);
  const debtCount = debtIds.length;
  const where = buildStudentWhere(sp, debtIds);

  const rows = await prisma.student.findMany({
    where,
    orderBy: { studentNumber: "asc" },
    include: {
      classes: {
        where: { endDate: null },
        include: { class: true },
        orderBy: { startDate: "asc" },
      },
    },
  });

  const balanceMap = Object.fromEntries(
    ledgerSums.map((g) => [g.studentId, g._sum.amount ?? 0]),
  );

  const activeTab =
    sp.debts === "1" ? "debt" : sp.tab === "all" ? "all" : "active";

  const metricCard =
    "rounded-xl border p-4 shadow-sm transition hover:shadow";
  const metricCardActive =
    `${metricCard} border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40`;
  const metricCardInactive =
    `${metricCard} border-slate-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/50`;

  return (
    <div>
      <PageTitle
        title={t(m, "students.title")}
        subtitle={t(m, "students.subtitle")}
        action={<AddStudentModal classes={classes} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Link href="/students?status=active" className={activeTab === "active" ? metricCardActive : metricCardInactive}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(m, "students.metricActive")}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
            {t(m, "students.metricActiveHint")}
          </p>
        </Link>
        <Link href="/students?tab=all" className={activeTab === "all" ? metricCardActive : metricCardInactive}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(m, "students.metricAll")}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalCount}
          </p>
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
            {t(m, "students.metricAllHint")}
          </p>
        </Link>
        <Link href="/students?debts=1" className={activeTab === "debt" ? metricCardActive : metricCardInactive}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(m, "students.metricDebts")}
          </p>
          <p className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {debtCount}
          </p>
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
            {t(m, "students.metricDebtsHint")}
          </p>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t(m, "students.allStudents")}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Suspense
              fallback={
                <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              }
            >
              <StudentFilters classes={classes} />
            </Suspense>
            <Suspense fallback={null}>
              <StudentsCsvExport />
            </Suspense>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                {[
                  t(m, "students.colId"),
                  t(m, "students.colName"),
                  "Phone",
                  t(m, "students.colClass"),
                  t(m, "students.colStart"),
                  t(m, "students.colActive"),
                  t(m, "students.colBalance"),
                  t(m, "students.colActions"),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    {t(m, "students.noMatch")}
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const activeEnroll = s.classes;
                  const classLabel =
                    activeEnroll.map((c) => c.class.name).join(", ") || "—";
                  const startInClass =
                    activeEnroll[0]?.startDate ?? s.startDate;
                  const bal = balanceMap[s.id] ?? 0;
                  const balanceLabel = `${bal < 0 ? "-" : ""}$${Math.abs(bal).toFixed(0)}`;
                  // positive bal = prepaid credit (good), negative = owes (needs invoice)
                  const balanceClass =
                    bal > 0
                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                      : bal < 0
                        ? "font-medium text-orange-600 dark:text-orange-400"
                        : "font-medium text-slate-500 dark:text-slate-400";

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-slate-700 dark:text-slate-300">
                        #{s.studentNumber}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <Link
                          href={`/students/${s.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {s.fullName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-400">
                        {s.phone ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="max-w-[200px] truncate px-5 py-4 text-slate-600 dark:text-slate-400">
                        {classLabel}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-400">
                        {format(startInClass, "M/d/yyyy")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <StudentActiveToggle id={s.id} isActive={s.isActive} />
                      </td>
                      <td className={`whitespace-nowrap px-5 py-4 ${balanceClass}`}>
                        {balanceLabel}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/students/${s.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Eye className="h-4 w-4" />
                            {t(m, "students.view")}
                          </Link>
                          <DeleteStudentButton
                            studentId={s.id}
                            balance={bal}
                            label={t(m, "students.delete")}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
