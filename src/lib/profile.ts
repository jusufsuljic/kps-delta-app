import { requireShooterSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvatarHue, getInitials } from "@/lib/format";
import { normalizeWhitespace } from "@/lib/validators";

export type ProfileHistorySort = "date" | "drill";

export type ShooterProfileEntry = {
  id: string;
  time: number;
  createdAt: Date;
  seasonId: string;
  seasonName: string;
  drillName: string;
  drillKey: string;
};

export type ShooterProfileSeasonOption = {
  id: string;
  seasonName: string;
  entryCount: number;
  createdAt: Date;
};

export type ShooterProfileTrendPoint = {
  attempt: number;
  time: number;
  createdAt: string;
  createdAtLabel: string;
  seasonName: string;
};

export type ShooterProfileDrill = {
  drillId: string;
  drillName: string;
  entryCount: number;
  seasonCount: number;
  bestTime: number;
  firstTime: number;
  lastTime: number;
  delta: number;
  entries: ShooterProfileEntry[];
  trend: ShooterProfileTrendPoint[];
};

export type ShooterProfileView = {
  userId: string;
  username: string;
  initials: string;
  avatarHue: number;
  createdAt: Date;
  totalEntries: number;
  drillsShot: number;
  bestTime: number | null;
  lastShotAt: Date | null;
  seasons: ShooterProfileSeasonOption[];
  selectedSeasonId: string;
  historySort: ProfileHistorySort;
  historyEntries: ShooterProfileEntry[];
  drills: Array<{
    drillId: string;
    drillName: string;
    entryCount: number;
  }>;
  selectedDrill: ShooterProfileDrill | null;
};

type LoadShooterProfileViewOptions = {
  seasonId?: string;
  sort?: string;
  drillId?: string;
};

function resolveHistorySort(value?: string): ProfileHistorySort {
  return value === "drill" ? "drill" : "date";
}

function toDrillKey(drillName: string) {
  return normalizeWhitespace(drillName).toLocaleLowerCase("en-US");
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function compareHistoryEntriesByDate(left: ShooterProfileEntry, right: ShooterProfileEntry) {
  if (left.createdAt.getTime() !== right.createdAt.getTime()) {
    return right.createdAt.getTime() - left.createdAt.getTime();
  }

  const drillCompare = left.drillName.localeCompare(right.drillName, "en");
  if (drillCompare !== 0) {
    return drillCompare;
  }

  return left.id.localeCompare(right.id);
}

function compareHistoryEntriesByDrill(left: ShooterProfileEntry, right: ShooterProfileEntry) {
  const drillCompare = left.drillName.localeCompare(right.drillName, "en");
  if (drillCompare !== 0) {
    return drillCompare;
  }

  return compareHistoryEntriesByDate(left, right);
}

export async function loadShooterProfileView(
  options?: LoadShooterProfileViewOptions,
): Promise<ShooterProfileView | null> {
  const user = await requireShooterSession();

  const entries = await db.entry.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      time: true,
      createdAt: true,
      season: {
        select: {
          id: true,
          seasonName: true,
          createdAt: true,
        },
      },
      drill: {
        select: {
          drillName: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const allEntries: ShooterProfileEntry[] = entries.map((entry) => ({
    id: entry.id,
    time: entry.time,
    createdAt: entry.createdAt,
    seasonId: entry.season.id,
    seasonName: entry.season.seasonName,
    drillName: entry.drill.drillName,
    drillKey: toDrillKey(entry.drill.drillName),
  }));

  const seasonMap = new Map<string, ShooterProfileSeasonOption>();
  for (const entry of entries) {
    const existing = seasonMap.get(entry.season.id);
    if (existing) {
      existing.entryCount += 1;
      continue;
    }

    seasonMap.set(entry.season.id, {
      id: entry.season.id,
      seasonName: entry.season.seasonName,
      entryCount: 1,
      createdAt: entry.season.createdAt,
    });
  }

  const seasons = Array.from(seasonMap.values()).sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );

  const selectedSeasonId =
    options?.seasonId && seasonMap.has(options.seasonId) ? options.seasonId : "all";
  const historySort = resolveHistorySort(options?.sort);

  const seasonScopedEntries =
    selectedSeasonId === "all"
      ? allEntries
      : allEntries.filter((entry) => entry.seasonId === selectedSeasonId);

  const historyEntries = [...seasonScopedEntries].sort(
    historySort === "drill" ? compareHistoryEntriesByDrill : compareHistoryEntriesByDate,
  );

  const drillMap = new Map<string, ShooterProfileDrill>();

  for (const entry of seasonScopedEntries) {
    const existing = drillMap.get(entry.drillKey);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }

    drillMap.set(entry.drillKey, {
      drillId: entry.drillKey,
      drillName: entry.drillName,
      entryCount: 0,
      seasonCount: 0,
      bestTime: entry.time,
      firstTime: entry.time,
      lastTime: entry.time,
      delta: 0,
      entries: [entry],
      trend: [],
    });
  }

  for (const drill of drillMap.values()) {
    drill.entries.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    drill.entryCount = drill.entries.length;
    drill.bestTime = Math.min(...drill.entries.map((entry) => entry.time));
    drill.firstTime = drill.entries[0]?.time ?? drill.bestTime;
    drill.lastTime = drill.entries.at(-1)?.time ?? drill.bestTime;
    drill.delta = drill.lastTime - drill.firstTime;
    drill.seasonCount = new Set(drill.entries.map((entry) => entry.seasonId)).size;
    drill.trend = drill.entries.map((entry, index) => ({
      attempt: index + 1,
      time: entry.time,
      createdAt: entry.createdAt.toISOString(),
      createdAtLabel: formatDateLabel(entry.createdAt),
      seasonName: entry.seasonName,
    }));
  }

  const drills = Array.from(drillMap.values())
    .sort((left, right) => left.drillName.localeCompare(right.drillName, "en"))
    .map((drill) => ({
      drillId: drill.drillId,
      drillName: drill.drillName,
      entryCount: drill.entryCount,
    }));

  const selectedDrillId =
    options?.drillId && drillMap.has(options.drillId) ? options.drillId : drills[0]?.drillId;

  const bestTime = allEntries.length > 0 ? Math.min(...allEntries.map((entry) => entry.time)) : null;
  const lastShotAt = allEntries.at(-1)?.createdAt ?? null;

  return {
    userId: user.id,
    username: user.username,
    initials: getInitials(user.username),
    avatarHue: getAvatarHue(user.username),
    createdAt: user.createdAt,
    totalEntries: allEntries.length,
    drillsShot: new Set(allEntries.map((entry) => entry.drillKey)).size,
    bestTime,
    lastShotAt,
    seasons,
    selectedSeasonId,
    historySort,
    historyEntries,
    drills,
    selectedDrill: selectedDrillId ? drillMap.get(selectedDrillId) ?? null : null,
  };
}

export async function getCurrentShooterProfileData() {
  return loadShooterProfileView();
}
