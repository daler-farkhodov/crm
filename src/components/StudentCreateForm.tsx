"use client";

import { format } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { createStudentWithEnrollments } from "@/app/actions/students";
import { Input, Label, Submit } from "@/components/ui";

type ClassOption = { id: string; name: string };

function defaultDate() {
  return format(new Date(), "yyyy-MM-dd");
}

export function StudentCreateForm({ classes }: { classes: ClassOption[] }) {
  const [fullName, setFullName] = useState("");
  const [rows, setRows] = useState<
    { id: string; classId: string; startDate: string }[]
  >(() => [
    {
      id: crypto.randomUUID(),
      classId: classes[0]?.id ?? "",
      startDate: defaultDate(),
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = useMemo(
    () => classes.length > 0 && fullName.trim().length > 0,
    [classes.length, fullName],
  );

  function addRow() {
    setRows((r) => [
      ...r,
      {
        id: crypto.randomUUID(),
        classId: "",
        startDate: defaultDate(),
      },
    ]);
  }

  function removeRow(rowId: string) {
    setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== rowId)));
  }

  function updateRow(
    rowId: string,
    patch: Partial<{ classId: string; startDate: string }>,
  ) {
    setRows((r) =>
      r.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const enrollments = rows
      .filter((row) => row.classId && row.startDate)
      .map((row) => ({ classId: row.classId, startDate: row.startDate }));

    if (enrollments.length === 0) {
      setError("Add at least one class and pick a start date for each.");
      return;
    }

    startTransition(async () => {
      const res = await createStudentWithEnrollments({
        fullName,
        enrollments,
      });
      if (res?.error) setError(res.error);
    });
  }

  if (classes.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Create at least one class before adding students.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label>Full name</Label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Jordan Lee"
          autoComplete="name"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Classes (at least one)
          </span>
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-accent-blue hover:underline"
          >
            + Add class
          </button>
        </div>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-slate-50/80 p-3"
            >
              <div className="min-w-[10rem] flex-1">
                <Label>Class {index + 1}</Label>
                <select
                  required
                  value={row.classId}
                  onChange={(e) =>
                    updateRow(row.id, { classId: e.target.value })
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/25"
                >
                  <option value="" disabled>
                    Select class
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-44">
                <Label>Start in class</Label>
                <Input
                  type="date"
                  required
                  value={row.startDate}
                  onChange={(e) =>
                    updateRow(row.id, { startDate: e.target.value })
                  }
                />
              </div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="mb-0.5 text-xs text-red-700 underline hover:text-red-900"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The student&apos;s profile start date is set to the earliest class
          start you enter.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Submit variant="orange" disabled={!canSubmit || pending}>
        {pending ? "Creating…" : "Create student"}
      </Submit>
    </form>
  );
}
