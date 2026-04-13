import { UserRole } from "@prisma/client";
import { createUser } from "@/app/actions/operations";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function UsersPage() {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Accounts for admins and linked teachers."
        accent="blue"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Invite user</h2>
        <form action={createUser} className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" required />
          </div>
          <div>
            <Label>Full name</Label>
            <Input name="fullName" required />
          </div>
          <div>
            <Label>Role</Label>
            <select
              name="role"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <Submit variant="blue">Create</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={["Name", "Email", "Role", "Created"]}
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
