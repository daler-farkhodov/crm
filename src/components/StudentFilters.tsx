"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useT } from "@/i18n/context";

type ClassOption = { id: string; name: string };

export function StudentFilters({ classes }: { classes: ClassOption[] }) {
  const tt = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const classId = searchParams.get("class") ?? "";
  const status = searchParams.get("status") ?? "all";
  const debts = searchParams.get("debts") ?? "";
  const startFrom = searchParams.get("startFrom") ?? "";

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      const q = params.toString();
      startTransition(() => {
        router.push(q ? `/students?${q}` : "/students");
      });
    },
    [router],
  );

  const apply = useCallback(
    (next: {
      class?: string;
      status?: string;
      debts?: string;
      startFrom?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const c = next.class !== undefined ? next.class : classId;
      const s = next.status !== undefined ? next.status : status;
      const d = next.debts !== undefined ? next.debts : debts;
      const sf = next.startFrom !== undefined ? next.startFrom : startFrom;

      if (c) params.set("class", c);
      else params.delete("class");
      if (s && s !== "all") params.set("status", s);
      else params.delete("status");
      if (d === "1") params.set("debts", "1");
      else params.delete("debts");
      if (sf) params.set("startFrom", sf);
      else params.delete("startFrom");
      pushParams(params);
    },
    [searchParams, classId, status, debts, startFrom, pushParams],
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {tt("students.filters.startingFrom")}
        </label>
        <input
          type="date"
          value={startFrom}
          disabled={pending}
          onChange={(e) => apply({ startFrom: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <select
        value={classId}
        disabled={pending}
        onChange={(e) => apply({ class: e.target.value })}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">{tt("students.filters.allClasses")}</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => apply({ status: e.target.value })}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="all">{tt("students.filters.allStatus")}</option>
        <option value="active">{tt("students.filters.active")}</option>
        <option value="inactive">{tt("students.filters.inactive")}</option>
      </select>
    </div>
  );
}
