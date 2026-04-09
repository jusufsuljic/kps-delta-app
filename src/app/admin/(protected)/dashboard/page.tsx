import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { db } from "@/lib/db";
import {
  buildLeaderboardSnapshot,
  seasonLeaderboardInclude,
} from "@/lib/leaderboard";

import {
  createDrillAction,
  createEntryAction,
  createSeasonAction,
  createUserAction,
  deleteDrillAction,
  deleteEntryAction,
  deleteSeasonAction,
  deleteUserAction,
  finishSeasonAction,
  publishLeaderboardAction,
  updateDrillAction,
  updateEntryAction,
  updateSeasonAction,
  updateUserAction,
} from "../actions";

export const dynamic = "force-dynamic";

const DASHBOARD_TABS = ["season", "shooters", "leaderboard"] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number];

type DashboardPageProps = {
  searchParams: Promise<{
    tab?: string;
    board?: string;
    q?: string;
    shooter?: string;
  }>;
};

function resolveTab(value?: string): DashboardTab {
  if (value && DASHBOARD_TABS.includes(value as DashboardTab)) {
    return value as DashboardTab;
  }

  return "season";
}

function buildDashboardHref(
  tab: DashboardTab,
  params?: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams();
  search.set("tab", tab);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      search.set(key, value);
    }
  }

  return `/admin/dashboard?${search.toString()}`;
}

