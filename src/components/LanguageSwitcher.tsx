"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setUserLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/constants";

const ORDER: Locale[] = ["ru", "en", "uz"];

const FLAG: Record<Locale, string> = {
  ru: "🇷🇺",
  en: "🇺🇸",
  uz: "🇺🇿",
};

export function LanguageSwitcher({
  locale,
  collapsed,
  labels,
}: {
  locale: Locale;
  collapsed: boolean;
  labels: { group: string; en: string; ru: string; uz: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const titleFor = (code: Locale) =>
    code === "en" ? labels.en : code === "ru" ? labels.ru : labels.uz;

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const currentTitle = titleFor(locale);

  return (
    <div ref={rootRef} className={collapsed ? "relative" : "relative self-end"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.group}
        className={
          collapsed
            ? "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-base shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
            : "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        }
      >
        <span aria-hidden>{FLAG[locale]}</span>
        {!collapsed ? <span>{currentTitle}</span> : null}
        {!collapsed ? <ChevronDown className="h-4 w-4" aria-hidden /> : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={labels.group}
          className={
            collapsed
              ? "absolute bottom-full left-1/2 z-30 mb-2 w-40 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
              : "absolute bottom-full right-0 z-30 mb-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
          }
        >
          {ORDER.map((code) => (
            <button
              key={code}
              role="menuitemradio"
              aria-checked={locale === code}
              type="button"
              disabled={pending}
              onClick={() => {
                if (code === locale || pending) {
                  setOpen(false);
                  return;
                }
                startTransition(async () => {
                  try {
                    await setUserLocale(code);
                    document.documentElement.lang = code;
                    setOpen(false);
                    router.refresh();
                  } catch (err) {
                    console.error(err);
                  }
                });
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                locale === code
                  ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span aria-hidden>{FLAG[code]}</span>
              <span>{titleFor(code)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
