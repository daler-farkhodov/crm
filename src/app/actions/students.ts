"use server";

import { EnrollmentStatus, LedgerType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateRewrittenInvoice } from "@/app/actions/billing";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { computeEarlyDropRefund, refreshStudentNextPaymentDue } from "@/lib/student-billing";
import { getActorUserId } from "@/lib/session";

export type NewEnrollmentInput = { classId: string; startDate: string };

export async function createStudentWithEnrollments(data: {
  fullName: string;
  phone?: string;
  enrollments: NewEnrollmentInput[];
}): Promise<{ error: string } | void> {
  const fullName = data.fullName?.trim() ?? "";
  const phone = data.phone?.trim() || null;
  const enrollments = data.enrollments ?? [];

  if (!fullName) {
    return { error: "Full name is required." };
  }
  if (enrollments.length === 0) {
    return { error: "Add at least one class with a start date." };
  }

  const normalized = enrollments.map((e) => ({
    classId: e.classId?.trim() ?? "",
    startDate: e.startDate?.trim() ?? "",
  }));

  for (const row of normalized) {
    if (!row.classId || !row.startDate) {
      return { error: "Each row needs a class and a start date." };
    }
    if (Number.isNaN(new Date(row.startDate).getTime())) {
      return { error: "Invalid start date on one of the rows." };
    }
  }

  const classIds = normalized.map((r) => r.classId);
  if (new Set(classIds).size !== classIds.length) {
    return { error: "Duplicate class in the list — pick each class once." };
  }

  const existing = await prisma.class.count({
    where: { id: { in: classIds } },
  });
  if (existing !== classIds.length) {
    return { error: "One or more classes are invalid." };
  }

  if (phone) {
    const conflict = await prisma.student.findFirst({
      where: { phone },
      select: { fullName: true },
    });
    if (conflict) return { error: `Phone already used by ${conflict.fullName}.` };
  }

  const startTimes = normalized.map((r) => new Date(r.startDate).getTime());
  const studentStart = new Date(Math.min(...startTimes));

  const actor = await getActorUserId();

  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        fullName,
        phone,
        startDate: studentStart,
        isActive: true,
      },
    });
    for (const row of normalized) {
      await tx.studentClass.create({
        data: {
          studentId: s.id,
          classId: row.classId,
          startDate: new Date(row.startDate),
        },
      });
    }
    return s;
  });

  await writeAudit(actor, "CREATE", "Student", student.id);
  await refreshStudentNextPaymentDue(student.id);
  revalidatePath("/students");
  revalidatePath("/classes");
  redirect(`/students/${student.id}`);
}

export async function setStudentActive(formData: FormData) {
  const id = String(formData.get("id") || "");
  const isActive = String(formData.get("isActive") || "") === "true";
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.student.update({
    where: { id },
    data: { isActive },
  });
  await writeAudit(actor, "UPDATE", "Student", id);
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
}

export async function updateStudent(formData: FormData) {
  const id = String(formData.get("id") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const startDate = String(formData.get("startDate") || "");
  const isActive = String(formData.get("isActive") || "true") === "true";
  if (!id || !fullName || !startDate) return;
  const actor = await getActorUserId();
  await prisma.student.update({
    where: { id },
    data: {
      fullName,
      startDate: new Date(startDate),
      isActive,
    },
  });
  await writeAudit(actor, "UPDATE", "Student", id);
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
}

export async function updateStudentContact(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing student id." };

  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) return { error: "Name is required." };

  const phone = String(formData.get("phone") || "").trim() || null;
  const parentPhone = String(formData.get("parentPhone") || "").trim() || null;

  // Uniqueness checks (exclude this student)
  if (phone) {
    const conflict = await prisma.student.findFirst({
      where: { phone, NOT: { id } },
      select: { fullName: true },
    });
    if (conflict) return { error: `Phone already used by ${conflict.fullName}.` };
  }
  if (parentPhone) {
    const conflict = await prisma.student.findFirst({
      where: { parentPhone, NOT: { id } },
      select: { fullName: true },
    });
    if (conflict) return { error: `Parent phone already used by ${conflict.fullName}.` };
  }

  const actor = await getActorUserId();
  await prisma.student.update({
    where: { id },
    data: {
      fullName,
      phone,
      parentName:  String(formData.get("parentName") || "").trim() || null,
      parentPhone,
    },
  });
  await writeAudit(actor, "UPDATE", "Student", id);
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return {};
}

/**
 * Ends every active enrollment (posting the same per-session refund
 * endEnrollment computes) and then closes out any remaining positive balance
 * — first by attempting a rewritten correction invoice against whatever
 * single PAID invoice covers the drop date (see generateRewrittenInvoice),
 * falling back to the old blanket ADJUSTMENT write-off only if that lookup
 * doesn't find an unambiguous match. Only one rewritten-invoice attempt is
 * made: real students are billed across all their classes on one combined
 * invoice, so a second attempt would just re-match the same invoice and
 * double-count the correction.
 */
