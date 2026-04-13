"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "crm_user_id";

export async function loginAsUser(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  if (!userId) return;
  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/login");
}
