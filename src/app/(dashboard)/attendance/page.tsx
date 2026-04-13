import { AttendanceStatus } from "@prisma/client";
import { format } from "date-fns";
import { createAttendance, deleteAttendance } from "@/app/actions/attendance";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function AttendancePage() {
  const [records, students, classes, teachers] = await Promise.all([
    prisma.attendance.findMany({
      orderBy: { date: "desc" },
      take: 40,
      include: { student: true, class: true, teacher: true },
    }),
    prisma.student.findMany({ orderBy: { fullName: "asc" } }),
    prisma.class.findMany({ orderBy: { name: "asc" } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Capture daily status per student and class."
        accent="blue"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Log session</h2>
        <form
          action={createAttendance}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <Label>Student</Label>
            <select
              name="studentId"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Class</Label>
            <select
              name="classId"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Teacher (optional)</Label>
            <select
              name="teacherId"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Date</Label>
            <Input name="date" type="datetime-local" required />
          </div>
          <div>
            <Label>Status</Label>
            <select
              name="status"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {Object.values(AttendanceStatus).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isTrial" className="rounded border-line" />
              Trial
            </label>
            <Submit variant="orange">Save</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={["Date", "Student", "Class", "Teacher", "Status", "Trial", ""]}
        rows={records.map((r) => [
          format(r.date, "MMM d, yyyy HH:mm"),
          r.student.fullName,
          r.class.name,
          r.teacher?.fullName ?? "—",
          r.status,
          r.isTrial ? "Yes" : "",
          <form key={r.id} action={deleteAttendance}>
            <input type="hidden" name="id" value={r.id} />
            <button
              type="submit"
              className="text-xs text-red-700 underline hover:text-red-900"
            >
              Delete
            </button>
          </form>,
        ])}
      />
    </div>
  );
}
