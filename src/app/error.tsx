"use client";

import { useEffect, useState } from "react";
import { errorsForLocale, localeFromDocumentCookie } from "@/i18n/client-errors";
import type { Locale } from "@/i18n/constants";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    setLocale(localeFromDocumentCookie());
  }, []);

  const e = errorsForLocale(locale);
  const msg = error.message ?? "";
  const isDbAuth =
    msg.includes("Authentication failed") ||
    msg.includes("PrismaClientInitializationError") ||
    msg.includes("Can't reach database server");

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50/80 p-8 text-slate-900 shadow-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-slate-100">
        <h1 className="text-lg font-semibold text-red-900 dark:text-red-200">{e.genericTitle}</h1>
        {isDbAuth ? (
          <div className="mt-4 space-y-3 text-sm text-red-950/90 dark:text-red-100/90">
            <p>{e.dbTitle}</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>{e.dbStep1}</li>
              <li>{e.dbStep2}</li>
              <li>{e.dbStep3}</li>
            </ol>
            <p className="text-xs text-red-900/80 dark:text-red-200/80">{e.dbLocal}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-red-950/90 dark:text-red-100/90">
            {msg || e.genericBody}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {e.tryAgain}
        </button>
      </div>
    </div>
  );
}
