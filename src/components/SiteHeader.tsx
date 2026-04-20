import Image from "next/image";
import Link from "next/link";

export type SiteHeaderActive = "leaderboard" | "profile" | "login" | "register" | "dashboard";

type SiteHeaderProps = {
  active: SiteHeaderActive;
  leaderboardHref?: string;
  shooterAuthenticated?: boolean;
  adminAuthenticated?: boolean;
};

export function SiteHeader({
  active,
  leaderboardHref = "/",
  shooterAuthenticated = false,
  adminAuthenticated = false,
}: SiteHeaderProps) {
  const hasLoggedOutState = !shooterAuthenticated && !adminAuthenticated;
  const sessionLabel = adminAuthenticated ? "ADMIN" : shooterAuthenticated ? "SHOOTER" : null;
  const logoutAction = "/api/auth/logout";

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

        <div className="site-header__nav-wrap">
          <nav className="site-nav" aria-label="Primary">
            <Link
              href={leaderboardHref}
              className={`nav-link ${active === "leaderboard" ? "nav-link--active" : ""}`}
            >
              LEADERBOARD
            </Link>

            {shooterAuthenticated ? (
              <Link
                href="/profile"
                className={`nav-link ${active === "profile" ? "nav-link--active" : ""}`}
              >
                PROFILE
              </Link>
            ) : null}

            {adminAuthenticated ? (
              <Link
                href="/admin/dashboard"
                className={`nav-link ${active === "dashboard" ? "nav-link--active" : ""}`}
              >
                DASHBOARD
              </Link>
            ) : null}

            {hasLoggedOutState ? (
              <>
                <Link
                  href="/login"
                  className={`nav-link ${active === "login" ? "nav-link--active" : ""}`}
                >
                  LOGIN
                </Link>
                <Link
                  href="/register"
                  className={`nav-link ${active === "register" ? "nav-link--active" : ""}`}
                >
                  REGISTER
                </Link>
              </>
            ) : null}
          </nav>

          {shooterAuthenticated || adminAuthenticated ? (
            <div className="site-header__actions">
              <div className="session-chip-row" aria-label="Active session">
                {sessionLabel ? (
                  <span
                    className={`session-chip ${
                      adminAuthenticated ? "session-chip--admin" : "session-chip--shooter"
                    }`}
                  >
                    {sessionLabel}
                  </span>
                ) : null}
              </div>

              <form action={logoutAction} method="post">
                <button type="submit" className="nav-link nav-link--button">
                  LOGOUT
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
