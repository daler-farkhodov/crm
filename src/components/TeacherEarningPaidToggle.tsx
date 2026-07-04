"use client";

import { useState, useTransition } from "react";
import { toggleTeacherEarningPaid } from "@/app/actions/operations";
import { PaymentMethodFields } from "@/components/PaymentMethodFields";

export function TeacherEarningPaidToggle({
  id,
  isPaid,
  totalAmount,
  markPaidLabel,
  markUnpaidLabel,
}: {
  id: string;
  isPaid: boolean;
  totalAmount: number;
  markPaidLabel: string;
  markUnpaidLabel: string;
}) {
  const [showFields, setShowFields] = useState(false);
  const [valid, setValid] = useState(true);
  const [pending, startTransition] = useTransition();

  function submit(nextPaid: boolean, fd?: FormData) {
    const data = fd ?? new FormData();
    data.set("id", id);
    data.set("isPaid", String(nextPaid));
    startTransition(() => toggleTeacherEarningPaid(data));
  }

  if (isPaid) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => submit(false)}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {markUnpaidLabel}
      </button>
    );
  }

  if (!showFields) {
    return (
      <button
        type="button"
        onClick={() => setShowFields(true)}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {markPaidLabel}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        submit(true, new FormData(e.currentTarget));
      }}
      className="flex flex-col items-start gap-2"
    >
      <PaymentMethodFields total={totalAmount} onValidityChange={setValid} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !valid}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {markPaidLabel}
        </button>
        <button
          type="button"
          onClick={() => setShowFields(false)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
