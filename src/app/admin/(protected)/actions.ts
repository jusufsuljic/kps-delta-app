"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildLeaderboardSnapshot,
  seasonLeaderboardInclude,
} from "@/lib/leaderboard";
import {
  normalizeDrillName,
  normalizeSeasonName,
  normalizeUsername,
  normalizeUsernameKey,
  parseTimeSeconds,
  readRequiredId,
  validateDrillName,
  validateSeasonName,
  validateUsername,
} from "@/lib/validators";

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/leaderboard");
}

async function getActiveSeason() {
  return db.season.findFirst({
    where: { endedAt: null },
    orderBy: [{ createdAt: "desc" }],
  });
}

async function findOrCreateUser(usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  const usernameNormalized = normalizeUsernameKey(username);

  const existing = await db.user.findFirst({
    where: { usernameNormalized },
  });

  if (existing) {
    return existing;
  }

  return db.user.create({
    data: {
      username,
      usernameNormalized,
    },
  });
}

export async function createUserAction(formData: FormData) {
  await requireAdminSession();

  const username = normalizeUsername(formData.get("username"));
  if (validateUsername(username)) {
    return;
  }

  const usernameNormalized = normalizeUsernameKey(username);
  const exists = await db.user.findFirst({ where: { usernameNormalized } });
  if (exists) {
    return;
  }

  await db.user.create({
    data: {
      username,
      usernameNormalized,
    },
  });

  revalidateApp();
}

export async function updateUserAction(formData: FormData) {
  await requireAdminSession();

  const userId = readRequiredId(formData.get("userId"));
  const username = normalizeUsername(formData.get("username"));
  if (!userId || validateUsername(username)) {
    return;
  }

  const usernameNormalized = normalizeUsernameKey(username);
  const conflictingUser = await db.user.findFirst({
    where: {
      usernameNormalized,
      NOT: { id: userId },
    },
  });

  if (conflictingUser) {
    return;
  }

  await db.user.update({
    where: { id: userId },
    data: {
      username,
      usernameNormalized,
    },
  });

  revalidateApp();
}

export async function deleteUserAction(formData: FormData) {
  await requireAdminSession();

  const userId = readRequiredId(formData.get("userId"));
  if (!userId) {
    return;
  }

  await db.user.delete({
    where: { id: userId },
  });

  revalidateApp();
}

export async function createSeasonAction(formData: FormData) {
  await requireAdminSession();

  const seasonName = normalizeSeasonName(formData.get("seasonName"));
  if (validateSeasonName(seasonName)) {
    return;
  }

  const activeSeason = await getActiveSeason();
  if (activeSeason) {
    return;
  }

  await db.season.create({
    data: {
      seasonName,
    },
  });

  revalidateApp();
}

export async function updateSeasonAction(formData: FormData) {
  await requireAdminSession();

  const seasonId = readRequiredId(formData.get("seasonId"));
  const seasonName = normalizeSeasonName(formData.get("seasonName"));
  if (!seasonId || validateSeasonName(seasonName)) {
    return;
  }

  await db.season.update({
    where: { id: seasonId },
    data: {
      seasonName,
    },
  });

  revalidateApp();
}

export async function finishSeasonAction(formData: FormData) {
  await requireAdminSession();

  const seasonId = readRequiredId(formData.get("seasonId"));
  if (!seasonId) {
    return;
  }

  await db.season.update({
    where: { id: seasonId },
    data: {
      endedAt: new Date(),
    },
  });

  revalidateApp();
}

export async function deleteSeasonAction(formData: FormData) {
  await requireAdminSession();

  const seasonId = readRequiredId(formData.get("seasonId"));
  if (!seasonId) {
    return;
  }

  await db.season.delete({
    where: { id: seasonId },
  });

  revalidateApp();
}

