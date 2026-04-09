import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getAvatarHue, getInitials } from "@/lib/format";

export const seasonLeaderboardInclude = {
  drills: {
    orderBy: [{ createdAt: "asc" }, { drillName: "asc" }],
  },
  entries: {
    include: {
      user: true,
      drill: true,
    },
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.SeasonInclude;

export type SeasonLeaderboardRecord = Prisma.SeasonGetPayload<{
  include: typeof seasonLeaderboardInclude;
}>;

export type LeaderboardRow = {
  userId: string;
  username: string;
  time: number;
  rank: number;
  initials: string;
  avatarHue: number;
};

export type LeaderboardBoard = {
  key: string;
  label: string;
  scope: "overall" | "drill";
  drillId: string | null;
  rows: LeaderboardRow[];
};

export type LeaderboardSnapshot = {
  seasonId: string;
  seasonName: string;
  publishedAt: string | null;
  boards: LeaderboardBoard[];
};

export type PublishedLeaderboardState = {
  snapshot: LeaderboardSnapshot | null;
  sourceSeasonName: string;
  lastPublishedAt: Date | null;
  staleNotice: string | null;
  pendingPublication: boolean;
};

type BestEntry = {
  userId: string;
  username: string;
  time: number;
  createdAt: Date;
};

function rankRows(
  rows: Array<{
    userId: string;
    username: string;
    time: number;
    tieBreaker: Date;
  }>,
) {
  return rows
    .sort((left, right) => {
      if (left.time !== right.time) {
        return left.time - right.time;
      }

      if (left.tieBreaker.getTime() !== right.tieBreaker.getTime()) {
        return left.tieBreaker.getTime() - right.tieBreaker.getTime();
      }

      const usernameCompare = left.username.localeCompare(right.username, "en");
      if (usernameCompare !== 0) {
        return usernameCompare;
      }

      return left.userId.localeCompare(right.userId);
    })
    .map((row, index) => ({
      userId: row.userId,
      username: row.username,
      time: row.time,
      rank: index + 1,
      initials: getInitials(row.username),
      avatarHue: getAvatarHue(row.username),
    }));
}

function buildBestEntryMap(season: SeasonLeaderboardRecord) {
  const bestByDrill = new Map<string, Map<string, BestEntry>>();

  for (const entry of season.entries) {
    const drillEntries = bestByDrill.get(entry.drillId) ?? new Map<string, BestEntry>();
    const existing = drillEntries.get(entry.userId);

    if (
      !existing ||
      entry.time < existing.time ||
      (entry.time === existing.time && entry.createdAt < existing.createdAt)
    ) {
      drillEntries.set(entry.userId, {
        userId: entry.userId,
        username: entry.user.username,
        time: entry.time,
        createdAt: entry.createdAt,
      });
    }

    bestByDrill.set(entry.drillId, drillEntries);
  }

  return bestByDrill;
}

export function buildLeaderboardSnapshot(
  season: SeasonLeaderboardRecord,
  options?: { publishedAt?: Date | null },
): LeaderboardSnapshot {
  const bestByDrill = buildBestEntryMap(season);
  const boards: LeaderboardBoard[] = [];

  const overallCandidates = new Map<
    string,
    {
      username: string;
      total: number;
      completedAt: Date;
      drillsCovered: number;
    }
  >();

  for (const drill of season.drills) {
    const bestForDrill = Array.from(bestByDrill.get(drill.id)?.values() ?? []);

    const rankedRows = rankRows(
      bestForDrill.map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        time: entry.time,
        tieBreaker: entry.createdAt,
      })),
    );

    boards.push({
      key: drill.id,
      label: drill.drillName,
      scope: "drill",
      drillId: drill.id,
      rows: rankedRows,
    });

    for (const entry of bestForDrill) {
      const existing = overallCandidates.get(entry.userId);
      if (!existing) {
        overallCandidates.set(entry.userId, {
          username: entry.username,
          total: entry.time,
          completedAt: entry.createdAt,
          drillsCovered: 1,
        });
        continue;
      }

      overallCandidates.set(entry.userId, {
        username: entry.username,
        total: existing.total + entry.time,
        completedAt:
          existing.completedAt.getTime() > entry.createdAt.getTime()
            ? existing.completedAt
            : entry.createdAt,
        drillsCovered: existing.drillsCovered + 1,
      });
    }
  }

  const drillCount = season.drills.length;
  const overallRows = rankRows(
    Array.from(overallCandidates.entries())
      .filter(([, candidate]) => drillCount > 0 && candidate.drillsCovered === drillCount)
      .map(([userId, candidate]) => ({
        userId,
        username: candidate.username,
        time: Math.round(candidate.total * 1000) / 1000,
        tieBreaker: candidate.completedAt,
      })),
  );

  return {
    seasonId: season.id,
    seasonName: season.seasonName,
    publishedAt: options?.publishedAt?.toISOString() ?? null,
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

export async function getLiveLeaderboardSnapshot(seasonId: string) {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: seasonLeaderboardInclude,
  });

  if (!season) {
    return null;
  }

  return buildLeaderboardSnapshot(season, { publishedAt: season.publishedAt });
}

export function readPublishedSnapshot(
  snapshot: Prisma.JsonValue | null,
): LeaderboardSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as unknown as LeaderboardSnapshot;
}

export async function getPublishedLeaderboardState(): Promise<PublishedLeaderboardState> {
  const activeSeason = await db.season.findFirst({
    where: { endedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      seasonName: true,
      publishedAt: true,
      publishedSnapshot: true,
    },
  });

  const snapshot = activeSeason?.publishedSnapshot
    ? readPublishedSnapshot(activeSeason.publishedSnapshot)
    : null;

  return {
    snapshot,
    sourceSeasonName: activeSeason?.seasonName ?? "No active season",
    lastPublishedAt: activeSeason?.publishedAt ?? null,
    staleNotice: null,
    pendingPublication: Boolean(activeSeason && !snapshot),
  };
}
