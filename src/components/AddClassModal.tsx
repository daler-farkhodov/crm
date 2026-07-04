"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createClass } from "@/app/actions/classes";
import { TimeRangeField } from "@/components/TimeRangeField";
import { Input, Label, Submit } from "@/components/ui";
import { useT } from "@/i18n/context";

type RoomOption = { id: string; name: string };

export function AddClassModal({ rooms }: { rooms: RoomOption[] }) {
  const tt = useT();
  const [open, setOpen] = useState(false);
  const [submitting, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createClass(fd);
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
        {tt("classes.addClass")}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-16 backdrop-blur-sm dark:bg-slate-950/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-class-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="add-class-title"
              className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {tt("classes.addClass")}
            </h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {tt("classes.subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              {/* Name */}
              <div className="sm:col-span-2">
                <Label>{tt("classes.name")}</Label>
                <Input name="name" required placeholder="Algebra I" />
              </div>

              {/* Room */}
              <div>
                <Label>Room</Label>
                <select
                  name="roomId"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">— no room —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <Label>{tt("classes.priceMonth")}</Label>
                <Input name="pricePerMonth" type="number" step="0.01" required />
              </div>

              {/* Time range — spans full width */}
              <div className="sm:col-span-2">
                <TimeRangeField startLabel="Start time" endLabel="End time" />
              </div>

              <div className="sm:col-span-2">
                <Submit variant="orange" disabled={submitting}>
                  {submitting ? tt("classes.creating") : tt("classes.create")}
                </Submit>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
