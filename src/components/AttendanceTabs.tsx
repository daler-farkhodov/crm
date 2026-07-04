"use client";

import { format } from "date-fns";
import { CheckCircle, Clock, Search, UserX, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { CancelClassModal } from "@/components/CancelClassModal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarClass = {
  id: string;
  name: string;
  roomId: string | null;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  scheduleDays: string[];
};

export type CalendarRoom = { id: string; name: string };

export type CancellationInfo = {
  classId: string | null;
  date: string; // ISO yyyy-MM-dd
  reason: string | null;
};

export type ClassOption = {
  id: string;
  name: string;
  scheduleDays: string[];
};

export type StudentStat = {
  id: string;
  fullName: string;
  phone: string | null;
  parentPhone: string | null;
  className: string;
  isActive: boolean;
  presentCount: number;
  absentCount: number;
};

export type AttendanceTabsProps = {
  tab: string;
  // Calendar props
  selectedDayStr: string;
  prevDay: string;
  nextDay: string;
  rooms: CalendarRoom[];
  hours: number[];
  scheduledByRoomHour: Record<string, CalendarClass[]>;
  attendanceCountByClass: Record<string, number>;
  cancellations: CancellationInfo[];
  allClasses: ClassOption[];
  presentCount: number;
  absentCount: number;
  lateCount: number;
  trialCount: number;
  totalRecords: number;
  // Students props
  studentStats: StudentStat[];
  defaultDateFrom: string;
  defaultDateTo: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(hour: number, minute: number) {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

const inputCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  iconBg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Percentage bar ───────────────────────────────────────────────────────────

function PercentBar({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
        {pct}%
      </span>
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({
  selectedDayStr,
  prevDay,
  nextDay,
  rooms,
  hours,
  scheduledByRoomHour,
  attendanceCountByClass,
  cancellations,
  allClasses,
  presentCount,
  absentCount,
  lateCount,
  trialCount,
  totalRecords,
}: Omit<AttendanceTabsProps, "tab" | "studentStats" | "defaultDateFrom" | "defaultDateTo">) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Build cancellation lookup: "classId-yyyy-MM-dd" -> reason
  const cancellationMap = new Map<string, string>();
  const globalCancellationDates = new Set<string>();
  for (const c of cancellations) {
    const dateKey = c.date.slice(0, 10);
    if (c.classId === null) {
      globalCancellationDates.add(dateKey);
    } else {
      cancellationMap.set(`${c.classId}-${dateKey}`, c.reason ?? "Cancelled");
    }
  }

  function isCancelled(classId: string): { cancelled: boolean; reason: string } {
    const dateKey = selectedDayStr;
    if (globalCancellationDates.has(dateKey)) {
      return { cancelled: true, reason: "School closed" };
    }
    const reason = cancellationMap.get(`${classId}-${dateKey}`);
    if (reason !== undefined) {
      return { cancelled: true, reason };
    }
    return { cancelled: false, reason: "" };
  }

  return (
    <div>
      {/* KPI rail */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard
          label="Present today"
          value={presentCount}
          sub={`of ${totalRecords} sessions`}
          icon={<CheckCircle size={20} className="text-emerald-700 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:ring-emerald-800"
        />
        <KpiCard
          label="Absent"
          value={absentCount}
          icon={<UserX size={20} className="text-orange-700 dark:text-orange-400" />}
          iconBg="bg-orange-50 ring-1 ring-orange-100 dark:bg-orange-900/30 dark:ring-orange-800"
        />
        <KpiCard
          label="Cancelled / Closed"
          value={lateCount}
          icon={<Clock size={20} className="text-amber-700 dark:text-amber-400" />}
          iconBg="bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:ring-amber-800"
        />
        <KpiCard
          label="Trial sessions"
          value={trialCount}
          icon={<Users size={20} className="text-violet-700 dark:text-violet-400" />}
          iconBg="bg-violet-50 ring-1 ring-violet-100 dark:bg-violet-900/30 dark:ring-violet-800"
        />
      </div>

      {/* Calendar card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Day Schedule
          </h2>
          <div className="flex items-center gap-2">
            {/* Cancel class button */}
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700"
            >
              <XCircle size={14} />
              Cancel Class
            </button>

            <form method="GET">
              <input type="hidden" name="day" value={prevDay} />
              <input type="hidden" name="tab" value="calendar" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ← Prev
              </button>
            </form>
            <form method="GET" className="flex items-center gap-2">
              <input type="hidden" name="tab" value="calendar" />
              <input
                type="date"
                name="day"
                defaultValue={selectedDayStr}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Go
              </button>
            </form>
            <form method="GET">
              <input type="hidden" name="day" value={nextDay} />
              <input type="hidden" name="tab" value="calendar" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Next →
              </button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto px-5 pb-5 pt-3">
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Room
                </th>
                {hours.map((h) => (
                  <th
                    key={h}
                    className="min-w-[92px] border-b border-slate-200 px-2 py-2 text-center text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {h}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="align-top">
                  <td className="sticky left-0 z-10 border-r border-b border-slate-100 bg-white px-3 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {room.name}
                  </td>
                  {hours.map((h) => {
                    const k = `${room.id}-${String(h).padStart(2, "0")}`;
                    const cellClasses = scheduledByRoomHour[k] ?? [];
                    return (
                      <td
                        key={k}
                        className="h-16 border-b border-slate-100 px-1.5 py-1.5 dark:border-slate-800"
                      >
                        {cellClasses.length === 0 ? null : (
                          <div className="flex h-full flex-col gap-1">
                            {cellClasses.map((cls) => {
                              const { cancelled, reason } = isCancelled(cls.id);
                              if (cancelled) {
                                return (
                                  <div
                                    key={`${cls.id}-${h}`}
                                    title={reason}
                                    className="group relative flex h-full flex-col justify-between rounded-md bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                  >
                                    <span className="block truncate">{cls.name}</span>
                                    <span className="block text-[10px] font-medium opacity-80">
                                      Cancelled
                                    </span>
                                    {/* Tooltip */}
                                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-normal text-white shadow-lg group-hover:block dark:bg-slate-700">
                                      {reason}
                                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <Link
                                  key={`${cls.id}-${h}`}
                                  href={`/classes/${cls.id}`}
                                  className="flex h-full flex-col justify-between rounded-md bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                                  title={`${cls.name} · ${formatTime(cls.startHour, cls.startMinute)}-${formatTime(cls.endHour, cls.endMinute)}`}
                                >
                                  <span className="block truncate">{cls.name}</span>
                                  <span className="block text-[10px] font-medium opacity-80">
                                    {formatTime(cls.startHour, cls.startMinute)}–
                                    {formatTime(cls.endHour, cls.endMinute)} ·{" "}
                                    {attendanceCountByClass[cls.id] ?? 0} students
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCancelModal && (
        <CancelClassModal classes={allClasses} onClose={() => setShowCancelModal(false)} />
      )}
    </div>
  );
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({
  studentStats,
  defaultDateFrom,
  defaultDateTo,
}: {
  studentStats: StudentStat[];
  defaultDateFrom: string;
  defaultDateTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const statusFilter = sp.get("sf") ?? "active";
  const dateFrom = sp.get("from") ?? "";
  const dateTo = sp.get("to") ?? "";

  const push = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString());
      next.set("tab", "students");
      for (const [k, v] of Object.entries(params)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.push(`${pathname}?${next.toString()}`);
    },
    [sp, router, pathname],
  );

  // Filter
  const filtered = studentStats.filter((s) => {
    if (statusFilter === "active" && !s.isActive) return false;
    if (statusFilter === "inactive" && s.isActive) return false;
    if (q && !s.fullName.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {/* Filters bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-8 w-full`}
            placeholder="Search student…"
            value={q}
            onChange={(e) => push({ q: e.target.value })}
          />
        </div>

        <select
          className={inputCls}
          value={statusFilter}
          onChange={(e) => push({ sf: e.target.value })}
        >
          <option value="active">Active students</option>
          <option value="all">All students</option>
          <option value="inactive">Inactive students</option>
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className={inputCls}
            value={dateFrom || defaultDateFrom}
            onChange={(e) => push({ from: e.target.value })}
          />
          <span className="text-xs text-slate-400">—</span>
          <input
            type="date"
            className={inputCls}
            value={dateTo || defaultDateTo}
            onChange={(e) => push({ to: e.target.value })}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                {["Name", "Class", "Phone", "Parent Phone", "Present", "Absent", "Attendance"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    No students found
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const total = s.presentCount + s.absentCount;
                  const pct = total === 0 ? 100 : Math.round((s.presentCount / total) * 100);
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/students/${s.id}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {s.fullName}
                        </Link>
                        {!s.isActive && (
                          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {s.className || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {s.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {s.parentPhone || "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        {s.presentCount}
                      </td>
                      <td className="px-4 py-3 font-semibold text-red-500 dark:text-red-400">
                        {s.absentCount}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <PercentBar pct={pct} />
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

// ─── Main Tabs Component ──────────────────────────────────────────────────────

export function AttendanceTabs(props: AttendanceTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const activeTab = props.tab;

  function setTab(tab: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", tab);
    router.push(`${pathname}?${next.toString()}`);
  }

  const tabs = [
    { key: "calendar", label: "Calendar" },
    { key: "students", label: "Students" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "students" ? (
        <StudentsTab
          studentStats={props.studentStats}
          defaultDateFrom={props.defaultDateFrom}
          defaultDateTo={props.defaultDateTo}
        />
      ) : (
        <CalendarTab
          selectedDayStr={props.selectedDayStr}
          prevDay={props.prevDay}
          nextDay={props.nextDay}
          rooms={props.rooms}
          hours={props.hours}
          scheduledByRoomHour={props.scheduledByRoomHour}
          attendanceCountByClass={props.attendanceCountByClass}
          cancellations={props.cancellations}
          allClasses={props.allClasses}
          presentCount={props.presentCount}
          absentCount={props.absentCount}
          lateCount={props.lateCount}
          trialCount={props.trialCount}
          totalRecords={props.totalRecords}
        />
      )}
    </div>
  );
}
