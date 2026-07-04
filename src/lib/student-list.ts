import type { Prisma } from "@prisma/client";

export type StudentSearchParams = {
  class?: string;
  status?: string;
  debts?: string;
  startFrom?: string;
  tab?: string;
};

export function debtStudentIdsFromLedger(
  ledgerSums: { studentId: string; _sum: { amount: number | null } }[],
): string[] {
  // Negative balance = student has consumed more than paid → needs invoice.
  return ledgerSums
    .filter((g) => (g._sum.amount ?? 0) < 0)
    .map((g) => g.studentId);
}

export function buildStudentWhere(
  sp: StudentSearchParams,
  debtIds: string[],
): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {};
  const statusFilter = sp.status?.trim() || (sp.debts === "1" || sp.tab === "all" ? "all" : "active");
  if (statusFilter === "active") where.isActive = true;
  if (statusFilter === "inactive") where.isActive = false;
  const classFilter = sp.class?.trim();
  if (classFilter) {
    where.classes = { some: { classId: classFilter, endDate: null } };
  }
  if (sp.debts === "1") {
    where.id = debtIds.length > 0 ? { in: debtIds } : { in: [] };
  }
  const startFrom = sp.startFrom?.trim();
  if (startFrom && !Number.isNaN(new Date(startFrom).getTime())) {
    where.startDate = { gte: new Date(startFrom) };
  }
  return where;
}
