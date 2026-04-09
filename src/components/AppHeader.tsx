import Image from "next/image";
import Link from "next/link";

type AppHeaderProps = {
  authenticated: boolean;
  active: "leaderboard" | "dashboard" | "admin";
  leaderboardHref?: string;
};

export function AppHeader({
  authenticated,
  active,
  leaderboardHref = "/",
}: AppHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-shell site-header__inner">
        <Link href="/" className="site-logo" aria-label="KPS Delta App">
          <Image src="/delta_logo.svg" alt="KPS Delta" width={58} height={58} priority />
          <div className="site-logo__text">
            <span>KPS DELTA</span>
            <strong>APP</strong>
          </div>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <Link
            href={leaderboardHref}
            className={`nav-link ${active === "leaderboard" ? "nav-link--active" : ""}`}
          >
            LEADERBOARD
          </Link>

          {authenticated ? (
            <>
              <Link
                href="/admin/dashboard"
                className={`nav-link ${active === "dashboard" ? "nav-link--active" : ""}`}
              >
                DASHBOARD
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="nav-link nav-link--button">
                  LOGOUT
                </button>
              </form>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
