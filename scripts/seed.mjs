import "dotenv/config";

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";

function normalizeUsername(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUsernameKey(value) {
  return normalizeUsername(value).toLowerCase();
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarHue(seed) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }

  return hash;
}

const scrypt = promisify(scryptCallback);
const DEFAULT_ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "change-me";
const DEFAULT_USER_PASSWORD = process.env.SEED_USER_PASSWORD || "delta1234";
const SHOOTER_PASSWORD_MODE =
  process.env.SEED_SHOOTER_PASSWORD_MODE === "setup-pending" ? "setup-pending" : "preset";
const ATTEMPTS_PER_DRILL = 5;
const DRILL_DEFINITIONS = [
  { name: "Bill Drill", base: 3.52, userStep: 0.065 },
  { name: "Delta Sprint", base: 5.08, userStep: 0.082 },
  { name: "3x3", base: 5.84, userStep: 0.091 },
  { name: "Failure To Stop", base: 4.46, userStep: 0.074 },
  { name: "Box Flow", base: 6.14, userStep: 0.096 },
  { name: "Strong Hand Only", base: 4.92, userStep: 0.079 },
  { name: "Transition Ladder", base: 6.46, userStep: 0.101 },
];
const ATTEMPT_OFFSETS = [0.24, 0.16, 0.18, 0.09, 0.05];

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

function buildSnapshot(season, drills, entryRows, publishedAt) {
  const bestByDrill = new Map();

  for (const entry of entryRows) {
    const drillEntries = bestByDrill.get(entry.drillId) ?? new Map();
    const existing = drillEntries.get(entry.userId);

    if (
      !existing ||
      entry.time < existing.time ||
      (entry.time === existing.time && entry.createdAt < existing.createdAt)
    ) {
      drillEntries.set(entry.userId, entry);
    }

    bestByDrill.set(entry.drillId, drillEntries);
  }

  const rankRows = (rows) =>
    rows
      .sort((left, right) => {
        if (left.time !== right.time) return left.time - right.time;
        if (left.createdAt.getTime() !== right.createdAt.getTime()) {
          return left.createdAt.getTime() - right.createdAt.getTime();
        }
        return left.username.localeCompare(right.username, "en");
      })
      .map((row, index) => ({
        userId: row.userId,
        username: row.username,
        time: row.time,
        rank: index + 1,
        initials: getInitials(row.username),
        avatarHue: getAvatarHue(row.username),
      }));

  const boards = [];
  const overallCandidates = new Map();

  for (const drill of drills) {
    const bestRows = Array.from(bestByDrill.get(drill.id)?.values() ?? []);

    boards.push({
      key: drill.id,
      label: drill.drillName,
      scope: "drill",
      drillId: drill.id,
      rows: rankRows(bestRows),
    });

    for (const row of bestRows) {
      const existing = overallCandidates.get(row.userId);
      if (!existing) {
        overallCandidates.set(row.userId, {
          username: row.username,
          total: row.time,
          createdAt: row.createdAt,
          drillsCovered: 1,
        });
        continue;
      }

      overallCandidates.set(row.userId, {
        username: row.username,
        total: existing.total + row.time,
        createdAt:
          existing.createdAt.getTime() > row.createdAt.getTime()
            ? existing.createdAt
            : row.createdAt,
        drillsCovered: existing.drillsCovered + 1,
      });
    }
  }

  const overallRows = rankRows(
    Array.from(overallCandidates.entries())
      .filter(([, row]) => row.drillsCovered === drills.length)
      .map(([userId, row]) => ({
        userId,
        username: row.username,
        time: Math.round(row.total * 1000) / 1000,
        createdAt: row.createdAt,
      })),
  );

  return {
    seasonId: season.id,
    seasonName: season.seasonName,
    publishedAt: publishedAt.toISOString(),
    boards: [
      {
        key: "overall",
        label: "Overall",
        scope: "overall",
        drillId: null,
        rows: overallRows,
      },
      ...boards,
    ],
  };
}

function roundTime(value) {
  return Math.round(value * 1000) / 1000;
}

