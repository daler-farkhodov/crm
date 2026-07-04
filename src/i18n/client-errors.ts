import { LOCALE_COOKIE, type Locale } from "./constants";
import en from "./messages/en.json";
import ru from "./messages/ru.json";
import uz from "./messages/uz.json";

export type ErrorCopy = (typeof en)["errors"];

const byLocale: Record<Locale, ErrorCopy> = {
  en: en.errors,
  ru: ru.errors as ErrorCopy,
  uz: uz.errors as ErrorCopy,
};

export function localeFromDocumentCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const safe = LOCALE_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|; )${safe}=([^;]*)`));
  const raw = m?.[1] ? decodeURIComponent(m[1]) : "";
  if (raw === "ru" || raw === "uz" || raw === "en") return raw;
  return "en";
}

export function errorsForLocale(loc: Locale): ErrorCopy {
  return byLocale[loc] ?? byLocale.en;
}
