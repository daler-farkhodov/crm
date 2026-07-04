/** Server-rendered hint when Prisma cannot reach Postgres (missing URL, Neon down, auth, etc.). */
export function DbSetupNotice({
  title,
  step1,
  step2,
  step3,
  footnote,
}: {
  title: string;
  step1: string;
  step2: string;
  step3: string;
  footnote: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-slate-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-50">
      <h1 className="text-lg font-semibold text-amber-950 dark:text-amber-100">{title}</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-amber-950/90 dark:text-amber-100/90">
        <li>{step1}</li>
        <li>{step2}</li>
        <li>{step3}</li>
      </ol>
      <p className="mt-4 text-xs text-amber-900/80 dark:text-amber-200/80">{footnote}</p>
    </div>
  );
}
