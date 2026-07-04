import Link from "next/link";
import { Eye } from "lucide-react";
import { AddClassModal } from "@/components/AddClassModal";
import { PageTitle } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

function formatTime(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function teacherNames(
  teachers: { teacher: { fullName: string } }[],
): string {
  if (teachers.length === 0) return "—";
  return [...teachers]
    .sort((a, b) => a.teacher.fullName.localeCompare(b.teacher.fullName))
    .map((x) => x.teacher.fullName)
    .join(", ");
}

export default async function ClassesPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const [classes, rooms, classCount, enrollmentCount, teacherLinkCount] = await Promise.all([
    prisma.class.findMany({
      orderBy: { classNumber: "asc" },
      include: {
        teachers: { include: { teacher: true } },
        students: { where: { endDate: null } },
        room: true,
      },
    }),
    prisma.room.findMany({ where: { isHidden: false }, orderBy: { name: "asc" } }),
    prisma.class.count(),
    prisma.studentClass.count({ where: { endDate: null } }),
    prisma.classTeacher.count(),
  ]);

  const metricCard =
    "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900";

  return (
    <div>
      <PageTitle
        title={t(m, "classes.title")}
        subtitle={t(m, "classes.subtitle")}
        action={<AddClassModal rooms={rooms} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={metricCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(m, "classes.metricAll")}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {classCount}
          </p>
        </div>
        <div className={metricCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(m, "classes.metricEnrollments")}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {enrollmentCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(m, "classes.metricEnrollmentsHint")}
          </p>
        </div>
        <div className={metricCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(m, "classes.metricTeachers")}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {teacherLinkCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(m, "classes.metricTeachersHint")}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t(m, "classes.classList")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                {[
                  t(m, "classes.colId"),
                  t(m, "classes.colClass"),
                  t(m, "classes.colTeacher"),
                  t(m, "classes.colRoom"),
                  t(m, "classes.colHours"),
                  t(m, "classes.colStudents"),
                  t(m, "classes.colPrice"),
                  t(m, "classes.colView"),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {classes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    {t(m, "classes.noneYet")}
                  </td>
                </tr>
              ) : (
                classes.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-slate-700 dark:text-slate-300">
                      #{c.classNumber}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {c.name}
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-4 text-slate-600 dark:text-slate-400">
                      {teacherNames(c.teachers)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 dark:text-slate-300">
                      {c.room?.name ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 dark:text-slate-300">
                      {formatTime(c.startHour, c.startMinute)} - {formatTime(c.endHour, c.endMinute)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 dark:text-slate-300">
                      {c.students.length}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 dark:text-slate-300">
                      ${c.pricePerMonth.toFixed(0)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        href={`/classes/${c.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
                        aria-label={`${t(m, "classes.viewAria")} ${c.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
