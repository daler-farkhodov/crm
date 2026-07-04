"use client";

import {
  Bell,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  Users,
  UserSquare2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { I18nProvider } from "@/i18n/context";
import type { Locale } from "@/i18n/constants";
import type { Messages } from "@/i18n/messages";
import { t } from "@/i18n/t";

const STORAGE_KEY = "tutorcrm-sidebar-collapsed";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/students": Users,
  "/teachers": UserSquare2,
  "/classes": BookOpen,
  "/attendance": CalendarCheck,
  "/invoices": Receipt,
  "/accounting": Wallet,
  "/settings": Settings,
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  locale,
  messages,
  nav,
  adminLinks,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
  nav: { href: string; label: string }[];
  adminLinks: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const s = messages.shell;

  const navWithIcons = useMemo(
    () =>
      nav.map((item) => ({
        ...item,
        icon: NAV_ICONS[item.href] ?? LayoutDashboard,
      })),
    [nav],
  );

  const languageLabels = useMemo(
    () => ({
      group: t(messages, "language.group"),
      en: t(messages, "language.en"),
      ru: t(messages, "language.ru"),
      uz: t(messages, "language.uz"),
    }),
    [messages],
  );

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const narrow = collapsed;

  return (
    <I18nProvider messages={messages}>
      <div className="flex min-h-screen bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <aside
          className={`sticky top-0 flex h-svh min-h-0 shrink-0 self-start flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 ease-out dark:border-slate-700 dark:bg-slate-900 ${
            narrow ? "w-[4.5rem]" : "w-64"
          }`}
          suppressHydrationWarning
        >
          <div
            className={`flex items-center gap-2 border-b border-slate-100 py-4 dark:border-slate-700 ${
              narrow ? "flex-col px-2" : "px-4"
            }`}
          >
            <Link
              href="/"
              className={
                narrow
                  ? "flex justify-center"
                  : "flex min-w-0 flex-1 items-center gap-2"
              }
              title={s.brand}
            >
              {narrow ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                  T
                </span>
              ) : (
                <div className="min-w-0">
                  <span className="block text-lg font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    {s.brand}
                  </span>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {s.tagline}
                  </span>
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={toggle}
              className={`shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${
                narrow ? "mt-1" : ""
              }`}
              title={narrow ? s.expandSidebar : s.collapseSidebar}
              aria-expanded={!narrow}
              aria-label={narrow ? s.expandSidebar : s.collapseSidebar}
            >
              {narrow ? (
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              ) : (
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
            {navWithIcons.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center rounded-lg py-2.5 text-sm font-medium transition ${
                    narrow ? "justify-center px-2" : "gap-3 px-3"
                  } ${
                    active
                      ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
                  {!narrow ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          {!narrow ? (
            <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-700">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {s.adminTools}
              </p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {adminLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-auto border-t border-slate-100 dark:border-slate-700">
            <div
              className={`flex px-3 pt-2 pb-1 ${narrow ? "flex-col items-center gap-2" : "flex-col items-stretch gap-2"}`}
            >
              <LanguageSwitcher
                locale={locale}
                collapsed={narrow}
                labels={languageLabels}
              />
              <div className={narrow ? "flex justify-center" : "flex justify-end"}>
                <ThemeToggle
                  collapsed={narrow}
                  lightLabel={s.themeLight}
                  darkLabel={s.themeDark}
                />
              </div>
            </div>
            <div className="p-3 pt-1">
              {narrow ? (
                <Link
                  href="/login"
                  title={`${s.adminUser} — ${s.switchSession}`}
                  className="flex justify-center rounded-lg bg-slate-50 p-2 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    AD
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    AD
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {s.adminUser}
                    </p>
                    <Link
                      href="/login"
                      className="truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {s.switchSession}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="search"
                readOnly
                placeholder={s.searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label={s.notifications}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-slate-900" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                AD
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </I18nProvider>
  );
}
