"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

export async function createClass(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const pricePerMonth = Number(formData.get("pricePerMonth"));
  if (!name || Number.isNaN(pricePerMonth)) return;
  const actor = await getActorUserId();
  const row = await prisma.class.create({
    data: { name, pricePerMonth },
  });
  await writeAudit(actor, "CREATE", "Class", row.id);
  revalidatePath("/classes");
}

export async function updateClass(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const pricePerMonth = Number(formData.get("pricePerMonth"));
  if (!id || !name || Number.isNaN(pricePerMonth)) return;
  const actor = await getActorUserId();
  await prisma.class.update({
    where: { id },
    data: { name, pricePerMonth },
  });
  await writeAudit(actor, "UPDATE", "Class", id);
  revalidatePath("/classes");
}

export async function assignClassTeacher(formData: FormData) {
  const classId = String(formData.get("classId") || "");
  const teacherId = String(formData.get("teacherId") || "");
  const percentage = Number(formData.get("percentage"));
  if (!classId || !teacherId || Number.isNaN(percentage)) return;
  const actor = await getActorUserId();
  const row = await prisma.classTeacher.create({
    data: { classId, teacherId, percentage },
  });
  await writeAudit(actor, "CREATE", "ClassTeacher", row.id);
  revalidatePath("/classes");
}

export async function updateClassTeacherShare(formData: FormData) {
  const id = String(formData.get("id") || "");
  const percentage = Number(formData.get("percentage"));
  if (!id || Number.isNaN(percentage)) return;
  const actor = await getActorUserId();
  await prisma.classTeacher.update({
    where: { id },
    data: { percentage },
  });
  await writeAudit(actor, "UPDATE", "ClassTeacher", id);
  revalidatePath("/classes");
}

export async function removeClassTeacher(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.classTeacher.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "ClassTeacher", id);
  revalidatePath("/classes");
}
