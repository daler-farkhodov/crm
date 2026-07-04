"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  label: string;
  joined: number;
  left: number;
  students: number;
};

export function DashboardStudentCharts({
  points,
  flowTitle,
  flowSubtitle,
  countTitle,
  countSubtitle,
  joinedLabel,
  leftLabel,
  countLabel,
}: {
  points: ChartPoint[];
  flowTitle: string;
  flowSubtitle: string;
  countTitle: string;
  countSubtitle: string;
  joinedLabel: string;
  leftLabel: string;
  countLabel: string;
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{flowTitle}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{flowSubtitle}</p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={18} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="joined"
                name={joinedLabel}
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="left"
                name={leftLabel}
                stroke="#dc2626"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{countTitle}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{countSubtitle}</p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={18} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
              <Tooltip />
              <Legend />
              <Bar dataKey="students" name={countLabel} fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
