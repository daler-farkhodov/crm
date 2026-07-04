"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import {
  InvoiceCreateForm,
  type StudentInvoiceOption,
} from "@/components/InvoiceCreateForm";
import { useT } from "@/i18n/context";

export function InvoiceCreateModal({
  students,
}: {
  students: StudentInvoiceOption[];
}) {
  const tt = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        {tt("invoices.createButton")}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-10 backdrop-blur-sm dark:bg-slate-950/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-invoice-title"
        >
          <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={tt("invoices.closeModal")}
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="create-invoice-title"
              className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {tt("invoices.newTitle")}
            </h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {tt("invoices.newIntro")}
            </p>

            <InvoiceCreateForm students={students} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
