import { createTeacher, linkTeacherUser, updateTeacher } from "@/app/actions/teachers";
import { Card, Input, Label, PageTitle, Submit, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function TeachersPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const [teachers, users] = await Promise.all([
    prisma.teacher.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true, classes: { include: { class: true } } },
    }),
    prisma.user.findMany({ orderBy: { email: "asc" } }),
  ]);

  return (
    <div>
      <PageTitle title={t(m, "teachers.title")} subtitle={t(m, "teachers.subtitle")} />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          {t(m, "teachers.addTeacher")}
        </h2>
        <form action={createTeacher} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Label>{t(m, "teachers.labelFullName")}</Label>
            <Input name="fullName" required placeholder="Jamie Rivera" />
          </div>
          <Submit variant="blue">{t(m, "teachers.create")}</Submit>
        </form>
      </Card>
      <Table
        emptyMessage={t(m, "ui.noRecords")}
        headers={[
          t(m, "teachers.colName"),
          t(m, "teachers.colLinkedUser"),
          t(m, "teachers.colClasses"),
          t(m, "teachers.colRename"),
          t(m, "teachers.colLinkUser"),
        ]}
        rows={teachers.map((teacherRow) => [
          teacherRow.fullName,
          teacherRow.user ? `${teacherRow.user.email}` : "—",
          teacherRow.classes.map((c) => `${c.class.name} (${c.percentage}%)`).join(", ") ||
            "—",
          <form key={`e-${teacherRow.id}`} action={updateTeacher} className="flex gap-2">
            <input type="hidden" name="id" value={teacherRow.id} />
            <Input name="fullName" defaultValue={teacherRow.fullName} required />
            <Submit variant="orange">{t(m, "teachers.save")}</Submit>
          </form>,
          <form key={`l-${teacherRow.id}`} action={linkTeacherUser} className="flex gap-2">
            <input type="hidden" name="teacherId" value={teacherRow.id} />
            <select
              name="userId"
              className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs"
              defaultValue={teacherRow.userId ?? ""}
            >
              <option value="">{t(m, "teachers.noneUser")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
            <Submit variant="blue">{t(m, "teachers.link")}</Submit>
          </form>,
        ])}
      />
    </div>
  );
}
