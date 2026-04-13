import { prisma } from "@/lib/prisma";
import { loginAsUser, logout } from "@/app/actions/auth";
import { Card, PageHeader, Submit } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen bg-white px-4 py-16">
      <div className="mx-auto max-w-md">
        <PageHeader
          title="Sign in"
          subtitle="Demo mode: pick a user to attribute audit log entries."
          accent="orange"
        />
        <Card>
          <form action={loginAsUser} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                User
              </label>
              <select
                name="userId"
                required
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <Submit variant="blue">Continue</Submit>
          </form>
          <form action={logout} className="mt-4">
            <button
              type="submit"
              className="text-sm text-slate-500 underline hover:text-slate-800"
            >
              Clear session
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
