"use client";

import { useRef, useState, useTransition } from "react";
import { createExpenseType, deleteExpenseType } from "@/app/actions/operations";

type ExpenseType = { id: string; name: string };

const btn = "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";
const btnGhost = `${btn} border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800`;
const btnRed = `${btn} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30`;
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function ExpenseTypesManager({ initialTypes }: { initialTypes: ExpenseType[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim().slice(0, 50);
    if (!name) return;
    const tempId = `temp-${Date.now()}`;
    setTypes((prev) => [...prev, { id: tempId, name }]);
    e.currentTarget.reset();
    startTransition(async () => {
      await createExpenseType(fd);
    });
  }

  async function handleDelete(id: string) {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setConfirmDelete(null);
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteExpenseType(fd);
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing types */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {types.length === 0 && (
          <p className="py-2 text-sm text-slate-400 dark:text-slate-500">No expense types yet.</p>
        )}
        {types.map((et) => (
          <div key={et.id} className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-800 dark:text-slate-200">{et.name}</span>
            {confirmDelete === et.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Delete?</span>
                <button
                  type="button"
                  onClick={() => handleDelete(et.id)}
                  disabled={isPending}
                  className={btnRed}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className={btnGhost}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(et.id)}
                className={btnRed}
                disabled={et.id.startsWith("temp-")}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new type */}
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <input
          ref={addRef}
          name="name"
          maxLength={50}
          placeholder="e.g. Rent, Supplies, Utilities…"
          className={`${inputCls} flex-1`}
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Add
        </button>
      </form>
    </div>
  );
}
