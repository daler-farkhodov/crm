"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/session";

export async function createRoom(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const actor = await getActorUserId();
  const row = await prisma.room.create({ data: { name } });
  await writeAudit(actor, "CREATE", "Room", row.id);
  revalidatePath("/settings");
  revalidatePath("/classes");
  revalidatePath("/attendance");
}

export async function updateRoomName(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  const actor = await getActorUserId();
  await prisma.room.update({ where: { id }, data: { name } });
  await writeAudit(actor, "UPDATE", "Room", id);
  revalidatePath("/settings");
  revalidatePath("/classes");
  revalidatePath("/attendance");
}

export async function setRoomHidden(formData: FormData) {
  const id = String(formData.get("id") || "");
  const hidden = formData.get("hidden") === "true";
  if (!id) return;
  const actor = await getActorUserId();
  await prisma.room.update({ where: { id }, data: { isHidden: hidden } });
  await writeAudit(actor, "UPDATE", "Room", id);
  revalidatePath("/settings");
  revalidatePath("/attendance");
}

export async function deleteRoom(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  // Guard: refuse if active classes still point to this room
  const activeCount = await prisma.class.count({ where: { roomId: id } });
  if (activeCount > 0) return;
  const actor = await getActorUserId();
  await prisma.room.delete({ where: { id } });
  await writeAudit(actor, "DELETE", "Room", id);
  revalidatePath("/settings");
  revalidatePath("/classes");
  revalidatePath("/attendance");
}
