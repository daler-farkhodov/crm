import { createTeacherEarning, toggleTeacherEarningPaid } from "@/app/actions/operations";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function TeacherPayPage() {
  const [rows, teachers] = await Promise.all([
    prisma.teacherEarnings.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { teacher: true },
    }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Teacher pay"
        subtitle="Monthly accruals and payout tracking."
        accent="orange"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Add accrual</h2>
        <form action={createTeacherEarning} className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Teacher</Label>
            <select
              name="teacherId"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Month</Label>
            <Input name="month" type="number" min={1} max={12} required />
          </div>
          <div>
            <Label>Year</Label>
            <Input name="year" type="number" min={2000} max={2100} required />
          </div>
          <div>
            <Label>Amount</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div className="sm:col-span-4">
            <Submit variant="orange">Save</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={["Teacher", "Period", "Amount", "Paid", "Toggle"]}
        rows={rows.map((r) => [
          r.teacher.fullName,
          `${r.month}/${r.year}`,
          r.totalAmount.toFixed(2),
          r.isPaid ? "Yes" : "No",
          <form key={r.id} action={toggleTeacherEarningPaid} className="inline">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="isPaid" value={r.isPaid ? "false" : "true"} />
            <button
              type="submit"
              className="rounded-md border border-line px-2 py-1 text-xs text-slate-800 hover:bg-slate-50"
            >
              Mark {r.isPaid ? "unpaid" : "paid"}
            </button>
          </form>,
        ])}
      />
    </div>
  );
}
