import { AttendanceStatus } from "@prisma/client";
import { addDays, endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";
import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { AttendanceTabs, type CalendarClass, type CancellationInfo } from "@/components/AttendanceTabs";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

type Search = {
  day?: string;
  tab?: string;
  q?: string;
  sf?: string;
  from?: string;
  to?: string;
};

function parseSelectedDay(raw: string | undefined): Date {
  if (!raw) return startOfDay(new Date());
  const parsed = parseISO(raw);
  return isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const sp = await searchParams;

  const activeTab = sp.tab === "students" ? "students" : "calendar";

  // ── Calendar data ────────────────────────────────────────────────────────────
  const selectedDay = parseSelectedDay(sp.day);
  const dayStart = startOfDay(selectedDay);
  const dayEnd = endOfDay(selectedDay);
  const selectedDayStr = format(selectedDay, "yyyy-MM-dd");
  const prevDay = format(addDays(selectedDay, -1), "yyyy-MM-dd");
  const nextDay = format(addDays(selectedDay, 1), "yyyy-MM-dd");
  const dayCode = format(selectedDay, "EEE").toUpperCase().slice(0, 3);

  // ── Students tab date range ───────────────────────────────────────────────────
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const studentDateFrom = sp.from ? parseISO(sp.from) : undefined;
  const studentDateTo = sp.to ? endOfDay(parseISO(sp.to)) : endOfDay(new Date());

  const [records, classes, cancellations, studentAttendance, students] = await Promise.all([
    // Calendar: attendance records for selected day
    prisma.attendance.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      orderBy: { date: "asc" },
      include: { student: true, class: true, teacher: true },
    }),
    // All classes with rooms
    prisma.class.findMany({
      orderBy: [{ room: { name: "asc" } }, { startHour: "asc" }, { name: "asc" }],
      include: { room: true },
    }),
    // Cancellations (closures) for the selected day
    prisma.schoolClosure.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
    }),
    // Students tab: attendance aggregated
    prisma.attendance.findMany({
      where: {
        date: {
          gte: studentDateFrom,
          lte: studentDateTo,
        },
        status: {
          in: [
            AttendanceStatus.PRESENT,
            AttendanceStatus.ABSENT_SERIOUS,
            AttendanceStatus.ABSENT_NON_SERIOUS,
          ],
        },
      },
      select: { studentId: true, status: true },
    }),
    // Students with their class names
    prisma.student.findMany({
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        parentPhone: true,
        isActive: true,
        classes: {
          where: { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
          select: { class: { select: { name: true } } },
          orderBy: { startDate: "asc" },
        },
      },
    }),
  ]);

  // ── Build calendar structures ─────────────────────────────────────────────────
  const visibleClasses = classes.filter((c) => !c.room?.isHidden);
  const roomMap = new Map<string, { id: string; name: string }>();
  for (const cls of visibleClasses) {
    if (cls.room && !roomMap.has(cls.room.id)) {
      roomMap.set(cls.room.id, cls.room);
    }
  }
  const rooms = [...roomMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const scheduledByRoomHourRaw = new Map<string, CalendarClass[]>();
  for (const cls of visibleClasses) {
    if (!cls.scheduleDays.includes(dayCode)) continue;
    for (let hour = cls.startHour; hour < cls.endHour; hour++) {
      const key = `${cls.room?.id ?? "none"}-${String(hour).padStart(2, "0")}`;
      scheduledByRoomHourRaw.set(key, [
        ...(scheduledByRoomHourRaw.get(key) ?? []),
        {
          id: cls.id,
          name: cls.name,
          roomId: cls.roomId,
          startHour: cls.startHour,
          startMinute: cls.startMinute,
          endHour: cls.endHour,
          endMinute: cls.endMinute,
          scheduleDays: cls.scheduleDays,
        },
      ]);
    }
  }

  const attendanceCountByClass: Record<string, number> = {};
  for (const r of records) {
    attendanceCountByClass[r.classId] = (attendanceCountByClass[r.classId] ?? 0) + 1;
  }

  const scheduledByRoomHour: Record<string, CalendarClass[]> = Object.fromEntries(
    scheduledByRoomHourRaw,
  );

  const cancellationList: CancellationInfo[] = cancellations.map((c) => ({
    classId: c.classId,
    date: c.date.toISOString(),
    reason: c.reason,
  }));

  // KPIs
  const presentCount = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const absentCount = records.filter(
    (r) =>
      r.status === AttendanceStatus.ABSENT_SERIOUS ||
      r.status === AttendanceStatus.ABSENT_NON_SERIOUS,
  ).length;
  const lateCount = records.filter(
    (r) =>
      r.status === AttendanceStatus.SCHOOL_CLOSED ||
      r.status === AttendanceStatus.CLASS_CANCELED,
  ).length;
  const trialCount = records.filter((r) => r.isTrial).length;

  // All classes for cancel modal
  const allClassOptions = classes.map((c) => ({
    id: c.id,
    name: c.name,
    scheduleDays: c.scheduleDays,
  }));

  // ── Build students tab data ───────────────────────────────────────────────────
  const presentByStudent = new Map<string, number>();
  const absentByStudent = new Map<string, number>();
  for (const rec of studentAttendance) {
    if (rec.status === AttendanceStatus.PRESENT) {
      presentByStudent.set(rec.studentId, (presentByStudent.get(rec.studentId) ?? 0) + 1);
    } else {
      absentByStudent.set(rec.studentId, (absentByStudent.get(rec.studentId) ?? 0) + 1);
    }
  }

  const studentStats = students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    phone: s.phone,
    parentPhone: s.parentPhone,
    className: s.classes.map((sc) => sc.class.name).join(", "),
    isActive: s.isActive,
    presentCount: presentByStudent.get(s.id) ?? 0,
    absentCount: absentByStudent.get(s.id) ?? 0,
  }));

  return (
    <div>
      <PageTitle title={t(m, "attendance.title")} subtitle={t(m, "attendance.subtitle")} />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}>
      <AttendanceTabs
        tab={activeTab}
        selectedDayStr={selectedDayStr}
        prevDay={prevDay}
        nextDay={nextDay}
        rooms={rooms}
        hours={HOURS}
        scheduledByRoomHour={scheduledByRoomHour}
        attendanceCountByClass={attendanceCountByClass}
        cancellations={cancellationList}
        allClasses={allClassOptions}
        presentCount={presentCount}
        absentCount={absentCount}
        lateCount={lateCount}
        trialCount={trialCount}
        totalRecords={records.length}
        studentStats={studentStats}
        defaultDateFrom="2020-01-01"
        defaultDateTo={todayStr}
      />
      </Suspense>
    </div>
  );
}