export async function softDeleteStudent(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  const now = new Date();

  const activeEnrollments = await prisma.studentClass.findMany({
    where: { studentId: id, endDate: null },
    include: { class: true },
    orderBy: { startDate: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    for (const sc of activeEnrollments) {
      const refundAmount = await computeEarlyDropRefund(tx, sc, now);
      if (refundAmount > 0) {
        await tx.ledger.create({
          data: {
            studentId: id,
            type: LedgerType.CREDIT,
            amount: -refundAmount,
            referenceId: sc.id,
            referenceType: "EarlyDropRefund",
          },
        });
      }
      await tx.studentClass.update({ where: { id: sc.id }, data: { endDate: now } });
    }
  });

  const ledgerAgg = await prisma.ledger.aggregate({
    where: { studentId: id },
    _sum: { amount: true },
  });
  const balance = ledgerAgg._sum.amount ?? 0;

  let covered = false;
  if (balance > 0.005 && activeEnrollments.length > 0) {
    const result = await generateRewrittenInvoice(id, activeEnrollments[0].classId, now);
    covered = result !== null;
  }

  if (!covered && balance > 0.005) {
    await prisma.ledger.create({
      data: {
        studentId: id,
        type: LedgerType.ADJUSTMENT,
        amount: -Math.round(balance * 100) / 100,
        referenceType: "StudentDeleted",
      },
    });
  }

  await prisma.student.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAudit(actor, "DELETE", "Student", id);
  revalidatePath("/students");
  revalidatePath("/invoices");
}

export async function enrollStudent(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const studentId = String(formData.get("studentId") || "");
  const classId = String(formData.get("classId") || "");
  const startDate = String(formData.get("startDate") || "");
  if (!studentId || !classId || !startDate) return { error: "Missing required fields." };
  const actor = await getActorUserId();
  const row = await prisma.studentClass.create({
    data: {
      studentId,
      classId,
      startDate: new Date(startDate),
    },
  });
  await writeAudit(actor, "CREATE", "StudentClass", row.id);
  await refreshStudentNextPaymentDue(studentId);
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/classes");
  return {};
}

const ALLOWED_SCORES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export async function updateEnrollmentHistory(formData: FormData) {
  const id = String(formData.get("id") || "");
  const scoreRaw = formData.get("score");
  const status = String(formData.get("status") || "ACTIVE") as
    | "ACTIVE"
    | "COMPLETED"
    | "TRANSFERRED"
    | "DROPPED";
  if (!id) return;

  const scoreNum = scoreRaw !== null && scoreRaw !== "" ? Number(scoreRaw) : null;
  const score =
    scoreNum !== null && ALLOWED_SCORES.includes(scoreNum) ? scoreNum : null;

  const enrollment = await prisma.studentClass.update({
    where: { id },
    data: { score, status },
    select: { studentId: true },
  });
  revalidatePath(`/students/${enrollment.studentId}`);
}

/**
 * Non-mutating preview for the end-enrollment confirm dialog: computes what
 * the per-session refund would be and whether the resulting balance would
 * still be positive enough to need a rewritten (correction) invoice, so the
 * UI can decide whether to show a confirm prompt before calling endEnrollment.
 */
export async function checkEndEnrollmentRefund(id: string, endDateRaw: string) {
  const empty = {
    needsRewrittenInvoice: false,
    refundAmount: 0,
    projectedBalance: 0,
    studentId: "",
    classId: "",
  };
  if (!id || !endDateRaw) return empty;
  const endDate = new Date(endDateRaw);

  const sc = await prisma.studentClass.findUnique({
    where: { id },
    include: { class: true },
  });
  if (!sc || sc.endDate !== null) return empty;

  const refundAmount = await computeEarlyDropRefund(prisma, sc, endDate);

  const ledgerAgg = await prisma.ledger.aggregate({
    where: { studentId: sc.studentId },
    _sum: { amount: true },
  });
  const currentBalance = ledgerAgg._sum.amount ?? 0;
  const projectedBalance = currentBalance - refundAmount;

  return {
    needsRewrittenInvoice: projectedBalance > 0.005,
    refundAmount,
    projectedBalance,
    studentId: sc.studentId,
    classId: sc.classId,
  };
}

export async function endEnrollment(formData: FormData) {
  const id = String(formData.get("id") || "");
  const endDateRaw = String(formData.get("endDate") || "");
  if (!id || !endDateRaw) return;
  const endDate = new Date(endDateRaw);
  const actor = await getActorUserId();

  // Load the enrollment + class to calculate refund
  const sc = await prisma.studentClass.findUnique({
    where: { id },
    include: { class: true },
  });
  if (!sc) return;

  const row = await prisma.studentClass.update({
    where: { id },
    data: { endDate },
  });
  await writeAudit(actor, "UPDATE", "StudentClass", row.id);

  // ── Item 15: Calculate refund for unused sessions ──────────────────────────
  const refundAmount = await computeEarlyDropRefund(prisma, sc, endDate);
  if (refundAmount > 0) {
    await prisma.ledger.create({
      data: {
        studentId: sc.studentId,
        type: LedgerType.CREDIT,
        amount: -refundAmount,
        referenceId: sc.id,
        referenceType: "EarlyDropRefund",
      },
    });
  }

  await refreshStudentNextPaymentDue(sc.studentId);
  revalidatePath("/students");
  revalidatePath(`/students/${sc.studentId}`);
  revalidatePath("/classes");
}

/**
 * Moves a student from one class to another mid-period. Ends the old
 * enrollment as TRANSFERRED (not DROPPED, so Academic History reads
 * correctly), computes the same early-drop refund as endEnrollment, and — if
 * there's a refund — splits it into two tagged CREDIT rows so the amount
 * earmarked for the new class gets picked up first by the new class's next
 * invoice (see the earmarked-credit priority in generateDueStudentInvoice).
 */
export async function transferStudent(formData: FormData) {
  const id = String(formData.get("id") || "");
  const toClassId = String(formData.get("toClassId") || "");
  const transferDateRaw = String(formData.get("transferDate") || "");
  if (!id || !toClassId || !transferDateRaw) return;
  const transferDate = new Date(transferDateRaw);
  const actor = await getActorUserId();

  const sc = await prisma.studentClass.findUnique({
    where: { id },
    include: { class: true },
  });
  if (!sc || sc.endDate !== null || sc.classId === toClassId) return;

  const refundAmount = await computeEarlyDropRefund(prisma, sc, transferDate);

  const newEnrollmentId = await prisma.$transaction(async (tx) => {
    await tx.studentClass.update({
      where: { id },
      data: { endDate: transferDate, status: EnrollmentStatus.TRANSFERRED },
    });

    if (refundAmount > 0) {
      await tx.ledger.createMany({
        data: [
          {
            studentId: sc.studentId,
            type: LedgerType.CREDIT,
            amount: -refundAmount,
            classId: sc.classId,
            referenceId: sc.id,
            referenceType: "TransferRefund",
          },
          {
            studentId: sc.studentId,
            type: LedgerType.CREDIT,
            amount: refundAmount,
            classId: toClassId,
            referenceId: sc.id,
            referenceType: "TransferCredit",
          },
        ],
      });
    }

    const created = await tx.studentClass.create({
      data: {
        studentId: sc.studentId,
        classId: toClassId,
        startDate: transferDate,
      },
    });
    return created.id;
  });

  await writeAudit(actor, "CREATE", "StudentClass", newEnrollmentId);
  await refreshStudentNextPaymentDue(sc.studentId);
  revalidatePath("/students");
  revalidatePath(`/students/${sc.studentId}`);
  revalidatePath("/classes");
}

/** Item 15: Admin physically returned the outstanding credit to the student. */
export async function returnStudentRefund(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const amount = Number(formData.get("amount"));
  if (!studentId || Number.isNaN(amount) || amount <= 0) return;
  const actor = await getActorUserId();

  // Create a positive ADJUSTMENT to bring the balance to 0
  const row = await prisma.ledger.create({
    data: {
      studentId,
      type: LedgerType.ADJUSTMENT,
      amount: Math.round(amount * 100) / 100,
      referenceType: "RefundReturned",
    },
  });
  await writeAudit(actor, "CREATE", "Ledger", row.id);
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/ledger");
}

/** Item 5 & 6: Update custom rate and/or free status for an enrollment. */
export async function updateEnrollmentSettings(formData: FormData) {
  const id = String(formData.get("id") || "");
  const customRateRaw = formData.get("customRate");
  const isFree = formData.get("isFree") === "true";
  if (!id) return;
  const actor = await getActorUserId();

  const customRate =
    customRateRaw !== null && customRateRaw !== ""
      ? Number(customRateRaw)
      : null;

  const sc = await prisma.studentClass.update({
    where: { id },
    data: {
      customRate: isFree ? null : (customRate !== null && !Number.isNaN(customRate) ? customRate : undefined),
      isFree,
    },
  });
  await writeAudit(actor, "UPDATE", "StudentClass", sc.id);
  revalidatePath(`/students/${sc.studentId}`);
  revalidatePath("/invoices");
}
