import { format } from "date-fns";
import { PageTitle, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageTitle title={t(m, "audit.title")} subtitle={t(m, "audit.subtitle")} />
      <Table
        emptyMessage={t(m, "ui.noRecords")}
        headers={[
          t(m, "audit.colWhen"),
          t(m, "audit.colUser"),
          t(m, "audit.colAction"),
          t(m, "audit.colEntity"),
          t(m, "audit.colEntityId"),
        ]}
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
