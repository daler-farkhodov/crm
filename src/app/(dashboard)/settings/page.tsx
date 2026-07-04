import { ExpenseTypesManager } from "@/components/ExpenseTypesManager";
import { RoomsManager } from "@/components/RoomsManager";
import { PageTitle } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

const field =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100";

export default async function SettingsPage() {
  const locale = await getLocale();
  const m = getMessages(locale);

  const [rooms, expenseTypes] = await Promise.all([
    prisma.room.findMany({
      orderBy: { createdAt: "asc" },
      include: { classes: { select: { id: true, name: true } } },
    }),
    prisma.expenseType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageTitle title={t(m, "settings.title")} subtitle={t(m, "settings.subtitle")} />

      <div className="max-w-2xl space-y-6">
        {/* Rooms */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Rooms
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Manage rooms available for scheduling. Hidden rooms are excluded from the attendance calendar.
          </p>
          <RoomsManager initialRooms={rooms} />
        </section>

        {/* Expense Types */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Expense types
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Define categories for expenses. These appear as options when adding a new expense.
          </p>
          <ExpenseTypesManager initialTypes={expenseTypes} />
        </section>

        {/* Profile */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(m, "settings.profile")}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(m, "settings.profileHint")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t(m, "settings.firstName")}
              </label>
              <input readOnly defaultValue="Admin" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t(m, "settings.lastName")}
              </label>
              <input readOnly defaultValue="User" className={field} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t(m, "settings.email")}
              </label>
              <input readOnly defaultValue="admin@tutorcrm.com" className={field} />
            </div>
          </div>
          <button
            type="button"
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white opacity-60 dark:bg-blue-500"
            disabled
          >
            {t(m, "settings.saveProfile")}
          </button>
        </section>

        {/* Organization */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(m, "settings.organization")}
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t(m, "settings.orgName")}
              </label>
              <input readOnly defaultValue="TutorCRM Learning Center" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t(m, "settings.timezone")}
              </label>
              <select disabled className={field} defaultValue="et">
                <option value="et">{t(m, "settings.tzEt")}</option>
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
