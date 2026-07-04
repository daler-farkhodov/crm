import type { Messages } from "./messages";

export function t(messages: Messages, path: string): string {
  const keys = path.split(".");
  let node: unknown = messages;
  for (const k of keys) {
    if (node !== null && typeof node === "object" && k in (node as object)) {
      node = (node as Record<string, unknown>)[k];
    } else {
      return path;
    }
  }
  return typeof node === "string" ? node : path;
}
