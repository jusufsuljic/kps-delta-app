import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const configuredPoolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  const poolMax = Number.isFinite(configuredPoolMax)
    ? Math.max(configuredPoolMax, 1)
    : process.env.NODE_ENV === "production"
      ? 1
      : 3;

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: poolMax,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
