import en from "./messages/en.json";
import ru from "./messages/ru.json";
import uz from "./messages/uz.json";
import type { Locale } from "./constants";

export type Messages = typeof en;

const catalogs: Record<Locale, Messages> = {
  en,
  ru: ru as Messages,
  uz: uz as Messages,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs.en;
}
