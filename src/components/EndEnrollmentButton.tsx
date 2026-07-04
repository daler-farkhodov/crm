"use client";

import { useState, useTransition } from "react";
import { generateRewrittenInvoice } from "@/app/actions/billing";
import { checkEndEnrollmentRefund, endEnrollment } from "@/app/actions/students";
import { Input, Label, Submit } from "@/components/ui";

export function EndEnrollmentButton({ enrollmentId }: { enrollmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [endDate, setEndDate] = useState("");
  const [impact, setImpact] = useState<{
    refundAmount: number;
    projectedBalance: number;
    studentId: string;
    classId: string;
  } | null>(null);

  async function submitEnd(date: string) {
    const fd = new FormData();
    fd.set("id", enrollmentId);
    fd.set("endDate", date);
    await endEnrollment(fd);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!endDate) return;
    startTransition(async () => {
      const result = await checkEndEnrollmentRefund(enrollmentId, endDate);
      if (!result.needsRewrittenInvoice) {
        await submitEnd(endDate);
        return;
      }
      setImpact(result);
    });
  }

  function handleConfirm() {
    if (!impact) return;
    const date = endDate;
    startTransition(async () => {
      await submitEnd(date);
      await generateRewrittenInvoice(impact.studentId, impact.classId, new Date(date));
      setImpact(null);
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div>
          <Label>End date</Label>
          <Input
            name="endDate"
            type="date"
            required
            className="w-40"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Submit variant="blue" disabled={pending}>
          End enrollment
        </Submit>
      </form>

      {impact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              End this enrollment?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              After the refund, this student will still have a positive balance of{" "}
              <strong className="text-emerald-700 dark:text-emerald-400">
                ${impact.projectedBalance.toFixed(2)}
              </strong>
              . Ending this enrollment will generate a correction invoice to return that
              amount.
            </p>
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
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Ending…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
