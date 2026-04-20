"use server";

import { UserRole } from "@prisma/client";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from "@/lib/auth-backend";
import { db } from "@/lib/db";
import {
  buildLeaderboardSnapshot,
  seasonLeaderboardInclude,
} from "@/lib/leaderboard";
import {
  normalizeEmail,
  normalizeEmailKey,
  normalizeDrillName,
  normalizeSeasonName,
  normalizeUsername,
  normalizeUsernameKey,
  parseTimeSeconds,
  readRequiredId,
  readOptionalPassword,
  validateDrillName,
  validateEmail,
  validateSeasonName,
  validatePassword,
  validateUsername,
} from "@/lib/validators";
import { hashPassword } from "@/lib/password";

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/leaderboard");
  revalidatePath("/login");
  revalidatePath("/register");
  revalidatePath("/profile");
}

async function getActiveSeason() {
  return db.season.findFirst({
    where: { endedAt: null },
    orderBy: [{ createdAt: "desc" }],
  });
}

async function findShooterUser(usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  const usernameNormalized = normalizeUsernameKey(username);

  return db.user.findFirst({
    where: {
      usernameNormalized,
      role: UserRole.SHOOTER,
    },
  });
}

function readUserRole(value: FormDataEntryValue | null | undefined) {
  return value === UserRole.ADMIN ? UserRole.ADMIN : UserRole.SHOOTER;
}

export async function updateUserAction(formData: FormData) {
  await requireAdminSession();

  const userId = readRequiredId(formData.get("userId"));
  const username = normalizeUsername(formData.get("username"));
  const email = normalizeEmail(formData.get("email"));
  const password = readOptionalPassword(formData.get("password"));
  const role = readUserRole(formData.get("role"));

  if (!userId || validateUsername(username)) {
    return;
  }

  if (email && validateEmail(email)) {
    return;
  }

  if (password !== null && validatePassword(password)) {
    return;
  }

  const usernameNormalized = normalizeUsernameKey(username);
  const emailNormalized = email ? normalizeEmailKey(email) : null;
  const conflictingUser = await db.user.findFirst({
    where: {
      NOT: { id: userId },
      OR: [
        { usernameNormalized },
        ...(emailNormalized ? [{ emailNormalized }] : []),
      ],
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
      email: email || null,
      emailNormalized,
      role,
      ...(password
        ? {
            passwordHash: await hashPassword(password),
            passwordUpdatedAt: new Date(),
            mustChangePassword: false,
          }
        : {}),
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

  const user = await findShooterUser(username);
  if (!user) {
    return;
  }

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

  const user = await findShooterUser(username);
  if (!user) {
    return;
  }

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

export async function approveRegistrationRequestAction(formData: FormData) {
  const admin = await requireAdminSession();

  const requestId = readRequiredId(formData.get("requestId"));
  if (!requestId) {
    return;
  }

  await approveRegistrationRequest({
    requestId,
    reviewedByUserId: admin.id,
  });

  revalidateApp();
}

export async function rejectRegistrationRequestAction(formData: FormData) {
  const admin = await requireAdminSession();

  const requestId = readRequiredId(formData.get("requestId"));
  if (!requestId) {
    return;
  }

  await rejectRegistrationRequest({
    requestId,
    reviewedByUserId: admin.id,
  });

  revalidateApp();
}
