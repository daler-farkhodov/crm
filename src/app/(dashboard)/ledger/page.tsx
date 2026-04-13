import { LedgerType } from "@prisma/client";
import { format } from "date-fns";
import { createLedgerEntry } from "@/app/actions/billing";
import { prisma } from "@/lib/prisma";
import { Card, Input, Label, PageHeader, Submit, Table } from "@/components/ui";

export default async function LedgerPage() {
  const [entries, students, invoices] = await Promise.all([
    prisma.ledger.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { student: true, invoice: true },
    }),
    prisma.student.findMany({ orderBy: { fullName: "asc" } }),
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { student: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Ledger"
        subtitle="All student financial movements."
        accent="blue"
      />
      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Manual entry</h2>
        <form action={createLedgerEntry} className="grid gap-3 lg:grid-cols-3">
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
            <Label>Type</Label>
            <select
              name="type"
              required
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {Object.values(LedgerType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Amount (+ charge, – payment)</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Invoice ref (required for INVOICE)</Label>
            <select
              name="referenceId"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.student.fullName} · {format(i.periodStart, "MMM yyyy")} ·{" "}
                  {i.finalAmount.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Reference note</Label>
            <Input name="referenceType" placeholder="Check #123" />
          </div>
          <div className="flex items-end">
            <Submit variant="blue">Post</Submit>
          </div>
        </form>
      </Card>
      <Table
        headers={["When", "Student", "Type", "Amount", "Ref"]}
        rows={entries.map((e) => [
          format(e.createdAt, "MMM d, yyyy HH:mm"),
          e.student.fullName,
          e.type,
          e.amount.toFixed(2),
          e.invoice
            ? `Invoice ${format(e.invoice.periodStart, "MMM yyyy")}`
            : e.referenceType ?? "—",
        ])}
      />
    </div>
  );
}
