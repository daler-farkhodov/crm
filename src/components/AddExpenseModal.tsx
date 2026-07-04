"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { createExpense } from "@/app/actions/operations";
import { PaymentMethodFields } from "@/components/PaymentMethodFields";

type ExpenseType = { id: string; name: string };

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddExpenseModal({ expenseTypes }: { expenseTypes: ExpenseType[] }) {
  const [open, setOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>(""); // "" = other
  const [useToday, setUseToday] = useState(true);
  const [customDate, setCustomDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [customType, setCustomType] = useState("");
  const [amount, setAmount] = useState("");
  const [splitValid, setSplitValid] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setSelectedTypeId("");
    setUseToday(true);
    setCustomDate(todayIso());
    setNote("");
    setCustomType("");
    setAmount("");
    setSplitValid(true);
    formRef.current?.reset();
  }

  const [submitting, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!splitValid || submitting) return;
    const fd = new FormData(e.currentTarget);
    // inject the resolved date
    fd.set("date", useToday ? todayIso() : customDate);
    startTransition(async () => {
      await createExpense(fd);
      reset();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Add expense
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-16 backdrop-blur-sm dark:bg-slate-950/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-expense-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            {/* Close */}
            <button
              type="button"
              onClick={() => { reset(); setOpen(false); }}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 id="add-expense-title" className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Add expense
            </h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Record a new operating expense.
            </p>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div>
                <label className={labelCls}>Type</label>
                <select
                  name="expenseTypeId"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className={inputCls}
                  required={false}
                >
                  <option value="">Other (custom)</option>
                  {expenseTypes.map((et) => (
                    <option key={et.id} value={et.id}>{et.name}</option>
                  ))}
                </select>
              </div>

              {/* Custom type field — shown when "other" selected */}
              {selectedTypeId === "" && (
                <div>
                  <label className={labelCls}>Custom type name</label>
                  <input
                    name="customType"
                    maxLength={50}
                    required
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="Describe the expense…"
                    className={inputCls}
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{customType.length}/50</p>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className={labelCls}>Amount ($)</label>
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className={labelCls}>Payment method</label>
                <PaymentMethodFields total={Number(amount || 0)} onValidityChange={setSplitValid} />
              </div>

              {/* Note */}
              <div>
                <label className={labelCls}>Note <span className="normal-case text-slate-400">(optional)</span></label>
                <textarea
                  name="note"
                  maxLength={150}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any additional context…"
                  className={`${inputCls} resize-none`}
                />
                <p className="mt-1 text-right text-xs text-slate-400">{note.length}/150</p>
              </div>

              {/* Date — today toggle */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className={labelCls + " mb-0"}>Date</label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>Today</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useToday}
                      onClick={() => setUseToday((v) => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        useToday ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          useToday ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                </div>
                {!useToday && (
                  <input
                    type="date"
                    value={customDate}
                    max={todayIso()}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className={inputCls}
                    required
                  />
                )}
                {useToday && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!splitValid || submitting}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save expense"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
