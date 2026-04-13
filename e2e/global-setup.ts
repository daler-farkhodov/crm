import { execSync } from "node:child_process";
import "dotenv/config";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error(
      "DATABASE_URL and DIRECT_URL must be set for e2e. For Neon, copy both from the Connect dialog; for local Docker use the same URL for both.",
    );
  }
  // eslint-disable-next-line no-console
  console.log("[e2e] Applying migrations and seed…");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  execSync("npm run db:seed", { stdio: "inherit", env: process.env });
}
