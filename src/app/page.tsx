import { AppHeader } from "@/components/AppHeader";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { formatDateTime } from "@/lib/format";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPublishedLeaderboardState } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type PublicPageProps = {
  searchParams: Promise<{
    board?: string;
  }>;
};

export default async function HomePage({ searchParams }: PublicPageProps) {
  const params = await searchParams;
  const [authenticated, publishedState] = await Promise.all([
    isAdminAuthenticated(),
    getPublishedLeaderboardState(),
  ]);

  return (
    <div className="site-root">
      <AppHeader authenticated={authenticated} active="leaderboard" />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title page-title--compact">
            {`DELTA DRILLS - ${publishedState.sourceSeasonName}`}
          </h1>
          <div className="entity-meta">
            <span>Last published: {formatDateTime(publishedState.lastPublishedAt)}</span>
          </div>
          {publishedState.staleNotice ? (
            <p className="notice-copy">{publishedState.staleNotice}</p>
          ) : null}
        </section>

        <LeaderboardPanel
          snapshot={publishedState.snapshot}
          activeBoardKey={params.board}
          path="/"
          pendingPublication={publishedState.pendingPublication}
          hideOverall
        />
      </main>
    </div>
  );
}
