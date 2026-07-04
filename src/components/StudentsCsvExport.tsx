"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";

export function StudentsCsvExport() {
  const tt = useT();
  const searchParams = useSearchParams();
  const q = searchParams.toString();
  const href = q ? `/api/students/export?${q}` : "/api/students/export";

  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      <Download className="h-4 w-4" aria-hidden />
      {tt("students.exportCsv")}
    </a>
  );
}
