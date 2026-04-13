"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

export async function createTeacher(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) return;
  const actor = await getActorUserId();
  const row = await prisma.teacher.create({ data: { fullName } });
  await writeAudit(actor, "CREATE", "Teacher", row.id);
  revalidatePath("/teachers");
}

export async function updateTeacher(formData: FormData) {
  const id = String(formData.get("id") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  if (!id || !fullName) return;
  const actor = await getActorUserId();
  await prisma.teacher.update({ where: { id }, data: { fullName } });
  await writeAudit(actor, "UPDATE", "Teacher", id);
  revalidatePath("/teachers");
}

export async function linkTeacherUser(formData: FormData) {
  const teacherId = String(formData.get("teacherId") || "");
  const userId = String(formData.get("userId") || "");
  if (!teacherId) return;
  const actor = await getActorUserId();
  await prisma.teacher.update({
    where: { id: teacherId },
    data: { userId: userId || null },
  });
  await writeAudit(actor, "LINK", "Teacher", teacherId);
  revalidatePath("/teachers");
  revalidatePath("/users");
}
