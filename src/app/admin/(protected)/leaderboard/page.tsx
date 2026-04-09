import { AppHeader } from "@/components/AppHeader";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { formatDateTime } from "@/lib/format";
import { getPublishedLeaderboardState } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type AdminLeaderboardPageProps = {
  searchParams: Promise<{
    board?: string;
  }>;
};

export default async function AdminLeaderboardPage({
  searchParams,
}: AdminLeaderboardPageProps) {
  const params = await searchParams;
  const publishedState = await getPublishedLeaderboardState();

  return (
    <div className="site-root">
      <AppHeader authenticated active="leaderboard" leaderboardHref="/admin/leaderboard" />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title page-title--compact">{publishedState.sourceSeasonName}</h1>
          <div className="entity-meta">
            <span>Last published {formatDateTime(publishedState.lastPublishedAt)}</span>
          </div>
          {publishedState.staleNotice ? (
            <p className="notice-copy">{publishedState.staleNotice}</p>
          ) : null}
        </section>

        <LeaderboardPanel
          snapshot={publishedState.snapshot}
          activeBoardKey={params.board}
          path="/admin/leaderboard"
          pendingPublication={publishedState.pendingPublication}
        />
      </main>
    </div>
  );
}
