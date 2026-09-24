import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * As of v7 the connection URL is no longer allowed in schema.prisma: migration
 * and introspection commands read it from here, and the runtime client gets it
 * through a driver adapter (see src/lib/db.ts).
 *
 * v7 also stopped auto-loading .env, so load it here for local development.
 * In production (Railway) the variables are already in the environment and
 * there is no .env file to read.
 */
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
