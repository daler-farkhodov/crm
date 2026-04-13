import { format } from "date-fns";
import { createExpense, deleteExpense } from "@/app/actions/operations";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function ExpensesPage() {
  const rows = await prisma.expense.findMany({ orderBy: { date: "desc" } });

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Operating costs with lightweight categorization."
        accent="blue"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Add expense</h2>
        <form action={createExpense} className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Title</Label>
            <Input name="title" required />
          </div>
          <div>
            <Label>Amount</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Date</Label>
            <Input name="date" type="date" required />
          </div>
          <div className="md:col-span-2">
            <Label>Category</Label>
            <Input name="category" placeholder="Supplies" />
          </div>
          <div className="md:col-span-4">
            <Submit variant="blue">Save</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={["Date", "Title", "Category", "Amount", ""]}
        rows={rows.map((e) => [
          format(e.date, "MMM d, yyyy"),
          e.title,
          e.category ?? "—",
          e.amount.toFixed(2),
          <form key={e.id} action={deleteExpense}>
            <input type="hidden" name="id" value={e.id} />
            <button type="submit" className="text-xs text-red-700 underline">
              Delete
            </button>
          </form>,
        ])}
      />
    </div>
  );
}