function buildAttemptTimes(userIndex, drillIndex, drillDefinition) {
  const userTierOffset = userIndex * drillDefinition.userStep;
  const consistencyOffset = (userIndex % 4) * 0.014;

  return ATTEMPT_OFFSETS.map((attemptOffset, attemptIndex) => {
    const waveOffset = ((userIndex * 3 + drillIndex * 2 + attemptIndex) % 5) * 0.012;
    return roundTime(
      drillDefinition.base + userTierOffset + consistencyOffset + attemptOffset + waveOffset,
    );
  });
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  console.log("Resetting leaderboard data...");
  console.log("Seeding a local admin account from SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD.");
  console.log(
    SHOOTER_PASSWORD_MODE === "setup-pending"
      ? "Seeding shooters without passwords so admin can onboard them through the app."
      : "Seeding all users with a local password from SEED_USER_PASSWORD or delta1234.",
  );

  await prisma.entry.deleteMany();
  await prisma.drill.deleteMany();
  await prisma.season.deleteMany();
  await prisma.user.deleteMany();

  const season = await prisma.season.create({
    data: {
      seasonName: "Spring 2026",
    },
  });

  const drills = [];
  for (const drillDefinition of DRILL_DEFINITIONS) {
    drills.push(
      await prisma.drill.create({
        data: {
          seasonId: season.id,
          drillName: drillDefinition.name,
        },
      }),
    );
  }

  const users = new Map();
  const adminPasswordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  const shooterPasswordHash =
    SHOOTER_PASSWORD_MODE === "preset" ? await hashPassword(DEFAULT_USER_PASSWORD) : null;

  await prisma.user.create({
    data: {
      username: normalizeUsername(DEFAULT_ADMIN_USERNAME),
      usernameNormalized: normalizeUsernameKey(normalizeUsername(DEFAULT_ADMIN_USERNAME)),
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      passwordUpdatedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const baseUsernames = [
    "Amar Kovac",
    "Nina Santic",
    "Tarik Basic",
    "Lejla Zec",
    "Marko Cavar",
  ];

  const extraUsernames = [
    "Adnan Hasic",
    "Aida Mahmutovic",
    "Alem Bekic",
    "Amna Delic",
    "Andrej Saric",
    "Anes Hadzic",
    "Armin Music",
    "Benjamin Smajic",
    "Denis Kabil",
    "Dino Alic",
    "Ema Causevic",
    "Faris Cehajic",
    "Hana Softic",
    "Harun Karamuja",
    "Iman Dzaferovic",
    "Ismar Hasic",
    "Jasmin Koso",
    "Kerim Begic",
    "Lana Mujanovic",
    "Mahir Tiro",
  ];

  const allUsernames = [...baseUsernames, ...extraUsernames];

  for (const username of allUsernames) {
    const normalizedUsername = normalizeUsername(username);
    const created = await prisma.user.create({
      data:
        SHOOTER_PASSWORD_MODE === "preset"
          ? {
              username: normalizedUsername,
              usernameNormalized: normalizeUsernameKey(normalizedUsername),
              role: UserRole.SHOOTER,
              passwordHash: shooterPasswordHash,
              passwordUpdatedAt: new Date(),
              mustChangePassword: false,
            }
          : {
              username: normalizedUsername,
              usernameNormalized: normalizeUsernameKey(normalizedUsername),
              role: UserRole.SHOOTER,
            },
    });
    users.set(normalizedUsername, created);
  }

  const publishedAt = new Date();
  const baseTime = publishedAt.getTime() - 1000 * 60 * 60 * 24 * 9;
  const attempts = [];

  allUsernames.forEach((username, userIndex) => {
    DRILL_DEFINITIONS.forEach((drillDefinition, drillIndex) => {
      attempts.push([
        username,
        drillDefinition.name,
        buildAttemptTimes(userIndex, drillIndex, drillDefinition),
      ]);
    });
  });

  const createdEntries = [];
  let offset = 0;

  for (const [username, drillName, times] of attempts) {
    const user = users.get(username);
    const drill = drills.find((item) => item.drillName === drillName);

    for (const time of times) {
      const createdAt = new Date(baseTime + offset * 1000 * 45);
      offset += 1;

      const created = await prisma.entry.create({
        data: {
          seasonId: season.id,
          drillId: drill.id,
          userId: user.id,
          time,
          createdAt,
        },
      });

      createdEntries.push({
        ...created,
        username: user.username,
      });
    }
  }

  const snapshot = buildSnapshot(season, drills, createdEntries, publishedAt);

  await prisma.season.update({
    where: { id: season.id },
    data: {
      publishedAt,
      publishedSnapshot: snapshot,
    },
  });

  console.log("Seed complete.");
  console.log("Season:", season.seasonName);
  console.log("Drills:", drills.map((drill) => drill.drillName).join(", "));
  console.log("Admin:", DEFAULT_ADMIN_USERNAME);
  console.log("Users:", users.size);
  console.log("Shooter auth state:", SHOOTER_PASSWORD_MODE === "preset" ? "password-ready" : "setup-pending");
  console.log("Attempts per drill per user:", ATTEMPTS_PER_DRILL);
  console.log("Entries:", createdEntries.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
