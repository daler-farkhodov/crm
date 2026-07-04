import { Prisma } from "@prisma/client";

/** True when Prisma reports missing env, unreachable host, or similar (not app logic bugs). */
export function isLikelyDbConnectivityIssue(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1000", "P1001", "P1002", "P1017"].includes(e.code);
  }
  return false;
}
