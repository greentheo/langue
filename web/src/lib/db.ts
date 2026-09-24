import "server-only";

/**
 * Prisma client singleton.
 *
 * Prisma 7 requires a driver adapter rather than a `url` in schema.prisma, so
 * the connection string is read here and handed to the pg adapter.
 *
 * The client is cached on globalThis in development because Next reloads
 * modules on every edit; without this each reload opens a fresh connection
 * pool and Postgres eventually refuses new connections.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Attach a Postgres service (Railway does this " +
        "automatically) or copy web/.env.example to web/.env for local work.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
