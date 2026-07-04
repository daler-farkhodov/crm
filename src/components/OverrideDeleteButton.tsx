"use client";

import { useState, useTransition } from "react";
import { deleteTeacherOverride, getOverrideReversalImpact } from "@/app/actions/classes";

export function OverrideDeleteButton({
  id,
  substituteName,
  originalTeacherName,
}: {
  id: string;
  substituteName: string;
  originalTeacherName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [impact, setImpact] = useState<{ accrualTotal: number; fineTotal: number } | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await getOverrideReversalImpact(id);
      if (!result.hasImpact) {
        const fd = new FormData();
        fd.set("id", id);
        await deleteTeacherOverride(fd);
        return;
      }
      setImpact({ accrualTotal: result.accrualTotal, fineTotal: result.fineTotal });
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteTeacherOverride(fd);
      setImpact(null);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs text-red-600 underline hover:text-red-800 disabled:opacity-50 dark:text-red-400"
      >
        Remove
      </button>

      {impact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Reverse this substitution?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {substituteName} already has pay and/or fines posted for this session. Removing this
              override will:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              {impact.accrualTotal !== 0 && (
                <li>
                  Reverse ${impact.accrualTotal.toFixed(2)} of accrued pay from {substituteName}
                </li>
              )}
              {impact.fineTotal !== 0 && (
                <li>
                  Waive ${impact.fineTotal.toFixed(2)} in fine(s) for {substituteName}
                </li>
              )}
              <li>Re-accrue the session's pay to {originalTeacherName}</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImpact(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Reversing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
