import { createTeacher, linkTeacherUser, updateTeacher } from "@/app/actions/teachers";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function TeachersPage() {
  const [teachers, users] = await Promise.all([
    prisma.teacher.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true, classes: { include: { class: true } } },
    }),
    prisma.user.findMany({ orderBy: { email: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle="Staff roster and optional login linkage."
        accent="blue"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Add teacher</h2>
        <form action={createTeacher} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Label>Full name</Label>
            <Input name="fullName" required placeholder="Jamie Rivera" />
          </div>
          <Submit variant="blue">Create</Submit>
        </form>
      </Card>
      <Table
        headers={["Name", "Linked user", "Classes", "Rename", "Link user"]}
        rows={teachers.map((t) => [
          t.fullName,
          t.user ? `${t.user.email}` : "—",
          t.classes.map((c) => `${c.class.name} (${c.percentage}%)`).join(", ") ||
            "—",
          <form key={`e-${t.id}`} action={updateTeacher} className="flex gap-2">
            <input type="hidden" name="id" value={t.id} />
            <Input name="fullName" defaultValue={t.fullName} required />
            <Submit variant="orange">Save</Submit>
          </form>,
          <form key={`l-${t.id}`} action={linkTeacherUser} className="flex gap-2">
            <input type="hidden" name="teacherId" value={t.id} />
            <select
              name="userId"
              className="rounded-lg border border-line px-2 py-1 text-xs"
              defaultValue={t.userId ?? ""}
            >
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
            <Submit variant="blue">Link</Submit>
          </form>,
        ])}
      />
    </div>
  );
}