function getShooterStats(
  shooter:
    | {
        createdAt: Date;
        entries: Array<{
          id: string;
          time: number;
          createdAt: Date;
          seasonId: string;
          drillId: string;
          season: { seasonName: string };
          drill: { drillName: string };
        }>;
      }
    | null,
  activeSeasonId: string | null,
  activeDrillCount: number,
) {
  if (!shooter) {
    return null;
  }

  const seasonsShot = new Set(shooter.entries.map((entry) => entry.seasonId)).size;
  const drillsShot = new Set(shooter.entries.map((entry) => entry.drillId)).size;
  const bestSingleRun = shooter.entries.reduce<typeof shooter.entries[number] | null>(
    (best, entry) => {
      if (!best || entry.time < best.time) {
        return entry;
      }
      return best;
    },
    null,
  );

  const currentSeasonEntries = activeSeasonId
    ? shooter.entries.filter((entry) => entry.seasonId === activeSeasonId)
    : [];

  const bestByDrill = new Map<
    string,
    {
      drillName: string;
      time: number;
      createdAt: Date;
    }
  >();

  for (const entry of currentSeasonEntries) {
    const existing = bestByDrill.get(entry.drillId);

    if (!existing || entry.time < existing.time || entry.createdAt < existing.createdAt) {
      bestByDrill.set(entry.drillId, {
        drillName: entry.drill.drillName,
        time: entry.time,
        createdAt: entry.createdAt,
      });
    }
  }

  const currentSeasonTotal =
    activeDrillCount > 0 && bestByDrill.size === activeDrillCount
      ? Array.from(bestByDrill.values()).reduce((sum, entry) => sum + entry.time, 0)
      : null;

  return {
    seasonsShot,
    drillsShot,
    bestSingleRun,
    currentSeasonAttempts: currentSeasonEntries.length,
    currentSeasonTotal,
    bestByDrill: Array.from(bestByDrill.values()).sort((left, right) => left.time - right.time),
    recentEntries: shooter.entries.slice(0, 8),
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const currentTab = resolveTab(params.tab);
  const shooterQuery = params.q?.trim() ?? "";
  const selectedShooterId = params.shooter?.trim() ?? "";

  const activeSeason = await db.season.findFirst({
    where: { endedAt: null },
    include: seasonLeaderboardInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  const [users, seasons, recentEntries, totalUsers, totalEntries, selectedShooter] =
    await Promise.all([
      db.user.findMany({
        include: {
          _count: {
            select: {
              entries: true,
            },
          },
        },
        orderBy: [{ username: "asc" }],
      }),
      db.season.findMany({
        include: {
          _count: {
            select: {
              drills: true,
              entries: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      db.entry.findMany({
        take: 12,
        where: activeSeason
          ? {
              seasonId: activeSeason.id,
            }
          : undefined,
        include: {
          user: true,
          drill: true,
          season: true,
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      db.user.count(),
      db.entry.count(),
      selectedShooterId
        ? db.user.findUnique({
            where: { id: selectedShooterId },
            include: {
              _count: {
                select: {
                  entries: true,
                },
              },
              entries: {
                include: {
                  season: true,
                  drill: true,
                },
                orderBy: [{ createdAt: "desc" }],
              },
            },
          })
        : Promise.resolve(null),
    ]);

  const filteredUsers = shooterQuery
    ? users.filter((user) =>
        user.username.toLocaleLowerCase("en-US").includes(shooterQuery.toLocaleLowerCase("en-US")),
      )
    : users;

  const liveSnapshot = activeSeason
    ? buildLeaderboardSnapshot(activeSeason, { publishedAt: activeSeason.publishedAt })
    : null;

  const shooterStats = getShooterStats(
    selectedShooter
      ? {
          createdAt: selectedShooter.createdAt,
          entries: selectedShooter.entries,
        }
      : null,
    activeSeason?.id ?? null,
    activeSeason?.drills.length ?? 0,
  );

  return (
    <div className="site-root">
      <AppHeader authenticated active="dashboard" leaderboardHref="/admin/leaderboard" />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title">Dashboard</h1>
        </section>

        <section className="stats-grid">
          <article className="panel stat-card">
            <p className="section-eyebrow">USERS</p>
            <strong>{totalUsers}</strong>
            <span>Registered shooters</span>
          </article>
          <article className="panel stat-card">
            <p className="section-eyebrow">ENTRIES</p>
            <strong>{totalEntries}</strong>
            <span>All recorded attempts</span>
          </article>
          <article className="panel stat-card">
            <p className="section-eyebrow">CURRENT SEASON</p>
            <strong>{activeSeason?.seasonName ?? "NONE"}</strong>
            <span>{activeSeason ? "Active and editable" : "Create one to begin"}</span>
          </article>
          <article className="panel stat-card">
            <p className="section-eyebrow">ACTIVE DRILLS</p>
            <strong>{activeSeason?.drills.length ?? 0}</strong>
            <span>Required for entries and overall totals</span>
          </article>
          <article className="panel stat-card">
            <p className="section-eyebrow">LAST PUBLISH</p>
            <strong>{activeSeason?.publishedAt ? "LIVE" : "PENDING"}</strong>
            <span>{formatDateTime(activeSeason?.publishedAt ?? null)}</span>
          </article>
        </section>

        <nav className="dashboard-tabs" aria-label="Dashboard tabs">
          {DASHBOARD_TABS.map((tab) => (
            <Link
              key={tab}
              href={buildDashboardHref(tab)}
              className={`dashboard-tab ${currentTab === tab ? "dashboard-tab--active" : ""}`}
            >
              {tab.toUpperCase()}
            </Link>
          ))}
        </nav>

        {currentTab === "season" ? (
          <section className="content-stack">
            <article className="panel">
              <div className="panel-header">
                <h2>Season Control</h2>
              </div>

              <form action={createSeasonAction} className="form-grid form-grid--single">
                <label className="field">
                  <span className="field__label">Create New Season</span>
                  <input
                    className="text-input"
                    name="seasonName"
                    placeholder={activeSeason ? "Finish current season first" : "Spring 2026"}
                    disabled={Boolean(activeSeason)}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={Boolean(activeSeason)}
                >
                  CREATE SEASON
                </button>
              </form>

              <div className="entity-list">
                {seasons.map((season) => (
                  <div key={season.id} className="entity-card">
                    <form action={updateSeasonAction} className="inline-form">
                      <input type="hidden" name="seasonId" value={season.id} />
                      <label className="field field--grow">
                        <span className="field__label">
                          {season.endedAt ? "Archived Season" : "Active Season"}
                        </span>
                        <input
                          className="text-input"
                          name="seasonName"
                          defaultValue={season.seasonName}
                          required
                        />
                      </label>
                      <button type="submit" className="button button--ghost">
                        SAVE
                      </button>
                    </form>

                    <div className="entity-meta">
                      <span>{season._count.drills} drills</span>
                      <span>{season._count.entries} entries</span>
                      <span>Created {formatDateTime(season.createdAt)}</span>
                    </div>

                    <div className="button-row">
                      {!season.endedAt ? (
                        <>
                          <form action={finishSeasonAction}>
                            <input type="hidden" name="seasonId" value={season.id} />
                            <button type="submit" className="button button--secondary">
                              FINISH SEASON
                            </button>
                          </form>
                        </>
                      ) : null}

                      <form action={deleteSeasonAction}>
                        <input type="hidden" name="seasonId" value={season.id} />
                        <button type="submit" className="button button--ghost">
                          DELETE
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Season Drills</h2>
              </div>

              {activeSeason ? (
                <>
                  <form action={createDrillAction} className="form-grid form-grid--single">
                    <input type="hidden" name="seasonId" value={activeSeason.id} />
                    <label className="field">
                      <span className="field__label">Add Drill To {activeSeason.seasonName}</span>
                      <input
                        className="text-input"
                        name="drillName"
                        placeholder="Bill Drill"
                        required
                      />
                    </label>
                    <button type="submit" className="button button--primary">
                      ADD DRILL
                    </button>
                  </form>

                  <div className="entity-list">
                    {activeSeason.drills.length > 0 ? (
                      activeSeason.drills.map((drill) => (
                        <div key={drill.id} className="entity-card">
                          <form action={updateDrillAction} className="inline-form">
                            <input type="hidden" name="drillId" value={drill.id} />
                            <label className="field field--grow">
                              <span className="field__label">Drill Name</span>
                              <input
                                className="text-input"
                                name="drillName"
                                defaultValue={drill.drillName}
                                required
                              />
                            </label>
                            <button type="submit" className="button button--ghost">
                              SAVE
                            </button>
                          </form>

                          <form action={deleteDrillAction}>
                            <input type="hidden" name="drillId" value={drill.id} />
                            <button type="submit" className="button button--danger">
                              DELETE
                            </button>
                          </form>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">Add at least one drill to unlock entries.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">Create a season before adding drills.</div>
              )}
            </article>
          </section>
        ) : null}

        {currentTab === "shooters" ? (
          <section className="content-stack">
            <section className="dashboard-grid dashboard-grid--balanced">
              <article className="panel">
                <div className="panel-header">
                  <h2>Search Shooters</h2>
                </div>

                <form action="/admin/dashboard" method="get" className="form-grid form-grid--single">
                  <input type="hidden" name="tab" value="shooters" />
                  <label className="field">
                    <span className="field__label">Search By Username</span>
                    <input
                      className="text-input"
                      name="q"
                      list="dashboard-shooters"
                      defaultValue={shooterQuery}
                      placeholder="Start typing a shooter"
                    />
                  </label>
                  <div className="button-row">
                    <button type="submit" className="button button--primary">
                      SEARCH
                    </button>
                    <Link href={buildDashboardHref("shooters")} className="button button--ghost">
                      CLEAR
                    </Link>
                  </div>
                </form>

                <datalist id="dashboard-shooters">
                  {users.map((user) => (
                    <option key={user.id} value={user.username} />
                  ))}
                </datalist>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h2>New Shooter</h2>
                </div>

                <form action={createUserAction} className="form-grid form-grid--single">
                  <label className="field">
                    <span className="field__label">Username</span>
                    <input
                      className="text-input"
                      name="username"
                      placeholder="Shooter name"
                      required
                    />
                  </label>
                  <button type="submit" className="button button--primary">
                    ADD SHOOTER
                  </button>
                </form>
              </article>
            </section>

            {selectedShooter ? (
              <article className="panel">
                <div className="panel-header">
                  <h2>{selectedShooter.username}</h2>
                  <Link
                    href={buildDashboardHref("shooters", { q: shooterQuery || null })}
                    className="button button--ghost"
                  >
                    CLOSE PROFILE
                  </Link>
                </div>

                <div className="detail-stats">
                  <div className="detail-stat">
                    <span>Total attempts</span>
                    <strong>{selectedShooter._count.entries}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Seasons shot</span>
                    <strong>{shooterStats?.seasonsShot ?? 0}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Drills shot</span>
                    <strong>{shooterStats?.drillsShot ?? 0}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Best single run</span>
                    <strong>
                      {shooterStats?.bestSingleRun
                        ? formatSeconds(shooterStats.bestSingleRun.time)
                        : "--"}
                    </strong>
                  </div>
                  <div className="detail-stat">
                    <span>Current season attempts</span>
                    <strong>{shooterStats?.currentSeasonAttempts ?? 0}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Current season total</span>
                    <strong>
                      {shooterStats?.currentSeasonTotal
                        ? formatSeconds(shooterStats.currentSeasonTotal)
                        : "N/A"}
                    </strong>
                  </div>
                </div>

                <div className="button-row button-row--stretch">
                  <form action={updateUserAction} className="inline-form inline-form--grow">
                    <input type="hidden" name="userId" value={selectedShooter.id} />
                    <label className="field field--grow">
                      <span className="field__label">Username</span>
                      <input
                        className="text-input"
                        name="username"
                        defaultValue={selectedShooter.username}
                        required
                      />
                    </label>
                    <button type="submit" className="button button--ghost">
                      SAVE
                    </button>
                  </form>

                  <form action={deleteUserAction}>
                    <input type="hidden" name="userId" value={selectedShooter.id} />
                    <button type="submit" className="button button--danger">
                      DELETE
                    </button>
                  </form>
                </div>
                <div className="dashboard-grid dashboard-grid--balanced">
                  <div className="subpanel">
                    <div className="panel-header">
                      <h3>Best Current Season Times</h3>
                    </div>
                    <div className="entity-list">
                      {shooterStats?.bestByDrill.length ? (
                        shooterStats.bestByDrill.map((entry) => (
                          <div key={entry.drillName} className="entity-card">
                            <div className="entity-meta">
                              <span>{entry.drillName}</span>
                              <span>{formatSeconds(entry.time)}</span>
                              <span>{formatDateTime(entry.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">No attempts recorded for the active season.</div>
                      )}
                    </div>
                  </div>

                  <div className="subpanel">
                    <div className="panel-header">
                      <h3>Recent History</h3>
                    </div>
                    <div className="entity-list">
                      {shooterStats?.recentEntries.length ? (
                        shooterStats.recentEntries.map((entry) => (
                          <div key={entry.id} className="entity-card">
                            <div className="entity-meta entity-meta--stack">
                              <span>{entry.season.seasonName}</span>
                              <span>{entry.drill.drillName}</span>
                              <span>{formatSeconds(entry.time)}</span>
                              <span>{formatDateTime(entry.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">No history for this shooter yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            <article className="panel">
              <div className="panel-header">
                <h2>{shooterQuery ? "Search Results" : "All Shooters"}</h2>
                <span className="panel-note">{filteredUsers.length} shown</span>
              </div>

              <div className="entity-list entity-list--scroll">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="entity-card entity-card--row">
                      <div className="entity-meta entity-meta--stack">
                        <strong>{user.username}</strong>
                        <span>{user._count.entries} attempts</span>
                        <span>Created {formatDateTime(user.createdAt)}</span>
                      </div>
                      <Link
                        href={buildDashboardHref("shooters", {
                          q: shooterQuery || null,
                          shooter: user.id,
                        })}
                        className="button button--ghost"
                      >
                        VIEW STATS
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No shooters match that search.</div>
                )}
              </div>
            </article>
          </section>
        ) : null}

        {currentTab === "leaderboard" ? (
          <section className="content-stack">
            <article className="panel">
              <div className="panel-header">
                <h2>Log Shooting Time</h2>
              </div>

              {activeSeason && activeSeason.drills.length > 0 ? (
                <>
                  <form action={createEntryAction} className="form-grid">
                    <input type="hidden" name="seasonId" value={activeSeason.id} />
                    <label className="field field--span-2">
                      <span className="field__label">User Search / New Username</span>
                      <input
                        className="text-input"
                        list="registered-users"
                        name="username"
                        placeholder="Search existing or type a new shooter"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field__label">Drill</span>
                      <select className="text-input" name="drillId" defaultValue="" required>
                        <option value="" disabled>
                          Select drill
                        </option>
                        {activeSeason.drills.map((drill) => (
                          <option key={drill.id} value={drill.id}>
                            {drill.drillName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span className="field__label">Time</span>
                      <input
                        className="text-input"
                        name="time"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="4.52"
                        required
                      />
                    </label>

                    <button type="submit" className="button button--primary field--span-2">
                      ADD ENTRY
                    </button>
                  </form>

                  <datalist id="registered-users">
                    {users.map((user) => (
                      <option key={user.id} value={user.username} />
                    ))}
                  </datalist>
                </>
              ) : (
                <div className="empty-state">
                  Add an active season and at least one drill before entering times.
                </div>
              )}

              <div className="entity-list entity-list--scroll">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="entity-card">
                    <form action={updateEntryAction} className="entry-form">
                      <input type="hidden" name="entryId" value={entry.id} />

                      <label className="field">
                        <span className="field__label">User</span>
                        <input
                          className="text-input"
                          name="username"
                          defaultValue={entry.user.username}
                          required
                        />
                      </label>

                      <label className="field">
                        <span className="field__label">Drill</span>
                        <select
                          className="text-input"
                          name="drillId"
                          defaultValue={entry.drillId}
                          required
                        >
                          {(activeSeason?.drills ?? []).map((drill) => (
                            <option key={drill.id} value={drill.id}>
                              {drill.drillName}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span className="field__label">Time</span>
                        <input
                          className="text-input"
                          name="time"
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={entry.time}
                          required
                        />
                      </label>

                      <button type="submit" className="button button--ghost">
                        SAVE
                      </button>
                    </form>

                    <div className="entity-meta">
                      <span>{entry.season.seasonName}</span>
                      <span>{entry.drill.drillName}</span>
                      <span>{formatSeconds(entry.time)}</span>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>

                    <form action={deleteEntryAction}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <button type="submit" className="button button--danger">
                        DELETE ENTRY
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Leaderboard Publication</h2>
                <form action={publishLeaderboardAction}>
                  <input type="hidden" name="seasonId" value={activeSeason?.id ?? ""} />
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={!activeSeason || activeSeason.drills.length === 0}
                  >
                    PUBLISH LEADERBOARD
                  </button>
                </form>
              </div>

              <div className="entity-meta">
                <span>Current season: {activeSeason?.seasonName ?? "None"}</span>
                <span>Last updated: {formatDateTime(activeSeason?.publishedAt ?? null)}</span>
                <span>
                  Status:{" "}
                  {activeSeason?.publishedAt
                    ? "Published snapshot available"
                    : "Not yet published"}
                </span>
              </div>
            </article>

            <LeaderboardPanel
              snapshot={liveSnapshot}
              activeBoardKey={params.board}
              path="/admin/dashboard?tab=leaderboard"
              subtitle={activeSeason ? activeSeason.seasonName : "No active season"}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
