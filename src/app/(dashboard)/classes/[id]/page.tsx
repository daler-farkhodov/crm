import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { TimeRangeField } from "@/components/TimeRangeField";
import { setAssistantAttendance } from "@/app/actions/attendance";
import {
  assignClassTeacher,
  createTeacherOverride,
  removeClassTeacher,
  updateClassDetails,
  updateClassTeacherShare,
} from "@/app/actions/classes";
import { Card, Input, Label, PageTitle, Submit } from "@/components/ui";
import { OverrideDeleteButton } from "@/components/OverrideDeleteButton";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

const DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

function dayLabel(m: ReturnType<typeof getMessages>, code: string) {
  const map: Record<string, string> = {
    MON: t(m, "classDetail.dayMon"),
    TUE: t(m, "classDetail.dayTue"),
    WED: t(m, "classDetail.dayWed"),
    THU: t(m, "classDetail.dayThu"),
    FRI: t(m, "classDetail.dayFri"),
    SAT: t(m, "classDetail.daySat"),
    SUN: t(m, "classDetail.daySun"),
  };
  return map[code] ?? code;
}

const selectCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const { id } = await params;
  const [row, teachers, rooms] = await Promise.all([
    prisma.class.findUnique({
      where: { id },
      include: {
        teachers: {
          include: {
            teacher: true,
            assistantAttendance: { orderBy: { date: "desc" }, take: 5 },
          },
        },
        students: {
          where: { endDate: null },
          include: { student: true },
          orderBy: { startDate: "asc" },
        },
        room: true,
        teacherOverrides: {
          include: {
            originalTeacher: true,
            substituteTeacher: true,
          },
          orderBy: { date: "desc" },
        },
      },
    }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
    prisma.room.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!row) notFound();

  const mainTeachers = row.teachers.filter((ct) => ct.role === "TEACHER");
  const assistants = row.teachers.filter((ct) => ct.role === "ASSISTANT");

  const defaultLeadSelect =
    mainTeachers.length === 1 ? mainTeachers[0]!.teacherId : "";

  const scheduleLabel =
    row.scheduleDays.length > 0
      ? row.scheduleDays.map((code) => dayLabel(m, code)).join(", ")
      : t(m, "classDetail.scheduleNotSet");

  const fmtTime = (h: number, m2: number) => `${h}:${String(m2).padStart(2, "0")}`;
  const subtitle = `${t(m, "classDetail.classWord")} #${row.classNumber} · ${row.room?.name ?? "—"} · ${fmtTime(row.startHour, row.startMinute)}-${fmtTime(row.endHour, row.endMinute)} · $${row.pricePerMonth.toFixed(2)}${t(m, "classDetail.perMonth")} · ${scheduleLabel}`;

  return (
    <div>
      <Link
        href="/classes"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t(m, "classDetail.back")}
      </Link>

      <PageTitle title={row.name} subtitle={subtitle} />

      {/* ── Edit class details ── */}
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t(m, "classDetail.editTitle")}
        </h2>
        <form action={updateClassDetails} className="space-y-5">
          <input type="hidden" name="id" value={row.id} />
          <div className="grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label>{t(m, "classes.name")}</Label>
              <Input name="name" required defaultValue={row.name} />
            </div>
            <div>
              <Label>{t(m, "classDetail.room")}</Label>
              <select name="roomId" defaultValue={row.roomId ?? ""} className={selectCls}>
                <option value="">— no room —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.isHidden ? " (hidden)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <TimeRangeField
              startLabel={t(m, "classDetail.startHour")}
              endLabel={t(m, "classDetail.endHour")}
              startDefault={`${row.startHour}:${String(row.startMinute).padStart(2, "0")}`}
              endDefault={`${row.endHour}:${String(row.endMinute).padStart(2, "0")}`}
            />
            <div>
              <Label>{t(m, "classes.priceMonth")}</Label>
              <Input
                name="pricePerMonth"
                type="number"
                step="0.01"
                required
                defaultValue={row.pricePerMonth}
              />
            </div>
          </div>
          <div>
            <Label>{t(m, "classDetail.scheduleDays")}</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {DAY_CODES.map((code) => (
                <label
                  key={code}
                  className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    name="scheduleDays"
                    value={code}
                    defaultChecked={row.scheduleDays.includes(code)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  {dayLabel(m, code)}
                </label>
              ))}
            </div>
          </div>
          <div className="max-w-md">
            <Label>{t(m, "classDetail.leadTeacher")}</Label>
            <select name="leadTeacherId" defaultValue={defaultLeadSelect} className={`mt-1 ${selectCls}`}>
              <option value="">{t(m, "classDetail.keepTeachers")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t(m, "classDetail.leadHint")}
            </p>
          </div>
          <Submit variant="orange">{t(m, "classDetail.save")}</Submit>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Students ── */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(m, "classDetail.students")}
          </h2>
          <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-700">
            {row.students.length === 0 ? (
              <li className="py-4 text-slate-500 dark:text-slate-400">
                {t(m, "classDetail.noEnrollments")}
              </li>
            ) : (
              row.students.map((sc) => (
                <li
                  key={sc.id}
                  className="flex justify-between gap-3 py-3 text-slate-800 dark:text-slate-200"
                >
                  <span className="font-medium">{sc.student.fullName}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t(m, "classDetail.since")} {format(sc.startDate, "MMM d, yyyy")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>

        {/* ── Teachers & salary ── */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Teachers
            </h2>

            {/* Existing teachers */}
            <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-700">
              {mainTeachers.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No teachers assigned</p>
              ) : (
                mainTeachers.map((ct) => (
                  <div key={ct.id} className="pt-3 first:pt-0">
                    <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {ct.teacher.fullName}
                    </p>
                    <form action={updateClassTeacherShare} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={ct.id} />
                      {/* Salary type toggle */}
                      <div>
                        <Label>Salary type</Label>
                        <select name="salaryType" defaultValue={ct.salaryType} className={`w-36 ${selectCls}`}>
                          <option value="PERCENTAGE">% of income</option>
                          <option value="FIXED">Fixed amount</option>
                        </select>
                      </div>
                      <div>
                        <Label>% share</Label>
                        <Input
                          name="percentage"
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          defaultValue={ct.percentage}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <Label>Fixed $</Label>
                        <Input
                          name="fixedAmount"
                          type="number"
                          step="0.01"
                          min={0}
                          defaultValue={ct.fixedAmount ?? ""}
                          placeholder="—"
                          className="w-24"
                        />
                      </div>
                      <Submit variant="blue">Save</Submit>
                    </form>
                    <form action={removeClassTeacher} className="mt-1">
                      <input type="hidden" name="id" value={ct.id} />
                      <button type="submit" className="text-xs text-red-600 underline hover:text-red-800 dark:text-red-400">
                        Remove
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>

            {/* Add teacher */}
            <form
              action={assignClassTeacher}
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"
            >
              <input type="hidden" name="classId" value={row.id} />
              <input type="hidden" name="role" value="TEACHER" />
              <div>
                <Label>Add teacher</Label>
                <select name="teacherId" required className={`w-44 ${selectCls}`}>
                  {teachers.map((tc) => (
                    <option key={tc.id} value={tc.id}>{tc.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Salary type</Label>
                <select name="salaryType" className={`w-36 ${selectCls}`}>
                  <option value="PERCENTAGE">% of income</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div>
                <Label>% share</Label>
                <Input name="percentage" type="number" step="0.1" min={0} max={100} defaultValue={40} className="w-20" />
              </div>
              <div>
                <Label>Fixed $</Label>
                <Input name="fixedAmount" type="number" step="0.01" min={0} placeholder="—" className="w-24" />
              </div>
              <Submit variant="blue">Assign</Submit>
            </form>
          </Card>

          {/* ── Assistants ── */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Assistants
            </h2>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-700">
              {assistants.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No assistants</p>
              ) : (
                assistants.map((ct) => (
                  <div key={ct.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {ct.teacher.fullName}
                          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            ASSISTANT
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Fixed: ${ct.fixedAmount?.toFixed(2) ?? "—"}/month
                        </p>
                      </div>
                      <form action={removeClassTeacher}>
                        <input type="hidden" name="id" value={ct.id} />
                        <button type="submit" className="text-xs text-red-600 underline hover:text-red-800 dark:text-red-400">
                          Remove
                        </button>
                      </form>
                    </div>

                    {/* Mark present for a session */}
                    <form action={setAssistantAttendance} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="classTeacherId" value={ct.id} />
                      <input type="hidden" name="present" value="true" />
                      <div>
                        <Label>Mark present</Label>
                        <Input name="date" type="date" required className="w-40" />
                      </div>
                      <Submit variant="blue">Mark present</Submit>
                    </form>

                    {/* Recent sessions */}
                    {ct.assistantAttendance.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ct.assistantAttendance.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"
                          >
                            <span>
                              {format(row.date, "MMM d, yyyy")} —{" "}
                              {row.present ? (
                                <span className="text-emerald-600 dark:text-emerald-400">present</span>
                              ) : (
                                "absent"
                              )}
                            </span>
                            <form action={setAssistantAttendance}>
                              <input type="hidden" name="classTeacherId" value={ct.id} />
                              <input type="hidden" name="date" value={format(row.date, "yyyy-MM-dd")} />
                              <input type="hidden" name="present" value="false" />
                              <button
                                type="submit"
                                className="text-red-600 underline hover:text-red-800 dark:text-red-400"
                              >
                                Unmark
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add assistant */}
            <form
              action={assignClassTeacher}
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"
            >
              <input type="hidden" name="classId" value={row.id} />
              <input type="hidden" name="role" value="ASSISTANT" />
              <input type="hidden" name="salaryType" value="FIXED" />
              <input type="hidden" name="percentage" value="0" />
              <div>
                <Label>Add assistant</Label>
                <select name="teacherId" required className={`w-44 ${selectCls}`}>
                  {teachers.map((tc) => (
                    <option key={tc.id} value={tc.id}>{tc.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Fixed salary $</Label>
                <Input name="fixedAmount" type="number" step="0.01" min={0} required className="w-28" />
              </div>
              <Submit variant="blue">Add</Submit>
            </form>
          </Card>
        </div>
      </div>

      {/* ── Day-specific teacher overrides ── */}
      <Card className="mt-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Day Overrides — Substitutions
        </h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          When a teacher misses a specific class day, record it here. Their salary will be prorated;
          the substitute (if any) is credited for those sessions.
        </p>

        {/* Existing overrides */}
        {row.teacherOverrides.length > 0 && (
          <div className="mb-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {["Date", "Original teacher", "Substitute", "Reason", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {row.teacherOverrides.map((ov) => (
                  <tr key={ov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                      {format(ov.date, "MMM d, yyyy")}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {ov.originalTeacher.fullName}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {ov.substituteTeacher.fullName}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {ov.reason ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <OverrideDeleteButton
                        id={ov.id}
                        substituteName={ov.substituteTeacher.fullName}
                        originalTeacherName={ov.originalTeacher.fullName}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add override */}
        <form action={createTeacherOverride} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="classId" value={row.id} />
          <div>
            <Label>Date</Label>
            <Input name="date" type="date" required className="w-40" />
          </div>
          <div>
            <Label>Teacher who missed</Label>
            <select name="originalTeacherId" required className={`w-44 ${selectCls}`}>
              {row.teachers
                .filter((ct) => ct.role === "TEACHER")
                .map((ct) => (
                  <option key={ct.teacherId} value={ct.teacherId}>
                    {ct.teacher.fullName}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label>Substitute</Label>
            <select name="substituteTeacherId" required defaultValue="" className={`w-44 ${selectCls}`}>
              <option value="" disabled>
                — select —
              </option>
              {teachers.map((tc) => (
                <option key={tc.id} value={tc.id}>{tc.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Reason</Label>
            <Input name="reason" placeholder="e.g. sick leave" className="w-48" />
          </div>
          <Submit variant="orange">Record</Submit>
        </form>
      </Card>
    </div>
  );
}
