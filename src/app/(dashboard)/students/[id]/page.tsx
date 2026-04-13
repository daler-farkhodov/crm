import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { enrollStudent, endEnrollment } from "@/app/actions/students";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      classes: { include: { class: true } },
      ledger: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!student) notFound();

  const classes = await prisma.class.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title={student.fullName}
        subtitle="Enrollments and recent ledger movement."
        accent="blue"
      />
      <div className="mb-4 text-sm">
        <Link href="/students" className="text-accent-blue hover:underline">
          ← Back to students
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Enroll in a class
          </h2>
          <form action={enrollStudent} className="grid gap-3">
            <input type="hidden" name="studentId" value={student.id} />
            <div>
              <Label>Class</Label>
              <select
                name="classId"
                required
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (${c.pricePerMonth}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Start date</Label>
              <Input name="startDate" type="date" required />
            </div>
            <Submit variant="orange">Enroll</Submit>
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Recent ledger
          </h2>
          <Table
            headers={["Type", "Amount", "When"]}
            rows={student.ledger.map((l) => [
              l.type,
              l.amount.toFixed(2),
              format(l.createdAt, "MMM d, yyyy"),
            ])}
          />
        </Card>
      </div>
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Enrollments</h2>
        <Table
          headers={["Class", "Start", "End", ""]}
          rows={student.classes.map((sc) => [
            sc.class.name,
            format(sc.startDate, "MMM d, yyyy"),
            sc.endDate ? format(sc.endDate, "MMM d, yyyy") : "Active",
            sc.endDate ? (
              "—"
            ) : (
              <form key={sc.id} action={endEnrollment} className="flex gap-2">
                <input type="hidden" name="id" value={sc.id} />
                <Input name="endDate" type="date" required className="max-w-[11rem]" />
                <Submit variant="blue">End</Submit>
              </form>
            ),
          ])}
        />
      </div>
    </div>
  );
}
