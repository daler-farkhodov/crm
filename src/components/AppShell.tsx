import Link from "next/link";
import type { ReactNode } from "react";

const nav: { href: string; label: string; accent: "orange" | "blue" }[] = [
  { href: "/", label: "Dashboard", accent: "blue" },
  { href: "/students", label: "Students", accent: "orange" },
  { href: "/teachers", label: "Teachers", accent: "blue" },
  { href: "/classes", label: "Classes", accent: "orange" },
  { href: "/attendance", label: "Attendance", accent: "blue" },
  { href: "/invoices", label: "Invoices", accent: "orange" },
  { href: "/ledger", label: "Ledger", accent: "blue" },
  { href: "/teacher-pay", label: "Teacher pay", accent: "orange" },
  { href: "/expenses", label: "Expenses", accent: "blue" },
  { href: "/closures", label: "Closures", accent: "orange" },
  { href: "/users", label: "Users", accent: "blue" },
  { href: "/audit", label: "Audit log", accent: "orange" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="border-b border-line bg-white px-4 py-3 lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-3 py-1 font-medium ${
                item.accent === "orange"
                  ? "bg-accent-orange-soft text-accent-orange"
                  : "bg-accent-blue-soft text-accent-blue"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-8">
            <div className="mb-8 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-blue text-sm font-bold text-white">
                L
              </div>
              <div>
                <div className="text-sm font-semibold">LMS CRM</div>
                <div className="text-xs text-slate-500">Operations</div>
              </div>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${
                    item.accent === "orange"
                      ? "border-l-4 border-accent-orange pl-2"
                      : "border-l-4 border-accent-blue pl-2"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      item.accent === "orange"
                        ? "bg-accent-orange"
                        : "bg-accent-blue"
                    }`}
                  />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 rounded-xl border border-line bg-slate-50 p-3 text-xs text-slate-600">
              <Link href="/login" className="font-medium text-accent-blue hover:underline">
                Switch user
              </Link>
              <span className="mx-1">·</span>
              <span>Impersonation for demo</span>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
