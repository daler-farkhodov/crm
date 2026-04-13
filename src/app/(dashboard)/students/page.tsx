import Link from "next/link";
import { format } from "date-fns";
import { deleteStudent, updateStudent } from "@/app/actions/students";
import { StudentCreateForm } from "@/components/StudentCreateForm";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Table } from "@/components/ui";

export default async function StudentsPage() {
  const [rows, classes] = await Promise.all([
    prisma.student.findMany({
      orderBy: { createdAt: "desc" },
      include: { classes: { include: { class: true } } },
    }),
    prisma.class.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Roster, lifecycle, and class placements."
        accent="orange"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          Add student
        </h2>
        <StudentCreateForm classes={classes} />
      </Card>
      <Table
        headers={["Name", "Start", "Active", "Classes", "Actions"]}
        rows={rows.map((s) => [
          <Link
            key="n"
            href={`/students/${s.id}`}
            className="font-medium text-accent-blue hover:underline"
          >
            {s.fullName}
          </Link>,
          format(s.startDate, "MMM d, yyyy"),
          s.isActive ? "Yes" : "No",
          s.classes
            .filter((c) => !c.endDate)
            .map((c) => c.class.name)
            .join(", ") || "—",
          <div key="a" className="flex flex-wrap gap-2">
            <form action={updateStudent} className="flex items-center gap-1">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="fullName" value={s.fullName} />
              <input
                type="hidden"
                name="startDate"
                value={format(s.startDate, "yyyy-MM-dd")}
              />
              <input
                type="hidden"
                name="isActive"
                value={s.isActive ? "false" : "true"}
              />
              <button
                type="submit"
                className="rounded-md border border-line px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Toggle active
              </button>
            </form>
            <form action={deleteStudent} className="inline">
              <input type="hidden" name="id" value={s.id} />
              <button
                type="submit"
                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </form>
          </div>,
        ])}
      />
    </div>
  );
}
