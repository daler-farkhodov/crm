import { format } from "date-fns";
import { createClosure, deleteClosure } from "@/app/actions/operations";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function ClosuresPage() {
  const [rows, classes] = await Promise.all([
    prisma.schoolClosure.findMany({
      orderBy: { date: "desc" },
      include: { class: true },
    }),
    prisma.class.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="School closures"
        subtitle="Weather days or class-specific cancellations."
        accent="orange"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Add closure</h2>
        <form action={createClosure} className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Date</Label>
            <Input name="date" type="date" required />
          </div>
          <div>
            <Label>Class (blank = all-school)</Label>
            <select
              name="classId"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">Global</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Reason</Label>
            <Input name="reason" placeholder="Snow day" />
          </div>
          <div className="md:col-span-3">
            <Submit variant="orange">Save</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={["Date", "Scope", "Reason", ""]}
        rows={rows.map((c) => [
          format(c.date, "MMM d, yyyy"),
          c.class ? c.class.name : "All school",
          c.reason ?? "—",
          <form key={c.id} action={deleteClosure}>
            <input type="hidden" name="id" value={c.id} />
            <button type="submit" className="text-xs text-red-700 underline">
              Delete
            </button>
          </form>,
        ])}
      />
    </div>
  );
}
