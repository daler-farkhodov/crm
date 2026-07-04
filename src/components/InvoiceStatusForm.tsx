"use client";

import { InvoiceStatus } from "@prisma/client";
import { useState, useTransition } from "react";
import { updateInvoiceStatus } from "@/app/actions/billing";
import { PaymentMethodFields } from "@/components/PaymentMethodFields";
import { Submit } from "@/components/ui";

export function InvoiceStatusForm({
  invoiceId,
  currentStatus,
  amountToPost,
  saveLabel,
}: {
  invoiceId: string;
  currentStatus: InvoiceStatus;
  amountToPost: number;
  saveLabel: string;
}) {
  const [status, setStatus] = useState<InvoiceStatus>(currentStatus);
  const [valid, setValid] = useState(true);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === InvoiceStatus.PAID && amountToPost > 0 && !valid) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => updateInvoiceStatus(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="id" value={invoiceId} />
      <select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {Object.values(InvoiceStatus).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {status === InvoiceStatus.PAID && amountToPost > 0 && (
        <PaymentMethodFields total={amountToPost} onValidityChange={setValid} />
      )}
      <Submit variant="blue" disabled={pending}>
        {saveLabel}
      </Submit>
    </form>
  );
}
