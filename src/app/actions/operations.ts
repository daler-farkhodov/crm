"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

const roles = new Set(Object.values(UserRole));

export async function createTeacherEarning(formData: FormData) {
  const teacherId = String(formData.get("teacherId") || "");
  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  const totalAmount = Number(formData.get("totalAmount"));
  if (!teacherId || Number.isNaN(month) || Number.isNaN(year) || Number.isNaN(totalAmount))
    return;
  const actor = await getActorUserId();
  const row = await prisma.teacherEarnings.create({
    data: { teacherId, month, year, totalAmount, isPaid: false },
  });
  await writeAudit(actor, "CREATE", "TeacherEarnings", row.id);
  revalidatePath("/teacher-pay");
}

export async function toggleTeacherEarningPaid(formData: FormData) {
  const id = String(formData.get("id") || "");
  const isPaid = String(formData.get("isPaid") || "") === "true";
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.teacherEarnings.update({
    where: { id },
    data: { isPaid },
  });
  await writeAudit(actor, "UPDATE", "TeacherEarnings", id);
  revalidatePath("/teacher-pay");
}

export async function createExpense(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date") || "");
  const category = String(formData.get("category") || "").trim();
  if (!title || Number.isNaN(amount) || !date) return;
  const actor = await getActorUserId();
  const row = await prisma.expense.create({
    data: {
      title,
      amount,
      date: new Date(date),
      category: category || null,
    },
  });
  await writeAudit(actor, "CREATE", "Expense", row.id);
  revalidatePath("/expenses");
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.expense.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "Expense", id);
  revalidatePath("/expenses");
}

export async function createClosure(formData: FormData) {
  const date = String(formData.get("date") || "");
  const classId = String(formData.get("classId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!date) return;
  const actor = await getActorUserId();
  const row = await prisma.schoolClosure.create({
    data: {
      date: new Date(date),
      classId: classId || null,
      reason: reason || null,
    },
  });
  await writeAudit(actor, "CREATE", "SchoolClosure", row.id);
  revalidatePath("/closures");
}

export async function deleteClosure(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.schoolClosure.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "SchoolClosure", id);
  revalidatePath("/closures");
}

export async function createUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const role = String(formData.get("role") || "");
  if (!email || !fullName || !roles.has(role as UserRole)) return;
  const actor = await getActorUserId();
  const row = await prisma.user.create({
    data: { email, fullName, role: role as UserRole },
  });
  await writeAudit(actor, "CREATE", "User", row.id);
  revalidatePath("/users");
}
