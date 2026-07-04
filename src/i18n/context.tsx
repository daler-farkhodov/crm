"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Messages } from "./messages";
import { t } from "./t";

const I18nContext = createContext<Messages | null>(null);

export function I18nProvider({
  messages,
  children,
}: {
  messages: Messages;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={messages}>{children}</I18nContext.Provider>;
}

export function useMessages(): Messages {
  const v = useContext(I18nContext);
  if (!v) {
    throw new Error("useMessages must be used within I18nProvider");
  }
  return v;
}

export function useT(): (path: string) => string {
  const messages = useMessages();
  return (path: string) => t(messages, path);
}
