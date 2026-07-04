import { format } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { buildStudentWhere, debtStudentIdsFromLedger } from "@/lib/student-list";
import { prisma } from "@/lib/prisma";

function csvCell(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(request: NextRequest) {
  if (!request.cookies.get("crm_user_id")?.value) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const ledgerSums = await prisma.ledger.groupBy({
    by: ["studentId"],
    _sum: { amount: true },
  });
  const debtIds = debtStudentIdsFromLedger(ledgerSums);
  const where = buildStudentWhere(sp, debtIds);

  const rows = await prisma.student.findMany({
    where,
    orderBy: { studentNumber: "asc" },
    include: {
      classes: {
        where: { endDate: null },
        include: { class: true },
        orderBy: { startDate: "asc" },
      },
    },
  });

  const balanceMap = Object.fromEntries(
    ledgerSums.map((g) => [g.studentId, g._sum.amount ?? 0]),
  );

  const header = [
    "ID",
    "Name",
    "Classes",
    "Start date",
    "Active",
    "Balance",
    "Next payment due",
  ];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((s) => {
      const classLabel =
        s.classes.map((c) => c.class.name).join("; ") || "";
      const bal = balanceMap[s.id] ?? 0;
      return [
        String(s.studentNumber),
        s.fullName,
        classLabel,
        format(s.startDate, "yyyy-MM-dd"),
        s.isActive ? "yes" : "no",
        bal.toFixed(2),
        s.nextPaymentDue ? format(s.nextPaymentDue, "yyyy-MM-dd") : "",
      ]
        .map(csvCell)
        .join(",");
    }),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="students-export.csv"',
    },
  });
}