export async function createDrillAction(formData: FormData) {
  await requireAdminSession();

  const seasonId = readRequiredId(formData.get("seasonId"));
  const drillName = normalizeDrillName(formData.get("drillName"));
  if (!seasonId || validateDrillName(drillName)) {
    return;
  }

  const season = await db.season.findUnique({
    where: { id: seasonId },
  });
  if (!season || season.endedAt) {
    return;
  }

  const existing = await db.drill.findFirst({
    where: {
      seasonId,
      drillName,
    },
  });
  if (existing) {
    return;
  }

  await db.drill.create({
    data: {
      seasonId,
      drillName,
    },
  });

  revalidateApp();
}

export async function updateDrillAction(formData: FormData) {
  await requireAdminSession();

  const drillId = readRequiredId(formData.get("drillId"));
  const drillName = normalizeDrillName(formData.get("drillName"));
  if (!drillId || validateDrillName(drillName)) {
    return;
  }

  const drill = await db.drill.findUnique({
    where: { id: drillId },
  });
  if (!drill) {
    return;
  }

  const duplicate = await db.drill.findFirst({
    where: {
      seasonId: drill.seasonId,
      drillName,
      NOT: { id: drillId },
    },
  });
  if (duplicate) {
    return;
  }

  await db.drill.update({
    where: { id: drillId },
    data: {
      drillName,
    },
  });

  revalidateApp();
}

export async function deleteDrillAction(formData: FormData) {
  await requireAdminSession();

  const drillId = readRequiredId(formData.get("drillId"));
  if (!drillId) {
    return;
  }

  await db.drill.delete({
    where: { id: drillId },
  });

  revalidateApp();
}

export async function createEntryAction(formData: FormData) {
  await requireAdminSession();

  const seasonId = readRequiredId(formData.get("seasonId"));
  const drillId = readRequiredId(formData.get("drillId"));
  const username = normalizeUsername(formData.get("username"));
  const time = parseTimeSeconds(formData.get("time"));

  if (!seasonId || !drillId || validateUsername(username) || time === null) {
    return;
  }

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: {
      drills: {
        where: {
          id: drillId,
        },
      },
    },
  });
  if (!season || season.endedAt || season.drills.length === 0) {
    return;
  }

  const user = await findOrCreateUser(username);

  await db.entry.create({
    data: {
      seasonId,
      drillId,
      userId: user.id,
      time,
    },
  });

  revalidateApp();
}

export async function updateEntryAction(formData: FormData) {
  await requireAdminSession();

  const entryId = readRequiredId(formData.get("entryId"));
  const drillId = readRequiredId(formData.get("drillId"));
  const username = normalizeUsername(formData.get("username"));
  const time = parseTimeSeconds(formData.get("time"));

  if (!entryId || !drillId || validateUsername(username) || time === null) {
    return;
  }

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: {
      season: true,
    },
  });

  if (!entry || entry.season.endedAt) {
    return;
  }

  const drill = await db.drill.findFirst({
    where: {
      id: drillId,
      seasonId: entry.seasonId,
    },
  });
  if (!drill) {
    return;
  }

  const user = await findOrCreateUser(username);

  await db.entry.update({
    where: { id: entryId },
    data: {
      drillId,
      userId: user.id,
      time,
    },
  });

  revalidateApp();
}

export async function deleteEntryAction(formData: FormData) {
  await requireAdminSession();

  const entryId = readRequiredId(formData.get("entryId"));
  if (!entryId) {
    return;
  }

  await db.entry.delete({
    where: { id: entryId },
  });

  revalidateApp();
}

export async function publishLeaderboardAction(formData: FormData) {
  await requireAdminSession();

  const seasonId = readRequiredId(formData.get("seasonId"));
  if (!seasonId) {
    return;
  }

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: seasonLeaderboardInclude,
  });
  if (!season) {
    return;
  }

  const publishedAt = new Date();
  const snapshot = buildLeaderboardSnapshot(season, { publishedAt });

  await db.season.update({
    where: { id: seasonId },
    data: {
      publishedAt,
      publishedSnapshot: snapshot,
    },
  });

  revalidateApp();
}
