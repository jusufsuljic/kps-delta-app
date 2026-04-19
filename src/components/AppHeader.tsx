import { SiteHeader } from "@/components/SiteHeader";

type AppHeaderProps = {
  authenticated: boolean;
  active: "leaderboard" | "dashboard" | "admin";
  leaderboardHref?: string;
  shooterAuthenticated?: boolean;
};

export function AppHeader({
  authenticated,
  active,
  leaderboardHref = "/",
  shooterAuthenticated = false,
}: AppHeaderProps) {
  return (
    <SiteHeader
      active={active === "admin" ? "login" : active}
      leaderboardHref={leaderboardHref}
      shooterAuthenticated={shooterAuthenticated}
      adminAuthenticated={authenticated}
    />
  );
}
