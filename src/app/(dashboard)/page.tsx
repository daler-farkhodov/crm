import {
  ArrowDownRight,
  Banknote,
  School,
  TrendingUp,
  UserSquare,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  addDays,
  addMonths,
  addYears,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { Suspense } from "react";
import { DashboardDateBar } from "@/components/DashboardDateBar";
import { DashboardStudentCharts } from "@/components/DashboardStudentCharts";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PageTitle } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { isLikelyDbConnectivityIssue } from "@/lib/is-prisma-db-error";
import { prisma } from "@/lib/prisma";

function money(n: number) {
  return `$${n.toFixed(0)}`;
}

type Search = { from?: string; to?: string };

type BucketMode = "day" | "month" | "year";

function pickBucketMode(from: Date, to: Date): BucketMode {
  const days = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
  if (days <= 62) return "day";
  if (days <= 730) return "month";
  return "year";
}

function bucketStart(d: Date, mode: BucketMode): Date {
  if (mode === "day") return startOfDay(d);
  if (mode === "month") return startOfMonth(d);
  return startOfYear(d);
}

function nextBucket(d: Date, mode: BucketMode): Date {
  if (mode === "day") return addDays(d, 1);
  if (mode === "month") return addMonths(d, 1);
  return addYears(d, 1);
}

function bucketKey(d: Date, mode: BucketMode): string {
  if (mode === "day") return format(d, "yyyy-MM-dd");
  if (mode === "month") return format(d, "yyyy-MM");
  return format(d, "yyyy");
}

