import Link from "next/link";

import { formatSeconds } from "@/lib/format";
import type { LeaderboardSnapshot } from "@/lib/leaderboard";

type LeaderboardPanelProps = {
  snapshot: LeaderboardSnapshot | null;
  activeBoardKey?: string;
  path: string;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  pendingPublication?: boolean;
};

function getBoardHref(path: string, boardKey: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}board=${encodeURIComponent(boardKey)}`;
}

function getRankBadge(rank: number) {
  if (rank === 1) {
    return <span className="rank-chip rank-chip--gold">1</span>;
  }

  if (rank === 2) {
    return <span className="rank-chip rank-chip--silver">2</span>;
  }

  if (rank === 3) {
    return <span className="rank-chip rank-chip--bronze">3</span>;
  }

  return <span className="rank-chip rank-chip--plain">{rank}</span>;
}

export function LeaderboardPanel({
  snapshot,
  activeBoardKey,
  path,
  compact = false,
  title,
  subtitle,
  pendingPublication = false,
}: LeaderboardPanelProps) {
  const boards = snapshot?.boards ?? [];
  const activeBoard = boards.find((board) => board.key === activeBoardKey) ?? boards[0] ?? null;

  return (
    <section className={`panel leaderboard-panel ${compact ? "leaderboard-panel--compact" : ""}`}>
      {(title || subtitle) && (
        <div className="section-heading">
          {title ? <p className="section-eyebrow">{title}</p> : null}
          {subtitle ? <h2>{subtitle}</h2> : null}
        </div>
      )}

      {boards.length > 0 ? (
        <>
          <div className="leaderboard-pills" role="tablist" aria-label="Leaderboard filters">
            {boards.map((board) => (
              <Link
                key={board.key}
                href={getBoardHref(path, board.key)}
                className={`leaderboard-pill ${
                  activeBoard?.key === board.key ? "leaderboard-pill--active" : ""
                }`}
              >
                {board.label.toUpperCase()}
              </Link>
            ))}
          </div>

          <div className="leaderboard-scroll">
            {activeBoard && activeBoard.rows.length > 0 ? (
              activeBoard.rows.map((row) => (
                <div className="leaderboard-row" key={`${activeBoard.key}-${row.userId}`}>
                  <div className="leaderboard-row__identity">
                    {getRankBadge(row.rank)}
                    <span
                      className="avatar-badge"
                      style={{ background: `hsl(${row.avatarHue} 62% 26%)` }}
                    >
                      {row.initials}
                    </span>
                    <span className="leaderboard-row__name">{row.username}</span>
                  </div>
                  <span className="leaderboard-row__time">{formatSeconds(row.time)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                {pendingPublication
                  ? "No published leaderboard is visible yet."
                  : "No results have been entered for this board yet."}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          {pendingPublication
            ? "Create a season, add drills, then publish the leaderboard."
            : "No drills are available for this leaderboard yet."}
        </div>
      )}
    </section>
  );
}
