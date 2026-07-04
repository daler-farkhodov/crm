import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./constants";

export { LOCALE_COOKIE, type Locale };

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (v === "ru" || v === "uz" || v === "en") return v;
  return "en";
}
