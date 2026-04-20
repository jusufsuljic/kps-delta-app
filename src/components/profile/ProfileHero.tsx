type ProfileHeroProps = {
  username: string;
  initials: string;
  avatarHue: number;
  joinedAt: Date;
  totalEntries: number;
  drillsShot: number;
  lastShotAt: Date | null;
};

function formatShortDate(date: Date | null) {
  if (!date) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

export function ProfileHero({
  username,
  initials,
  avatarHue,
  joinedAt,
  totalEntries,
  drillsShot,
  lastShotAt,
}: ProfileHeroProps) {
  return (
    <section className="panel profile-hero">
      <div className="profile-hero__identity">
        <span className="profile-avatar" style={{ background: `hsl(${avatarHue} 62% 26%)` }}>
          {initials}
        </span>

        <div className="profile-hero__copy">
          <p className="section-eyebrow">SHOOTER PROFILE</p>
          <h2>{username}</h2>
          <p>
            A quick readout of your shooting history. Results are grouped by drill and ordered
            from your first attempt to your latest one.
          </p>
        </div>
      </div>

      <div className="profile-hero__meta">
        <span>Joined: {formatShortDate(joinedAt)}</span>
        <span>{totalEntries} total entries</span>
        <span>{drillsShot} drills shot</span>
        <span>Last shot: {formatShortDate(lastShotAt)}</span>
      </div>
    </section>
  );
}
