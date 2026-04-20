import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  const now = new Date();

  const shootersWithEntries = await prisma.user.count({
    where: {
      role: UserRole.SHOOTER,
      entries: {
        some: {},
      },
    },
  });

  const shootersWithoutEntries = await prisma.user.count({
    where: {
      role: UserRole.SHOOTER,
      entries: {
        none: {},
      },
    },
  });

  const registrationRequests = await prisma.registrationRequest.count();
  const passwordResetRequests = await prisma.passwordResetRequest.count();
  const setupCodes = await prisma.setupCode.count();

  await prisma.$transaction([
    prisma.registrationRequest.deleteMany(),
    prisma.setupCode.deleteMany(),
    prisma.passwordResetRequest.deleteMany(),
    prisma.user.deleteMany({
      where: {
        role: UserRole.SHOOTER,
        entries: {
          none: {},
        },
      },
    }),
    prisma.user.updateMany({
      where: {
        role: UserRole.SHOOTER,
      },
      data: {
        firstName: null,
        lastName: null,
        email: null,
        emailNormalized: null,
        passwordHash: null,
        mustChangePassword: false,
        passwordUpdatedAt: now,
      },
    }),
  ]);

  console.log("Shooter registration state reset.");
  console.log(`Preserved shooter leaderboard profiles with entries: ${shootersWithEntries}`);
  console.log(`Deleted shooter profiles without entries: ${shootersWithoutEntries}`);
  console.log(`Deleted registration requests: ${registrationRequests}`);
  console.log(`Deleted password reset requests: ${passwordResetRequests}`);
  console.log(`Deleted setup codes: ${setupCodes}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
