import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PageHeader, Table } from "@/components/ui";

export default async function AuditPage() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Immutable trail of sensitive mutations."
        accent="orange"
      />
      <Table
        headers={["When", "User", "Action", "Entity", "Entity id"]}
        rows={rows.map((a) => [
          format(a.createdAt, "MMM d, yyyy HH:mm:ss"),
          a.userId ?? "—",
          a.action,
          a.entity,
          a.entityId,
        ])}
      />
    </div>
  );
}
