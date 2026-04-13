import { cookies } from "next/headers";

const COOKIE = "crm_user_id";

export async function getActorUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}
