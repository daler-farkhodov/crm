"use client";

import { format } from "date-fns";
import { Search, Pencil, Check, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { deleteExpense, updateExpense, updateTeacherEarningAmount } from "@/app/actions/operations";
import { AccountingChart, type ChartPoint } from "@/components/AccountingChart";
import { AddExpenseModal } from "@/components/AddExpenseModal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncomeRow = {
  id: string;
  studentName: string;
  classes: string;
  amount: number;
  date: string; // ISO
};

export type ExpenseRow = {
  id: string;
  title: string;
  typeName: string | null;
  amount: number;
  note: string | null;
  date: string; // ISO
  isTeacherSalary: boolean;
  teacherEarningId?: string;
};

export type ExpenseTypeOption = { id: string; name: string };
export type ClassOption = { id: string; name: string };
export type TeacherOption = { id: string; fullName: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function formatSignedMoney(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(0)}`;
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "orange" | "blue";
}) {
  const colors = {
    green: "text-emerald-600 dark:text-emerald-400",
    orange: "text-orange-600 dark:text-orange-400",
    blue: "text-blue-600 dark:text-blue-400",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AccountingTabs({
  incomeRows,
  expenseRows,
  chartData,
  incomeByClass,
  totalIncome,
  totalExpenses,
  outstandingDebt,
  cashNet,
  transferNet,
  expenseTypes,
  classes,
  teachers,
  defaultDateFrom,
  defaultDateTo,
}: {
  incomeRows: IncomeRow[];
  expenseRows: ExpenseRow[];
  chartData: ChartPoint[];
  incomeByClass: { className: string; total: number }[];
  totalIncome: number;
  totalExpenses: number;
  outstandingDebt: number;
  cashNet: number;
  transferNet: number;
  expenseTypes: ExpenseTypeOption[];
  classes: ClassOption[];
  teachers: TeacherOption[];
  defaultDateFrom: string;
  defaultDateTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const tab = (sp.get("tab") as "all" | "income" | "expenses") ?? "all";
  const dateFrom = sp.get("from") ?? defaultDateFrom;
  const dateTo = sp.get("to") ?? defaultDateTo;
  const filterClass = sp.get("class") ?? "";
  const filterTeacher = sp.get("teacher") ?? "";
  const filterType = sp.get("type") ?? "";
  const search = sp.get("q") ?? "";

  const [searchInput, setSearchInput] = useState(search);
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (updates: Record<string, string>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      startTransition(() => router.push(`${pathname}?${p.toString()}`));
    },
    [sp, pathname, router],
  );

  // ── Income filtering ──────────────────────────────────────────────────────
  const filteredIncome = incomeRows.filter((r) => {
    if (filterClass) {
      // class filter encoded as class name substring
      if (!r.classes.toLowerCase().includes(filterClass.toLowerCase())) return false;
    }
    if (search && !r.studentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Expense filtering ─────────────────────────────────────────────────────
  const filteredExpenses = expenseRows.filter((r) => {
    if (filterType && r.typeName !== filterType && !(filterType === "__salary__" && r.isTeacherSalary)) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────

  function TabBtn({ value, label }: { value: string; label: string }) {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => push({ tab: value })}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        <TabBtn value="all" label="All" />
        <TabBtn value="income" label="Income" />
        <TabBtn value="expenses" label="Expenses" />
      </div>

      {/* Combined filter bar — date + tab-specific filters all on one line */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => push({ from: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => push({ to: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* Divider */}
        {tab !== "all" && (
          <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        )}

        {/* Income tab filters */}
        {tab === "income" && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student…"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); push({ q: e.target.value }); }}
                className={`${inputCls} pl-8`}
              />
            </div>
            <select
              value={filterClass}
              onChange={(e) => push({ class: e.target.value })}
              className={inputCls}
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterTeacher}
              onChange={(e) => push({ teacher: e.target.value })}
              className={inputCls}
            >
              <option value="">All teachers</option>
              {teachers.map((tc) => (
                <option key={tc.id} value={tc.id}>{tc.fullName}</option>
              ))}
            </select>
          </>
        )}

        {/* Expenses tab filters */}
        {tab === "expenses" && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search expense…"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); push({ q: e.target.value }); }}
                className={`${inputCls} pl-8`}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => push({ type: e.target.value })}
              className={inputCls}
            >
              <option value="">All types</option>
              <option value="__salary__">Teacher salary</option>
              {expenseTypes.map((et) => (
                <option key={et.id} value={et.name}>{et.name}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            <div className="ml-auto">
              <AddExpenseModal expenseTypes={expenseTypes} />
            </div>
          </>
        )}

        {isPending && (
          <span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>
        )}
      </div>

      {/* ── ALL TAB ── */}
      {tab === "all" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Income" value={`$${totalIncome.toFixed(0)}`} color="green" />
            <MetricCard label="Expenses" value={`$${totalExpenses.toFixed(0)}`} color="orange" />
            <MetricCard
              label="Current balance"
              value={formatSignedMoney(totalIncome - totalExpenses)}
              color="blue"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label="Cash (net)" value={formatSignedMoney(cashNet)} color="green" />
            <MetricCard label="Transfer (net)" value={formatSignedMoney(transferNet)} color="blue" />
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Income vs Expenses
            </h2>
            <AccountingChart data={chartData} />
          </div>

          {/* Income by class */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Income by class
              </h2>
            </div>
            {incomeByClass.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                No data for selected range.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left">Class</th>
                    <th className="px-5 py-3 text-right">Total income</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {incomeByClass.map((r) => (
                    <tr key={r.className} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                      <td className="px-5 py-3 text-slate-800 dark:text-slate-200">{r.className}</td>
                      <td className="px-5 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        ${r.total.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── INCOME TAB ── */}
      {tab === "income" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label="Total income" value={`$${totalIncome.toFixed(0)}`} color="green" />
            <MetricCard label="Outstanding debt" value={`$${outstandingDebt.toFixed(0)}`} color="orange" />
          </div>

          {/* Income list */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {filteredIncome.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                No income records for this range.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left">Student</th>
                    <th className="px-5 py-3 text-left">Class</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredIncome.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {r.studentName}
                      </td>
                      <td className="max-w-[200px] truncate px-5 py-3 text-slate-600 dark:text-slate-400">
                        {r.classes}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        +${r.amount.toFixed(0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                        {format(new Date(r.date), "M/d/yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {tab === "expenses" && (
        <ExpensesTab
          rows={filteredExpenses}
          onDelete={async (id) => {
            const fd = new FormData();
            fd.set("id", id);
            await deleteExpense(fd);
          }}
        />
      )}
    </div>
  );
}

// ─── Expenses Tab (separate for inline edit state) ────────────────────────────

function ExpensesTab({
  rows,
  onDelete,
}: {
  rows: ExpenseRow[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id);
    setEditAmount(String(row.amount));
  }

  async function commitEdit(row: ExpenseRow) {
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount === row.amount) { setEditingId(null); return; }
    const fd = new FormData();
    fd.set("id", row.teacherEarningId ?? row.id);
    fd.set("totalAmount", String(amount));
    fd.set("amount", String(amount));
    startTransition(async () => {
      if (row.isTeacherSalary && row.teacherEarningId) {
        await updateTeacherEarningAmount(fd);
      } else {
        await updateExpense(fd);
      }
    });
    setEditingId(null);
  }

  return (
    <div>
      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            No expenses for this range.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Note</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                    {format(new Date(r.date), "M/d/yyyy")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {r.isTeacherSalary && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                          Salary
                        </span>
                      )}
                      <span className="text-slate-800 dark:text-slate-200">{r.title}</span>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3 text-slate-500 dark:text-slate-400">
                    {r.note ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  {/* Amount — inline editable */}
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {editingId === r.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-slate-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-24 rounded border border-blue-400 px-2 py-0.5 text-right text-sm outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(r);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button onClick={() => commitEdit(r)} className="text-emerald-600 hover:text-emerald-700">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium text-orange-600 dark:text-orange-400">
                        −${r.amount.toFixed(0)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <div className="flex items-center gap-3">
                      {editingId !== r.id && (
                        <button
                          onClick={() => startEdit(r)}
                          className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Edit amount"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!r.isTeacherSalary && (
                        confirmDelete === r.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setConfirmDelete(null);
                                startTransition(() => onDelete(r.id));
                              }}
                              className="text-xs text-red-600 underline hover:text-red-800"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-slate-500 underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(r.id)}
                            className="text-xs text-red-500 underline hover:text-red-700 dark:text-red-400"
                          >
                            Delete
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
