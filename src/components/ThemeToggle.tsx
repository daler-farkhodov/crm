"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "tutorcrm-theme";

function apply(mode: "light" | "dark") {
  const root = document.documentElement.classList;
  if (mode === "dark") root.add("dark");
  else root.remove("dark");
}

function readInitialMode(): "light" | "dark" {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({
  collapsed,
  lightLabel = "Switch to light mode",
  darkLabel = "Switch to dark mode",
}: {
  collapsed: boolean;
  lightLabel?: string;
  darkLabel?: string;
}) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useLayoutEffect(() => {
    const m = readInitialMode();
    apply(m);
    setMode(m);
  }, []);

  const toggle = useCallback(() => {
    const next = mode === "light" ? "dark" : "light";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    apply(next);
    setMode(next);
  }, [mode]);

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? lightLabel : darkLabel}
      aria-label={isDark ? lightLabel : darkLabel}
      suppressHydrationWarning
      className={`shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${
        collapsed ? "self-center" : ""
      }`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
