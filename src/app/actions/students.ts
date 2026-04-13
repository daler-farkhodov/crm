"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

export type NewEnrollmentInput = { classId: string; startDate: string };

export async function createStudentWithEnrollments(data: {
  fullName: string;
  enrollments: NewEnrollmentInput[];
}): Promise<{ error: string } | void> {
  const fullName = data.fullName?.trim() ?? "";
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

  const startTimes = normalized.map((r) => new Date(r.startDate).getTime());
  const studentStart = new Date(Math.min(...startTimes));

  const actor = await getActorUserId();

  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        fullName,
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
  revalidatePath("/students");
  revalidatePath("/classes");
  redirect(`/students/${student.id}`);
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

export async function deleteStudent(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.$transaction([
    prisma.ledger.deleteMany({ where: { studentId: id } }),
    prisma.invoice.deleteMany({ where: { studentId: id } }),
    prisma.attendance.deleteMany({ where: { studentId: id } }),
    prisma.studentClass.deleteMany({ where: { studentId: id } }),
    prisma.student.delete({ where: { id } }),
  ]);
  await writeAudit(actor, "DELETE", "Student", id);
  revalidatePath("/students");
}

export async function enrollStudent(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const classId = String(formData.get("classId") || "");
  const startDate = String(formData.get("startDate") || "");
  if (!studentId || !classId || !startDate) return;
  const actor = await getActorUserId();
  const row = await prisma.studentClass.create({
    data: {
      studentId,
      classId,
      startDate: new Date(startDate),
    },
  });
  await writeAudit(actor, "CREATE", "StudentClass", row.id);
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/classes");
}

export async function endEnrollment(formData: FormData) {
  const id = String(formData.get("id") || "");
  const endDate = String(formData.get("endDate") || "");
  if (!id || !endDate) return;
  const actor = await getActorUserId();
  const row = await prisma.studentClass.update({
    where: { id },
    data: { endDate: new Date(endDate) },
  });
  await writeAudit(actor, "UPDATE", "StudentClass", row.id);
  revalidatePath("/students");
  revalidatePath(`/students/${row.studentId}`);
  revalidatePath("/classes");
}
