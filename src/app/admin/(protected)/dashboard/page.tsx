import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { PasswordResetRequestsPanel } from "@/components/admin/PasswordResetRequestsPanel";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { isShooterAuthenticated } from "@/lib/auth";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { db } from "@/lib/db";
import {
  buildLeaderboardSnapshot,
  seasonLeaderboardInclude,
} from "@/lib/leaderboard";
import {
  PasswordResetRequestStatus,
  UserRole,
} from "@prisma/client";

import {
  approveRegistrationRequestAction,
  createDrillAction,
  createEntryAction,
  createSeasonAction,
  deleteDrillAction,
  deleteEntryAction,
  deleteSeasonAction,
  deleteUserAction,
  finishSeasonAction,
  publishLeaderboardAction,
  rejectRegistrationRequestAction,
  updateDrillAction,
  updateEntryAction,
  updateSeasonAction,
  updateUserAction,
} from "../actions";

export const dynamic = "force-dynamic";

const DASHBOARD_TABS = ["season", "shooters", "accounts", "leaderboard"] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number];

type DashboardPageProps = {
  searchParams: Promise<{
    tab?: string;
    board?: string;
    q?: string;
    shooter?: string;
    accountQ?: string;
    account?: string;
    notice?: string;
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

function getAccountStateLabel(user: {
  role: UserRole;
  email: string | null;
  passwordHash: string | null;
}) {
  if (user.role === UserRole.ADMIN) {
    return user.passwordHash ? "ACTIVE" : "NO PASSWORD";
  }

  if (user.email && user.passwordHash) {
    return "REGISTERED";
  }

  if (user.email) {
    return "PENDING ACCESS";
  }

  return "NOT REGISTERED";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const currentTab = resolveTab(params.tab);
  const shooterQuery = params.q?.trim() ?? "";
  const selectedShooterId = params.shooter?.trim() ?? "";
  const accountQuery = params.accountQ?.trim() ?? "";
  const selectedAccountId = params.account?.trim() ?? "";
  const notice =
    params.notice === "password-updated"
      ? "Password updated successfully."
      : null;

  const [shooterAuthenticated, activeSeason] = await Promise.all([
    isShooterAuthenticated(),
    db.season.findFirst({
      where: { endedAt: null },
      include: seasonLeaderboardInclude,
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const [
    users,
    seasons,
    recentEntries,
    totalUsers,
    totalEntries,
    selectedShooter,
    selectedAccount,
    registrationRequests,
    passwordResetRequests,
  ] =
    await Promise.all([
      db.user.findMany({
        include: {
          _count: {
            select: {
              entries: true,
              passwordResetRequests: true,
            },
          },
          passwordResetRequests: {
            where: {
              status: PasswordResetRequestStatus.PENDING,
            },
            orderBy: [{ createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              createdAt: true,
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
                  passwordResetRequests: true,
                },
              },
              passwordResetRequests: {
                orderBy: [{ createdAt: "desc" }],
                take: 8,
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  reviewedAt: true,
                  completedAt: true,
                  reviewerNote: true,
                  reviewedBy: {
                    select: {
                      id: true,
                      username: true,
                    },
                  },
                  setupCode: {
                    select: {
                      id: true,
                      codeSuffix: true,
                      createdAt: true,
                      expiresAt: true,
                      usedAt: true,
                      revokedAt: true,
                    },
                  },
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
      selectedAccountId
        ? db.user.findUnique({
            where: { id: selectedAccountId },
            include: {
              _count: {
                select: {
                  entries: true,
                  passwordResetRequests: true,
                },
              },
              passwordResetRequests: {
                orderBy: [{ createdAt: "desc" }],
                take: 8,
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  reviewedAt: true,
                  completedAt: true,
                  reviewerNote: true,
                  reviewedBy: {
                    select: {
                      id: true,
                      username: true,
                    },
                  },
                  setupCode: {
                    select: {
                      id: true,
                      codeSuffix: true,
                      createdAt: true,
                      expiresAt: true,
                      usedAt: true,
                      revokedAt: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
      db.registrationRequest.findMany({
        take: 50,
        orderBy: [{ createdAt: "desc" }],
        include: {
          reviewedBy: {
            select: {
              id: true,
              username: true,
            },
          },
          approvedUser: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      db.passwordResetRequest.findMany({
        take: 20,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          reviewerNote: true,
          createdAt: true,
          reviewedAt: true,
          completedAt: true,
          user: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              username: true,
            },
          },
          setupCode: {
            select: {
              id: true,
              codeSuffix: true,
              createdAt: true,
              expiresAt: true,
              usedAt: true,
              revokedAt: true,
            },
          },
        },
      }),
    ]);

  const shooters = users.filter((user) => user.role === UserRole.SHOOTER);
  const filteredShooters = shooterQuery
    ? shooters.filter((user) =>
        user.username.toLocaleLowerCase("en-US").includes(shooterQuery.toLocaleLowerCase("en-US")),
      )
    : shooters;
  const filteredAccounts = accountQuery
    ? users.filter((user) =>
        user.username.toLocaleLowerCase("en-US").includes(accountQuery.toLocaleLowerCase("en-US")) ||
        user.email?.toLocaleLowerCase("en-US").includes(accountQuery.toLocaleLowerCase("en-US")),
      )
    : users;
  const totalAdmins = users.filter((user) => user.role === UserRole.ADMIN).length;
  const totalShooters = shooters.length;
  const registeredShooterCount = shooters.filter((user) => Boolean(user.email && user.passwordHash)).length;
  const pendingRegistrationRequests = registrationRequests.filter(
    (request) => request.status === "PENDING",
  );
  const pendingRegistrationCount = pendingRegistrationRequests.length;
  const rejectedRegistrationCount = registrationRequests.filter(
    (request) => request.status === "REJECTED",
  ).length;

  const liveSnapshot = activeSeason
    ? buildLeaderboardSnapshot(activeSeason, { publishedAt: activeSeason.publishedAt })
    : null;

  const shooterStats = getShooterStats(
    selectedShooter?.role === UserRole.SHOOTER
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
      <AppHeader
        authenticated
        shooterAuthenticated={shooterAuthenticated}
        active="dashboard"
        leaderboardHref="/admin/leaderboard"
      />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title">Dashboard</h1>
        </section>

        {notice ? <p className="success-banner">{notice}</p> : null}

        <section className="stats-grid">
          <article className="panel stat-card">
            <p className="section-eyebrow">USERS</p>
            <strong>{totalUsers}</strong>
            <span>All database-backed accounts</span>
          </article>
          <article className="panel stat-card">
            <p className="section-eyebrow">SHOOTERS</p>
            <strong>{totalShooters}</strong>
            <span>Leaderboard participants</span>
          </article>
          <article className="panel stat-card">
            <p className="section-eyebrow">ADMINS</p>
            <strong>{totalAdmins}</strong>
            <span>Dashboard-capable accounts</span>
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
            {activeSeason?.publishedAt ? (
              <div className="live-status">
                <span className="live-status__dot" aria-hidden="true" />
                <strong>LIVE</strong>
              </div>
            ) : (
              <strong>PENDING</strong>
            )}
            <span>{formatDateTime(activeSeason?.publishedAt ?? null)}</span>
          </article>
        </section>

        <nav className="dashboard-tabs" aria-label="Dashboard tabs">
          {DASHBOARD_TABS.map((tab) => (
            <Link
              key={tab}
              href={buildDashboardHref(tab)}
              scroll={false}
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

              <form
                action={createSeasonAction}
                className="form-grid form-grid--single"
                data-preserve-scroll="true"
              >
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
                    <form
                      action={updateSeasonAction}
                      className="inline-form"
                      data-preserve-scroll="true"
                    >
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
                          <form action={finishSeasonAction} data-preserve-scroll="true">
                            <input type="hidden" name="seasonId" value={season.id} />
                            <button type="submit" className="button button--secondary">
                              FINISH SEASON
                            </button>
                          </form>
                        </>
                      ) : null}

                      <form action={deleteSeasonAction} data-preserve-scroll="true">
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
                  <form
                    action={createDrillAction}
                    className="form-grid form-grid--single"
                    data-preserve-scroll="true"
                  >
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
                          <form
                            action={updateDrillAction}
                            className="inline-form"
                            data-preserve-scroll="true"
                          >
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

                          <form action={deleteDrillAction} data-preserve-scroll="true">
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
            <article className="panel">
              <div className="panel-header">
                <h2>Search Shooters</h2>
              </div>

              <form
                action="/admin/dashboard"
                method="get"
                className="form-grid form-grid--single"
                data-preserve-scroll="true"
              >
                <input type="hidden" name="tab" value="shooters" />
                <label className="field">
                  <span className="field__label">Search By Username</span>
                  <input
                    className="text-input"
                    name="q"
                    list="dashboard-shooter-search"
                    defaultValue={shooterQuery}
                    placeholder="Start typing a shooter"
                  />
                </label>
                <div className="button-row">
                  <button type="submit" className="button button--primary">
                    SEARCH
                  </button>
                  <Link
                    href={buildDashboardHref("shooters")}
                    scroll={false}
                    className="button button--ghost"
                  >
                    CLEAR
                  </Link>
                </div>
              </form>

              <datalist id="dashboard-shooter-search">
                {shooters.map((user) => (
                  <option key={user.id} value={user.username} />
                ))}
              </datalist>
            </article>

            {selectedShooter ? (
              <article className="panel">
                <div className="panel-header">
                  <h2>{selectedShooter.username}</h2>
                  <Link
                    href={buildDashboardHref("shooters", { q: shooterQuery || null })}
                    scroll={false}
                    className="button button--ghost"
                  >
                    CLOSE SHOOTER
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
                  <div className="detail-stat">
                    <span>Member since</span>
                    <strong>{formatDateTime(selectedShooter.createdAt)}</strong>
                  </div>
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
                <span className="panel-note">{filteredShooters.length} shown</span>
              </div>

              <div className="entity-list entity-list--scroll">
                {filteredShooters.length > 0 ? (
                  filteredShooters.map((user) => (
                    <div key={user.id} className="entity-card entity-card--row">
                      <div className="entity-meta entity-meta--stack">
                        <strong>{user.username}</strong>
                        <span>{user._count.entries} attempts</span>
                        <span>Member since {formatDateTime(user.createdAt)}</span>
                      </div>
                      <Link
                        href={buildDashboardHref("shooters", {
                          q: shooterQuery || null,
                          shooter: user.id,
                        })}
                        scroll={false}
                        className="button button--ghost"
                      >
                        VIEW SHOOTER
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

        {currentTab === "accounts" ? (
          <section className="content-stack">
            <section className="dashboard-grid dashboard-grid--accounts">
              <article className="panel">
                <div className="panel-header">
                  <h2>Search Accounts</h2>
                </div>

                <form
                  action="/admin/dashboard"
                  method="get"
                  className="form-grid form-grid--single"
                  data-preserve-scroll="true"
                >
                  <input type="hidden" name="tab" value="accounts" />
                  <label className="field">
                    <span className="field__label">Search By Name Or Email</span>
                    <input
                      className="text-input"
                      name="accountQ"
                      list="dashboard-account-search"
                      defaultValue={accountQuery}
                      placeholder="Start typing a name or email"
                    />
                  </label>
                  <div className="button-row">
                    <button type="submit" className="button button--primary">
                      SEARCH
                    </button>
                    <Link
                      href={buildDashboardHref("accounts")}
                      scroll={false}
                      className="button button--ghost"
                    >
                      CLEAR
                    </Link>
                  </div>
                </form>

                <datalist id="dashboard-account-search">
                  {users.flatMap((user) =>
                    [user.username, user.email].filter(Boolean).map((value) => (
                      <option key={`${user.id}-${value}`} value={value ?? ""} />
                    )),
                  )}
                </datalist>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h2>Registration Status</h2>
                </div>

                <div className="detail-stats detail-stats--compact">
                  <div className="detail-stat">
                    <span>Registered shooters</span>
                    <strong>{registeredShooterCount}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Pending requests</span>
                    <strong>{pendingRegistrationCount}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Rejected requests</span>
                    <strong>{rejectedRegistrationCount}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Admin accounts</span>
                    <strong>{totalAdmins}</strong>
                  </div>
                </div>
              </article>

            </section>

            {accountQuery ? (
              <article className="panel">
                <div className="panel-header">
                  <h2>Search Results</h2>
                  <span className="panel-note">{filteredAccounts.length} shown</span>
                </div>

                <div className="entity-list entity-list--scroll">
                  {filteredAccounts.length > 0 ? (
                    filteredAccounts.map((user) => (
                      <div key={user.id} className="entity-card entity-card--row">
                        <div className="entity-meta entity-meta--stack">
                          <div className="entity-badge-row">
                            <span className="status-badge status-badge--neutral">{user.role}</span>
                            <span
                              className={`status-badge ${
                                user.email && user.passwordHash
                                  ? "status-badge--ok"
                                  : "status-badge--warn"
                              }`}
                            >
                              {getAccountStateLabel(user)}
                            </span>
                            {user.passwordResetRequests[0] ? (
                              <span className="status-badge status-badge--warn">RESET PENDING</span>
                            ) : null}
                          </div>
                          <strong>{user.username}</strong>
                          <span>{user.email ?? "No approved email yet"}</span>
                          <span>{user._count.entries} attempts</span>
                          <span>Created {formatDateTime(user.createdAt)}</span>
                        </div>
                        <Link
                          href={buildDashboardHref("accounts", {
                            accountQ: accountQuery || null,
                            account: user.id,
                          })}
                          scroll={false}
                          className="button button--ghost"
                        >
                          MANAGE ACCOUNT
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No accounts match that search.</div>
                  )}
                </div>
              </article>
            ) : null}

            {selectedAccount ? (
              <article className="panel">
                <div className="panel-header">
                  <h2>{selectedAccount.username}</h2>
                  <Link
                    href={buildDashboardHref("accounts", { accountQ: accountQuery || null })}
                    scroll={false}
                    className="button button--ghost"
                  >
                    CLOSE ACCOUNT
                  </Link>
                </div>

                <div className="detail-stats">
                  <div className="detail-stat">
                    <span>Role</span>
                    <strong>{selectedAccount.role}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Total attempts</span>
                    <strong>{selectedAccount._count.entries}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Created</span>
                    <strong>{formatDateTime(selectedAccount.createdAt)}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Account state</span>
                    <strong>{getAccountStateLabel(selectedAccount)}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Pending resets</span>
                    <strong>
                      {
                        selectedAccount.passwordResetRequests.filter(
                          (request) => request.status === PasswordResetRequestStatus.PENDING,
                        ).length
                      }
                    </strong>
                  </div>
                  <div className="detail-stat">
                    <span>Email</span>
                    <strong>{selectedAccount.email ?? "NOT SET"}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Password updated</span>
                    <strong>
                      {selectedAccount.passwordHash
                        ? formatDateTime(selectedAccount.passwordUpdatedAt)
                        : "NOT SET"}
                    </strong>
                  </div>
                </div>

                <div className="dashboard-grid dashboard-grid--balanced">
                  <div className="subpanel">
                    <div className="panel-header">
                      <div>
                        <p className="section-eyebrow">ACCOUNT</p>
                        <h3>Identity & Access</h3>
                      </div>
                      <span
                        className={`status-badge ${
                          selectedAccount.email && selectedAccount.passwordHash
                            ? "status-badge--ok"
                            : "status-badge--warn"
                        }`}
                      >
                        {selectedAccount.email && selectedAccount.passwordHash
                          ? "ACCESS ENABLED"
                          : "REGISTRATION REQUIRED"}
                      </span>
                    </div>

                    <form
                      action={updateUserAction}
                      className="form-grid"
                      data-preserve-scroll="true"
                    >
                      <input type="hidden" name="userId" value={selectedAccount.id} />
                      <label className="field">
                        <span className="field__label">Username</span>
                        <input
                          className="text-input"
                          name="username"
                          defaultValue={selectedAccount.username}
                          required
                        />
                      </label>

                      <label className="field">
                        <span className="field__label">Email</span>
                        <input
                          className="text-input"
                          name="email"
                          type="email"
                          defaultValue={selectedAccount.email ?? ""}
                          placeholder="name@example.com"
                        />
                      </label>

                      <label className="field">
                        <span className="field__label">Role</span>
                        <select
                          className="text-input"
                          name="role"
                          defaultValue={selectedAccount.role}
                        >
                          <option value={UserRole.SHOOTER}>Shooter</option>
                          <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                      </label>

                      <label className="field">
                        <span className="field__label">
                          {selectedAccount.passwordHash ? "Rotate Password" : "Set Password"}
                        </span>
                        <input
                          className="text-input"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={
                            selectedAccount.passwordHash
                              ? "Leave blank to keep the current password"
                              : "Set a first password"
                          }
                        />
                      </label>

                      <button type="submit" className="button button--primary field--span-2">
                        SAVE ACCOUNT
                      </button>
                    </form>

                    <p className="panel-note">
                      Public registration is now the only path for new shooter access. Existing
                      accounts can still be maintained here after approval.
                    </p>
                  </div>

                  <div className="subpanel">
                    <div className="panel-header">
                      <h3>Reset Activity</h3>
                    </div>
                    <div className="entity-list">
                      {selectedAccount.passwordResetRequests.length > 0 ? (
                        selectedAccount.passwordResetRequests.map((request) => (
                          <div key={request.id} className="entity-card">
                            <div className="entity-meta entity-meta--stack">
                              <div className="entity-badge-row">
                                <span className="status-badge status-badge--neutral">
                                  {request.status}
                                </span>
                                {request.setupCode ? (
                                  <span className="status-badge status-badge--warn">
                                    {`CODE ****-${request.setupCode.codeSuffix}`}
                                  </span>
                                ) : null}
                              </div>
                              <span>Requested {formatDateTime(request.createdAt)}</span>
                              <span>
                                Reviewed{" "}
                                {request.reviewedAt
                                  ? formatDateTime(request.reviewedAt)
                                  : "NOT REVIEWED"}
                              </span>
                              <span>
                                Completed{" "}
                                {request.completedAt
                                  ? formatDateTime(request.completedAt)
                                  : "NOT COMPLETED"}
                              </span>
                              <span>
                                By {request.reviewedBy?.username ?? "SYSTEM / PENDING"}
                              </span>
                              {request.reviewerNote ? <span>{request.reviewerNote}</span> : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">No password reset activity for this account.</div>
                      )}
                    </div>
                  </div>

                  <div className="subpanel">
                    <div className="panel-header">
                      <h3>Danger Zone</h3>
                    </div>
                    <p className="panel-note">
                      Deleting an account removes access for that user immediately. Existing entry
                      history will follow the current delete behavior from the backend action.
                    </p>
                    <div className="button-row">
                      <form action={deleteUserAction} data-preserve-scroll="true">
                        <input type="hidden" name="userId" value={selectedAccount.id} />
                        <button type="submit" className="button button--danger">
                          DELETE ACCOUNT
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            {pendingRegistrationRequests.length > 0 ? (
              <article className="panel">
                <div className="panel-header">
                  <h2>Registration Requests</h2>
                  <span className="panel-note">{pendingRegistrationRequests.length} pending</span>
                </div>

                <div className="entity-list entity-list--scroll">
                  {pendingRegistrationRequests.map((request) => (
                    <div key={request.id} className="entity-card">
                      <div className="entity-meta entity-meta--stack">
                        <div className="entity-badge-row">
                          <span className="status-badge status-badge--warn">{request.status}</span>
                        </div>
                        <strong>{`${request.firstName} ${request.lastName}`}</strong>
                        <span>{request.email}</span>
                        <span>Submitted {formatDateTime(request.createdAt)}</span>
                        {request.approvedUser ? (
                          <span>{`Attached to ${request.approvedUser.username}`}</span>
                        ) : null}
                        {request.reviewedBy ? (
                          <span>{`Reviewed by ${request.reviewedBy.username} on ${formatDateTime(
                            request.reviewedAt,
                          )}`}</span>
                        ) : null}
                        {request.reviewerNote ? <span>{request.reviewerNote}</span> : null}
                      </div>

                      <div className="button-row">
                        <form action={approveRegistrationRequestAction} data-preserve-scroll="true">
                          <input type="hidden" name="requestId" value={request.id} />
                          <button type="submit" className="button button--primary">
                            APPROVE
                          </button>
                        </form>
                        <form action={rejectRegistrationRequestAction} data-preserve-scroll="true">
                          <input type="hidden" name="requestId" value={request.id} />
                          <button type="submit" className="button button--ghost">
                            REJECT
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            <PasswordResetRequestsPanel
              requests={passwordResetRequests.map((request) => ({
                ...request,
                createdAt: request.createdAt.toISOString(),
                reviewedAt: request.reviewedAt?.toISOString() ?? null,
                completedAt: request.completedAt?.toISOString() ?? null,
                setupCode: request.setupCode
                  ? {
                      ...request.setupCode,
                      createdAt: request.setupCode.createdAt.toISOString(),
                      expiresAt: request.setupCode.expiresAt.toISOString(),
                      usedAt: request.setupCode.usedAt?.toISOString() ?? null,
                      revokedAt: request.setupCode.revokedAt?.toISOString() ?? null,
                    }
                  : null,
              }))}
            />
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
                  <form
                    action={createEntryAction}
                    className="form-grid"
                    data-preserve-scroll="true"
                  >
                    <input type="hidden" name="seasonId" value={activeSeason.id} />
                    <label className="field field--span-2">
                      <span className="field__label">Shooter</span>
                      <input
                        className="text-input"
                        list="registered-users"
                        name="username"
                        placeholder="Search an approved shooter"
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
                    {shooters.map((user) => (
                      <option key={user.id} value={user.username} />
                    ))}
                  </datalist>

                  <p className="panel-note">
                    Entries can only be logged for existing shooter profiles. New people must
                    register and be approved first.
                  </p>
                </>
              ) : (
                <div className="empty-state">
                  Add an active season and at least one drill before entering times.
                </div>
              )}

              <div className="entity-list entity-list--scroll">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="entity-card">
                    <form
                      action={updateEntryAction}
                      className="entry-form"
                      data-preserve-scroll="true"
                    >
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

                      <form action={deleteEntryAction} data-preserve-scroll="true">
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
                <form action={publishLeaderboardAction} data-preserve-scroll="true">
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
