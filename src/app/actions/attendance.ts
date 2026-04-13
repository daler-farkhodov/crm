"use server";

import { AttendanceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

const statuses = new Set(Object.values(AttendanceStatus));

export async function createAttendance(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const classId = String(formData.get("classId") || "");
  const teacherIdRaw = String(formData.get("teacherId") || "");
  const date = String(formData.get("date") || "");
  const status = String(formData.get("status") || "");
  const isTrial = String(formData.get("isTrial") || "") === "on";
  if (!studentId || !classId || !date || !statuses.has(status as AttendanceStatus))
    return;
  const actor = await getActorUserId();
  const row = await prisma.attendance.create({
    data: {
      studentId,
      classId,
      teacherId: teacherIdRaw || null,
      date: new Date(date),
      status: status as AttendanceStatus,
      isTrial,
    },
  });
  await writeAudit(actor, "CREATE", "Attendance", row.id);
  revalidatePath("/attendance");
}

export async function deleteAttendance(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.attendance.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "Attendance", id);
  revalidatePath("/attendance");
}
