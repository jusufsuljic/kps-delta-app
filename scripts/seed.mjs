import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  console.log("Resetting leaderboard data...");

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
  for (const drillName of ["Bill Drill", "Delta Sprint", "3x3"]) {
    drills.push(
      await prisma.drill.create({
        data: {
          seasonId: season.id,
          drillName,
        },
      }),
    );
  }

  const users = new Map();
  for (const username of [
    "Amar Kovac",
    "Nina Santic",
    "Tarik Basic",
    "Lejla Zec",
    "Marko Cavar",
  ]) {
    const normalizedUsername = normalizeUsername(username);
    const created = await prisma.user.create({
      data: {
        username: normalizedUsername,
        usernameNormalized: normalizeUsernameKey(normalizedUsername),
      },
    });
    users.set(normalizedUsername, created);
  }

  const publishedAt = new Date();
  const baseTime = publishedAt.getTime() - 1000 * 60 * 60;

  const attempts = [
    ["Amar Kovac", "Bill Drill", [3.82, 3.66]],
    ["Amar Kovac", "Delta Sprint", [5.45]],
    ["Amar Kovac", "3x3", [6.12]],
    ["Nina Santic", "Bill Drill", [3.91]],
    ["Nina Santic", "Delta Sprint", [5.21, 5.08]],
    ["Nina Santic", "3x3", [5.88]],
    ["Tarik Basic", "Bill Drill", [4.05]],
    ["Tarik Basic", "Delta Sprint", [5.72]],
    ["Tarik Basic", "3x3", [6.34, 6.08]],
    ["Lejla Zec", "Bill Drill", [4.11]],
    ["Lejla Zec", "Delta Sprint", [5.66]],
    ["Marko Cavar", "Bill Drill", [3.76]],
    ["Marko Cavar", "Delta Sprint", [5.31]],
    ["Marko Cavar", "3x3", [6.41]],
  ];

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
  console.log("Users:", users.size);
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
