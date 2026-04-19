import Link from "next/link";
import { redirect } from "next/navigation";

import { ShooterHeader } from "@/components/ShooterHeader";
import { DrillHistoryCard } from "@/components/profile/DrillHistoryCard";
import { HistoryTrackerPanel } from "@/components/profile/HistoryTrackerPanel";
import { ProfileAccountPanel } from "@/components/profile/ProfileAccountPanel";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { getCurrentShooter, isAdminAuthenticated } from "@/lib/auth";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { loadShooterProfileView } from "@/lib/profile";

export const dynamic = "force-dynamic";

type ProfileTab = "performance" | "account";

type ShooterProfilePageProps = {
  searchParams: Promise<{
    tab?: string;
    season?: string;
    sort?: string;
    drill?: string;
    notice?: string;
  }>;
};

function buildProfileHref(params: {
  tab?: ProfileTab;
  seasonId?: string;
  sort?: string;
  drillId?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "performance") {
    search.set("tab", params.tab);
  }

  if (params.seasonId && params.seasonId !== "all") {
    search.set("season", params.seasonId);
  }

  if (params.sort && params.sort !== "date") {
    search.set("sort", params.sort);
  }

  if (params.drillId) {
    search.set("drill", params.drillId);
  }

  const query = search.toString();
  return query ? `/profile?${query}` : "/profile";
}

function resolveProfileTab(value?: string): ProfileTab {
  return value === "account" ? "account" : "performance";
}

export default async function ShooterProfilePage({
  searchParams,
}: ShooterProfilePageProps) {
  const params = await searchParams;
  const currentTab = resolveProfileTab(params.tab);
  const [profile, currentShooter, adminAuthenticated] = await Promise.all([
    loadShooterProfileView({
      seasonId: params.season,
      sort: params.sort,
      drillId: params.drill,
    }),
    getCurrentShooter(),
    isAdminAuthenticated(),
  ]);

  if (!profile || !currentShooter) {
    redirect("/login?error=missing");
  }

  const seasonLabel =
    profile.selectedSeasonId === "all"
      ? "All seasons"
      : profile.seasons.find((season) => season.id === profile.selectedSeasonId)?.seasonName ??
        "All seasons";
  const notice =
    params.notice === "password-updated"
      ? "Password updated successfully."
      : null;

  return (
    <div className="site-root">
      <ShooterHeader authenticated adminAuthenticated={adminAuthenticated} active="profile" />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title page-title--compact">PROFILE</h1>
          <div className="entity-meta">
            <span>{`Role: ${currentShooter.role}`}</span>
            {currentTab === "account" ? (
              <span>Password updated: {formatDateTime(currentShooter.passwordUpdatedAt)}</span>
            ) : (
              <>
                <span>Last shot: {formatDateTime(profile.lastShotAt)}</span>
                <span>Best time: {profile.bestTime ? formatSeconds(profile.bestTime) : "--"}</span>
              </>
            )}
          </div>
        </section>

        {notice ? <p className="success-banner">{notice}</p> : null}

        <ProfileHero
          username={profile.username}
          initials={profile.initials}
          avatarHue={profile.avatarHue}
          joinedAt={profile.createdAt}
          totalEntries={profile.totalEntries}
          drillsShot={profile.drillsShot}
          bestTime={profile.bestTime}
          lastShotAt={profile.lastShotAt}
        />

        <div className="leaderboard-pills" role="tablist" aria-label="Profile sections">
          <Link
            href={buildProfileHref({
              tab: "performance",
              seasonId: profile.selectedSeasonId,
              sort: profile.historySort,
              drillId: profile.selectedDrill?.drillId ?? null,
            })}
            className={`leaderboard-pill ${
              currentTab === "performance" ? "leaderboard-pill--active" : ""
            }`}
          >
            PERFORMANCE
          </Link>
          <Link
            href={buildProfileHref({ tab: "account" })}
            className={`leaderboard-pill ${currentTab === "account" ? "leaderboard-pill--active" : ""}`}
          >
            ACCOUNT
          </Link>
        </div>

        {currentTab === "account" ? (
          <ProfileAccountPanel
            username={profile.username}
            role={currentShooter.role}
            joinedAt={profile.createdAt}
            passwordUpdatedAt={currentShooter.passwordUpdatedAt}
          />
        ) : (
          <>
            <HistoryTrackerPanel
              entries={profile.historyEntries}
              seasons={profile.seasons}
              selectedSeasonId={profile.selectedSeasonId}
              historySort={profile.historySort}
              selectedDrillId={profile.selectedDrill?.drillId ?? null}
            />

            <section className="panel profile-section">
              <div className="panel-header">
                <div>
                  <p className="section-eyebrow">PERFORMANCE</p>
                  <h2>Drill Performance</h2>
                </div>
                <span className="panel-note">{seasonLabel}</span>
              </div>

              {profile.drills.length > 0 && profile.selectedDrill ? (
                <>
                  <div className="leaderboard-pills" role="tablist" aria-label="Performance drills">
                    {profile.drills.map((drill) => (
                      <Link
                        key={drill.drillId}
                        href={buildProfileHref({
                          tab: "performance",
                          seasonId: profile.selectedSeasonId,
                          sort: profile.historySort,
                          drillId: drill.drillId,
                        })}
                        className={`leaderboard-pill ${
                          profile.selectedDrill?.drillId === drill.drillId
                            ? "leaderboard-pill--active"
                            : ""
                        }`}
                      >
                        {drill.drillName.toUpperCase()}
                      </Link>
                    ))}
                  </div>

                  <DrillHistoryCard drill={profile.selectedDrill} seasonLabel={seasonLabel} />
                </>
              ) : (
                <div className="empty-state">
                  No performance data is available for the selected season yet.
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
