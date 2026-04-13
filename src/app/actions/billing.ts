"use server";

import { InvoiceStatus, LedgerType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

const invoiceStatuses = new Set(Object.values(InvoiceStatus));
const ledgerTypes = new Set(Object.values(LedgerType));

export async function createInvoice(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const periodStart = String(formData.get("periodStart") || "");
  const periodEnd = String(formData.get("periodEnd") || "");
  const totalAmount = Number(formData.get("totalAmount"));
  const creditApplied = Number(formData.get("creditApplied"));
  if (
    !studentId ||
    !periodStart ||
    !periodEnd ||
    Number.isNaN(totalAmount) ||
    Number.isNaN(creditApplied)
  )
    return;
  const finalAmount = totalAmount - creditApplied;
  const actor = await getActorUserId();
  const inv = await prisma.invoice.create({
    data: {
      studentId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalAmount,
      creditApplied,
      finalAmount,
      status: InvoiceStatus.PENDING,
    },
  });
  await prisma.ledger.create({
    data: {
      studentId,
      type: LedgerType.INVOICE,
      amount: finalAmount,
      referenceId: inv.id,
      referenceType: "Invoice",
    },
  });
  await writeAudit(actor, "CREATE", "Invoice", inv.id);
  revalidatePath("/invoices");
  revalidatePath("/ledger");
}

export async function updateInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !invoiceStatuses.has(status as InvoiceStatus)) return;
  const actor = await getActorUserId();
  await prisma.invoice.update({
    where: { id },
    data: { status: status as InvoiceStatus },
  });
  await writeAudit(actor, "UPDATE_STATUS", "Invoice", id);
  revalidatePath("/invoices");
}

export async function createLedgerEntry(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const type = String(formData.get("type") || "");
  const amount = Number(formData.get("amount"));
  const referenceId = String(formData.get("referenceId") || "");
  const referenceType = String(formData.get("referenceType") || "");
  if (!studentId || !ledgerTypes.has(type as LedgerType) || Number.isNaN(amount))
    return;
  const actor = await getActorUserId();
  if (type === LedgerType.INVOICE && !referenceId) return;
  const row = await prisma.ledger.create({
    data: {
      studentId,
      type: type as LedgerType,
      amount,
      referenceId: type === LedgerType.INVOICE ? referenceId : null,
      referenceType:
        type === LedgerType.INVOICE ? referenceType || "Invoice" : null,
    },
  });
  await writeAudit(actor, "CREATE", "Ledger", row.id);
  revalidatePath("/ledger");
}
