"use client";

import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "@/i18n/context";

export function DashboardDateBar({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const tt = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const fromUrl = searchParams.get("from");
  const toUrl = searchParams.get("to");
  const resolvedFrom = fromUrl ?? defaultFrom;
  const resolvedTo = toUrl ?? defaultTo;

  const [from, setFrom] = useState(resolvedFrom);
  const [to, setTo] = useState(resolvedTo);

  useEffect(() => {
    setFrom(resolvedFrom);
    setTo(resolvedTo);
  }, [resolvedFrom, resolvedTo]);

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    const q = params.toString();
    startTransition(() => {
      router.push(q ? `/?${q}` : "/");
    });
  }, [router, searchParams, from, to]);

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
      <p className="w-full text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {tt("dashboard.reportRange")}
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {tt("dashboard.from")}
        </label>
        <input
          type="date"
          value={from}
          disabled={pending}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {tt("dashboard.to")}
        </label>
        <input
          type="date"
          value={to}
          disabled={pending}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={apply}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
      >
        {tt("dashboard.applyRange")}
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto">
        {tt("dashboard.showing")}{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {format(new Date(from + "T12:00:00"), "MMM d, yyyy")} –{" "}
          {format(new Date(to + "T12:00:00"), "MMM d, yyyy")}
        </span>
      </p>
    </div>
  );
}
