import {
  assignClassTeacher,
  createClass,
  removeClassTeacher,
  updateClass,
  updateClassTeacherShare,
} from "@/app/actions/classes";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function ClassesPage() {
  const [classes, teachers] = await Promise.all([
    prisma.class.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        teachers: { include: { teacher: true } },
        students: { where: { endDate: null }, include: { student: true } },
      },
    }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Classes"
        subtitle="Catalog, roster size, and revenue share per teacher."
        accent="orange"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Add class</h2>
        <form action={createClass} className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input name="name" required placeholder="Algebra I" />
          </div>
          <div>
            <Label>Price / month</Label>
            <Input name="pricePerMonth" type="number" step="0.01" required />
          </div>
          <div className="sm:col-span-3">
            <Submit variant="orange">Create</Submit>
          </div>
        </form>
      </Card>
      <div className="space-y-8">
        {classes.map((c) => (
          <Card key={c.id}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{c.name}</h3>
                <p className="text-sm text-slate-600">
                  ${c.pricePerMonth.toFixed(2)} / month ·{" "}
                  {c.students.length} active seats
                </p>
              </div>
              <form action={updateClass} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={c.id} />
                <Input name="name" defaultValue={c.name} required />
                <Input
                  name="pricePerMonth"
                  type="number"
                  step="0.01"
                  defaultValue={c.pricePerMonth}
                  required
                  className="w-28"
                />
                <Submit variant="blue">Update</Submit>
              </form>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Teachers & share
                </h4>
                <Table
                  headers={["Teacher", "%", ""]}
                  rows={c.teachers.map((ct) => [
                    ct.teacher.fullName,
                    <form
                      key={`p-${ct.id}`}
                      action={updateClassTeacherShare}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={ct.id} />
                      <Input
                        name="percentage"
                        type="number"
                        step="0.1"
                        defaultValue={ct.percentage}
                        required
                        className="w-24"
                      />
                      <Submit variant="orange">Save</Submit>
                    </form>,
                    <form key={`r-${ct.id}`} action={removeClassTeacher}>
                      <input type="hidden" name="id" value={ct.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-700 underline"
                      >
                        Remove
                      </button>
                    </form>,
                  ])}
                />
                <form
                  action={assignClassTeacher}
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
                >
                  <input type="hidden" name="classId" value={c.id} />
                  <div>
                    <Label>Teacher</Label>
                    <select
                      name="teacherId"
                      required
                      className="rounded-lg border border-line px-2 py-2 text-sm"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Share %</Label>
                    <Input
                      name="percentage"
                      type="number"
                      step="0.1"
                      defaultValue={40}
                      required
                      className="w-24"
                    />
                  </div>
                  <Submit variant="blue">Assign</Submit>
                </form>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Active students
                </h4>
                <ul className="text-sm text-slate-800">
                  {c.students.length === 0 ? (
                    <li className="text-slate-500">No active enrollments.</li>
                  ) : (
                    c.students.map((sc) => (
                      <li key={sc.id}>{sc.student.fullName}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