function bucketLabel(d: Date, mode: BucketMode): string {
  if (mode === "day") return format(d, "MMM d");
  if (mode === "month") return format(d, "MMM yyyy");
  return format(d, "yyyy");
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const sp = await searchParams;
  const now = new Date();
  const defaultFrom = startOfMonth(subMonths(now, 5));
  const defaultTo = endOfDay(now);

  let rangeStart = sp.from?.trim() ? startOfDay(parseISO(sp.from)) : defaultFrom;
  let rangeEnd = sp.to?.trim() ? endOfDay(parseISO(sp.to)) : defaultTo;
  if (Number.isNaN(rangeStart.getTime())) rangeStart = defaultFrom;
  if (Number.isNaN(rangeEnd.getTime())) rangeEnd = defaultTo;
  if (rangeStart > rangeEnd) {
    const t = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = t;
  }

  const barFrom = format(rangeStart, "yyyy-MM-dd");
  const barTo = format(rangeEnd, "yyyy-MM-dd");

  const loadDashboard = () =>
    Promise.all([
      prisma.invoice.aggregate({
        where: {
          status: "PAID",
          originalInvoiceId: null,
          periodStart: { lte: rangeEnd },
          periodEnd: { gte: rangeStart },
        },
        _sum: { finalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: "PAID",
          originalInvoiceId: { not: null },
          periodStart: { lte: rangeEnd },
          periodEnd: { gte: rangeStart },
        },
        _sum: { returnedAmount: true },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.attendance.groupBy({
        by: ["studentId"],
        where: { date: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.attendance.groupBy({
        by: ["classId"],
        where: { date: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.attendance.groupBy({
        by: ["teacherId"],
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          teacherId: { not: null },
        },
      }),
      prisma.student.count({ where: { isActive: true } }),
      prisma.student.count(),
      prisma.class.count(),
      prisma.invoice.aggregate({
        where: { status: "PENDING" },
        _sum: { finalAmount: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.student.findMany({
        where: { startDate: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, startDate: true },
      }),
      prisma.studentClass.findMany({
        where: { endDate: { gte: rangeStart, lte: rangeEnd } },
        select: { studentId: true, endDate: true },
      }),
      prisma.studentClass.findMany({
        where: {
          startDate: { lt: rangeStart },
          OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
        },
        select: { studentId: true },
      }),
    ]);

  let row: Awaited<ReturnType<typeof loadDashboard>>;
  try {
    row = await loadDashboard();
  } catch (e) {
    if (!isLikelyDbConnectivityIssue(e)) throw e;
    return (
      <div>
        <PageTitle title={t(m, "errors.pageTitle")} subtitle={t(m, "errors.genericBody")} />
        <DbSetupNotice
          title={t(m, "errors.dbTitle")}
          step1={t(m, "errors.dbStep1")}
          step2={t(m, "errors.dbStep2")}
          step3={t(m, "errors.dbStep3")}
          footnote={t(m, "errors.dbLocal")}
        />
      </div>
    );
  }

  const [
    paidIncome,
    correctionReturns,
    expenseTotal,
    studentIdsInRange,
    classIdsInRange,
    teacherIdsInRange,
    activeStudents,
    totalStudents,
    activeClasses,
    pendingInvoicesAgg,
    recentLogs,
    joinedStudents,
    leftEnrollments,
    activeAtRangeStart,
  ] = row;

  const income =
    (paidIncome._sum?.finalAmount ?? 0) - (correctionReturns._sum?.returnedAmount ?? 0);
  const expenses = expenseTotal._sum?.amount ?? 0;
  const profit = income - expenses;
  const pending = pendingInvoicesAgg._sum?.finalAmount ?? 0;

  const studentsInRange = studentIdsInRange.length;
  const classesInRange = classIdsInRange.length;
  const teachersInRange = teacherIdsInRange.length;

  const moneyKpis: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: "emerald" | "orange" | "blue";
  }[] = [
    {
      label: t(m, "dashboard.totalIncome"),
      value: money(income),
      hint: t(m, "dashboard.incomeHint"),
      icon: Banknote,
      tone: "emerald",
    },
    {
      label: t(m, "dashboard.expenses"),
      value: money(expenses),
      hint: t(m, "dashboard.expensesHint"),
      icon: ArrowDownRight,
      tone: "orange",
    },
    {
      label: t(m, "dashboard.profit"),
      value: money(profit),
      hint: t(m, "dashboard.profitHint"),
      icon: TrendingUp,
      tone: "blue",
    },
  ];

  const rosterKpis: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: "violet" | "sky" | "amber";
  }[] = [
    {
      label: t(m, "dashboard.activeStudents"),
      value: String(studentsInRange),
      hint: t(m, "dashboard.studentsInRangeHint"),
      icon: Users,
      tone: "violet",
    },
    {
      label: t(m, "dashboard.classes"),
      value: String(classesInRange),
      hint: t(m, "dashboard.classesInRangeHint"),
      icon: School,
      tone: "sky",
    },
    {
      label: t(m, "dashboard.teachers"),
      value: String(teachersInRange),
      hint: t(m, "dashboard.teachersInRangeHint"),
      icon: UserSquare,
      tone: "amber",
    },
  ];

  const toneRing = {
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
    orange:
      "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
    blue: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900",
    violet:
      "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900",
    sky: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900",
    amber:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  };

  const mode = pickBucketMode(rangeStart, rangeEnd);
  const startBucket = bucketStart(rangeStart, mode);
  const endBucket = bucketStart(rangeEnd, mode);

  const bucketKeys: string[] = [];
  const bucketLabels = new Map<string, string>();
  for (let d = startBucket; d <= endBucket; d = nextBucket(d, mode)) {
    const k = bucketKey(d, mode);
    bucketKeys.push(k);
    bucketLabels.set(k, bucketLabel(d, mode));
  }

  const joinedByBucket = new Map<string, Set<string>>();
  for (const row of joinedStudents) {
    const k = bucketKey(row.startDate, mode);
    if (!joinedByBucket.has(k)) joinedByBucket.set(k, new Set());
    joinedByBucket.get(k)!.add(row.id);
  }

  const leftByBucket = new Map<string, Set<string>>();
  for (const row of leftEnrollments) {
    if (!row.endDate) continue;
    const k = bucketKey(row.endDate, mode);
    if (!leftByBucket.has(k)) leftByBucket.set(k, new Set());
    leftByBucket.get(k)!.add(row.studentId);
  }

  let runningStudents = new Set(activeAtRangeStart.map((x) => x.studentId)).size;
  const chartPoints = bucketKeys.map((k) => {
    const joined = joinedByBucket.get(k)?.size ?? 0;
    const left = leftByBucket.get(k)?.size ?? 0;
    runningStudents = Math.max(0, runningStudents + joined - left);
    return {
      label: bucketLabels.get(k) ?? k,
      joined,
      left,
      students: runningStudents,
    };
  });

  return (
    <div>
      <PageTitle title={t(m, "dashboard.title")} subtitle={t(m, "dashboard.subtitle")} />

      <Suspense
        fallback={
          <div className="mb-6 h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
        }
      >
        <DashboardDateBar defaultFrom={barFrom} defaultTo={barTo} />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-3">
        {moneyKpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {k.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{k.hint}</p>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneRing[k.tone]}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {rosterKpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {k.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{k.hint}</p>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneRing[k.tone]}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t(m, "dashboard.quickStats")}
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">
              {t(m, "dashboard.totalStudents")}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {totalStudents}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">
              {t(m, "dashboard.activeClasses")}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {activeClasses}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">
              {t(m, "dashboard.pendingInvoices")}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {money(pending)}
            </dd>
          </div>
        </dl>
      </div>

      <DashboardStudentCharts
        points={chartPoints}
        flowTitle={t(m, "dashboard.studentFlow")}
        flowSubtitle={t(m, "dashboard.studentFlowHint")}
        countTitle={t(m, "dashboard.studentCount")}
        countSubtitle={t(m, "dashboard.studentCountHint")}
        joinedLabel={t(m, "dashboard.joined")}
        leftLabel={t(m, "dashboard.left")}
        countLabel={t(m, "dashboard.students")}
      />

      <div className="mt-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(m, "dashboard.recentActivity")}
          </h2>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
            {recentLogs.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t(m, "dashboard.noActivity")}
              </li>
            ) : (
              recentLogs.map((log) => {
                const badge =
                  log.action.includes("DELETE") || log.action.includes("FAIL")
                    ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                    : log.action.includes("PAY") || log.action.includes("PAID")
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : log.action.includes("PENDING") ||
                          log.action.includes("CREATE")
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
                const badgeLabel =
                  log.action.length > 14
                    ? `${log.action.slice(0, 12)}…`
                    : log.action;
                return (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {log.entity} · {log.entityId.slice(0, 8)}…
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {format(log.createdAt, "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}
                    >
                      {badgeLabel}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
