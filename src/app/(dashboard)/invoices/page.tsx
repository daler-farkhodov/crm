import { format } from "date-fns";
import { InvoiceStatus } from "@prisma/client";
import { createInvoice, updateInvoiceStatus } from "@/app/actions/billing";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function InvoicesPage() {
  const [invoices, students] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { student: true },
    }),
    prisma.student.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Tuition periods, credits, and collection state."
        accent="orange"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">New invoice</h2>
        <form action={createInvoice} className="grid gap-3 lg:grid-cols-3">
          <div>
            <Label>Student</Label>
            <select
              name="studentId"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Period start</Label>
            <Input name="periodStart" type="date" required />
          </div>
          <div>
            <Label>Period end</Label>
            <Input name="periodEnd" type="date" required />
          </div>
          <div>
            <Label>Total</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Credit applied</Label>
            <Input name="creditApplied" type="number" step="0.01" required />
          </div>
          <div className="flex items-end">
            <Submit variant="orange">Create + ledger</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={[
          "Student",
          "Period",
          "Total",
          "Credit",
          "Final",
          "Status",
          "Set status",
        ]}
        rows={invoices.map((inv) => [
          inv.student.fullName,
          `${format(inv.periodStart, "MMM d")} – ${format(inv.periodEnd, "MMM d, yyyy")}`,
          inv.totalAmount.toFixed(2),
          inv.creditApplied.toFixed(2),
          inv.finalAmount.toFixed(2),
          inv.status,
          <form key={inv.id} action={updateInvoiceStatus} className="flex gap-2">
            <input type="hidden" name="id" value={inv.id} />
            <select
              name="status"
              className="rounded-lg border border-line px-2 py-1 text-xs"
              defaultValue={inv.status}
            >
              {Object.values(InvoiceStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Submit variant="blue">Save</Submit>
          </form>,
        ])}
      />
    </div>
  );
}
