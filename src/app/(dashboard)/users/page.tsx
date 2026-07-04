import { UserRole } from "@prisma/client";
import { createUser } from "@/app/actions/operations";
import { Card, Input, Label, PageTitle, Submit, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageTitle title={t(m, "users.title")} subtitle={t(m, "users.subtitle")} />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          {t(m, "users.inviteUser")}
        </h2>
        <form action={createUser} className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>{t(m, "users.email")}</Label>
            <Input name="email" type="email" required />
          </div>
          <div>
            <Label>{t(m, "users.fullName")}</Label>
            <Input name="fullName" required />
          </div>
          <div>
            <Label>{t(m, "users.role")}</Label>
            <select
              name="role"
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
            >
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <Submit variant="blue">{t(m, "users.create")}</Submit>
          </div>
        </form>
      </Card>
      <Table
        emptyMessage={t(m, "ui.noRecords")}
        headers={[
          t(m, "users.colName"),
          t(m, "users.colEmail"),
          t(m, "users.colRole"),
          t(m, "users.colCreated"),
        ]}
        rows={rows.map((u) => [
          u.fullName,
          u.email,
          u.role,
          u.createdAt.toISOString().slice(0, 10),
        ])}
      />
    </div>
  );
}
