"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setUserLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/constants";

const ORDER: Locale[] = ["ru", "en", "uz"];

const FLAG: Record<Locale, string> = {
  ru: "🇷🇺",
  en: "🇺🇸",
  uz: "🇺🇿",
};

export function LoginLanguageStrip({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { group: string; en: string; ru: string; uz: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const titleFor = (code: Locale) =>
    code === "en" ? labels.en : code === "ru" ? labels.ru : labels.uz;

  return (
    <div
      role="group"
      aria-label={labels.group}
      className="mb-6 flex justify-end gap-1.5"
    >
      {ORDER.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          title={titleFor(code)}
          aria-label={titleFor(code)}
          aria-pressed={locale === code}
          onClick={() => {
            if (code === locale || pending) return;
            startTransition(async () => {
              await setUserLocale(code);
              document.documentElement.lang = code;
              router.refresh();
            });
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base shadow-sm transition disabled:opacity-50 ${
            locale === code
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30 dark:border-blue-400 dark:bg-blue-950/50 dark:ring-blue-400/30"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          }`}
        >
          <span aria-hidden>{FLAG[code]}</span>
        </button>
      ))}
    </div>
  );
}
