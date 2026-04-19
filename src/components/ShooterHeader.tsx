import { SiteHeader } from "@/components/SiteHeader";

type ShooterHeaderProps = {
  authenticated: boolean;
  active: "leaderboard" | "profile" | "login";
  adminAuthenticated?: boolean;
};

export function ShooterHeader({
  authenticated,
  active,
  adminAuthenticated = false,
}: ShooterHeaderProps) {
  return (
    <SiteHeader
      active={active}
      leaderboardHref="/"
      shooterAuthenticated={authenticated}
      adminAuthenticated={adminAuthenticated}
    />
  );
}
