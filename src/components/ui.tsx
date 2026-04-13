import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle?: string;
  accent: "orange" | "blue";
}) {
  const bar =
    accent === "orange"
      ? "bg-gradient-to-r from-accent-orange to-orange-400"
      : "bg-gradient-to-r from-accent-blue to-sky-500";
  return (
    <header className="mb-8">
      <div className={`mb-3 h-1 w-16 rounded-full ${bar}`} />
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-accent-blue/30 placeholder:text-slate-400 focus:border-accent-blue focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 ${props.className ?? ""}`}
    />
  );
}

export function Submit({
  children,
  variant = "blue",
  className = "",
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: "blue" | "orange";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls =
    variant === "blue"
      ? "bg-accent-blue text-white hover:bg-blue-700"
      : "bg-accent-orange text-white hover:bg-orange-600";
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition disabled:pointer-events-none disabled:opacity-50 ${cls} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                No records yet.
              </td>
            </tr>
          ) : (
            rows.map((cells, i) => (
              <tr key={i} className="hover:bg-slate-50/80">
                {cells.map((c, j) => (
                  <td
                    key={j}
                    className="whitespace-nowrap px-4 py-3 text-slate-800"
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
