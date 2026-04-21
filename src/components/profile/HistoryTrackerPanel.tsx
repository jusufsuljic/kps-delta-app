import { formatDateTime, formatSeconds } from "@/lib/format";
import type {
  ProfileHistorySort,
  ShooterProfileEntry,
  ShooterProfileSeasonOption,
} from "@/lib/profile";

type HistoryTrackerPanelProps = {
  entries: ShooterProfileEntry[];
  seasons: ShooterProfileSeasonOption[];
  selectedSeasonId: string;
  historySort: ProfileHistorySort;
  selectedDrillId?: string | null;
};

export function HistoryTrackerPanel({
  entries,
  seasons,
  selectedSeasonId,
  historySort,
  selectedDrillId,
}: HistoryTrackerPanelProps) {
  return (
    <section className="panel profile-section">
      <div className="panel-header">
        <div>
          <p className="section-eyebrow">HISTORY TRACKER</p>
          <h2>All Shot Entries</h2>
        </div>
        <span className="panel-note">{entries.length} entries shown</span>
      </div>

      <form
        action="/profile"
        method="get"
        className="profile-filter-bar"
        data-preserve-scroll="true"
      >
        {selectedDrillId ? <input type="hidden" name="drill" value={selectedDrillId} /> : null}

        <label className="field">
          <span className="field__label">Season</span>
          <select className="text-input" name="season" defaultValue={selectedSeasonId}>
            <option value="all">All seasons</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.seasonName}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Sort</span>
          <select className="text-input" name="sort" defaultValue={historySort}>
            <option value="date">Date</option>
            <option value="drill">Drill</option>
          </select>
        </label>

        <button type="submit" className="button button--ghost">
          APPLY
        </button>
      </form>

      <div className="entity-list entity-list--scroll history-tracker-list">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div key={entry.id} className="history-tracker-row">
              <div className="history-tracker-row__time">{formatSeconds(entry.time)}</div>

              <div className="history-tracker-row__content">
                <strong>{entry.drillName}</strong>
                <span>{entry.seasonName}</span>
              </div>

              <div className="history-tracker-row__date">{formatDateTime(entry.createdAt)}</div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            No entries match the current season filter yet.
          </div>
        )}
      </div>
    </section>
  );
}
