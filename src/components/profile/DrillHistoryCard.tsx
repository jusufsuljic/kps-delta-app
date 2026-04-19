import { formatSeconds } from "@/lib/format";
import type { ShooterProfileDrill } from "@/lib/profile";

import { PerformanceChart } from "./PerformanceChart";

type DrillHistoryCardProps = {
  drill: ShooterProfileDrill;
  seasonLabel: string;
};

export function DrillHistoryCard({ drill, seasonLabel }: DrillHistoryCardProps) {
  return (
    <article className="drill-history-card">
      <div className="panel-header">
        <div>
          <p className="section-eyebrow">PERFORMANCE</p>
          <h2>{drill.drillName}</h2>
        </div>

        <div className="entity-meta entity-meta--stack">
          <span>{seasonLabel}</span>
          <span>{drill.entryCount} attempts tracked</span>
        </div>
      </div>

      <div className="detail-stats detail-stats--compact">
        <div className="detail-stat">
          <span>Best Time</span>
          <strong>{formatSeconds(drill.bestTime)}</strong>
        </div>
        <div className="detail-stat">
          <span>First Attempt</span>
          <strong>{formatSeconds(drill.firstTime)}</strong>
        </div>
        <div className="detail-stat">
          <span>Latest Attempt</span>
          <strong>{formatSeconds(drill.lastTime)}</strong>
        </div>
        <div className="detail-stat">
          <span>Delta</span>
          <strong>{`${drill.delta <= 0 ? "" : "+"}${drill.delta.toFixed(2)}s`}</strong>
        </div>
      </div>

      <PerformanceChart points={drill.trend} />

      <div className="history-summary">
        <span>
          Coverage: <strong>{drill.seasonCount} seasons</strong>
        </span>
        <span>
          First to latest: <strong>{drill.entryCount} attempts</strong>
        </span>
      </div>
    </article>
  );
}
