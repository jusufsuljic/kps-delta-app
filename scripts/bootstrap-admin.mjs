import "dotenv/config";

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";

const scrypt = promisify(scryptCallback);

function normalizeUsername(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeUsernameKey(value) {
  return normalizeUsername(value).toLowerCase();
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return ["scrypt", "16384", "8", "1", salt, Buffer.from(derivedKey).toString("base64url")].join(
    "$",
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const username = normalizeUsername(
  process.env.BOOTSTRAP_ADMIN_USERNAME || process.argv[2] || "",
);
const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || process.argv[3] || "");

if (!username || !password) {
  throw new Error(
    "Provide BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD env vars or pass username/password as CLI arguments.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: {
      usernameNormalized: normalizeUsernameKey(username),
    },
    update: {
      username,
      role: UserRole.ADMIN,
      passwordHash,
      passwordUpdatedAt: new Date(),
      mustChangePassword: false,
    },
    create: {
      username,
      usernameNormalized: normalizeUsernameKey(username),
      role: UserRole.ADMIN,
      passwordHash,
      passwordUpdatedAt: new Date(),
      mustChangePassword: false,
    },
  });

  console.log(`Admin ready: ${admin.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
