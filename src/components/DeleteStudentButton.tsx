"use client";

import { useState } from "react";
import { generateDueStudentInvoice } from "@/app/actions/billing";
import { softDeleteStudent } from "@/app/actions/students";

interface Props {
  studentId: string;
  balance: number;
  label: string;
}

export function DeleteStudentButton({ studentId, balance, label }: Props) {
  const [open, setOpen] = useState(false);

  const absBalance = Math.abs(balance).toFixed(2);

  let title = "Delete Student?";
  let body: React.ReactNode;

  if (balance > 0.005) {
    body = (
      <>
        <p>
          This student has a remaining positive balance of{" "}
          <strong className="text-emerald-700 dark:text-emerald-400">${absBalance}</strong>.
        </p>
        <p className="mt-2">
          According to school policy, this amount must be refunded to the student.
        </p>
        <p className="mt-2">
          Deleting this student will create a financial adjustment and reduce company income by{" "}
          <strong>${absBalance}</strong>.
        </p>
        <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">
          Are you sure you want to continue?
        </p>
      </>
    );
  } else if (balance < -0.005) {
    body = (
      <>
        <p>
          This student currently owes{" "}
          <strong className="text-orange-600 dark:text-orange-400">${absBalance}</strong>.
        </p>
        <p className="mt-2">
          It is recommended to generate an invoice before deleting the student.
        </p>
        <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">
          Do you want to continue?
        </p>
      </>
    );
  } else {
    body = (
      <p>This action cannot be undone.</p>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <div className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {body}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              {balance < -0.005 && (
                <form
                  action={generateDueStudentInvoice}
                  onSubmit={() => setOpen(false)}
                  className="inline"
                >
                  <input type="hidden" name="studentId" value={studentId} />
                  <button
                    type="submit"
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 dark:hover:bg-orange-400"
                  >
                    Generate Invoice
                  </button>
                </form>
              )}

              <form
                action={softDeleteStudent}
                onSubmit={() => setOpen(false)}
                className="inline"
              >
                <input type="hidden" name="id" value={studentId} />
                <input type="hidden" name="balance" value={balance} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Delete Student
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
