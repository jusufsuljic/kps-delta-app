import { SetupPanel } from "@/components/auth/SetupPanel";
import { ShooterHeader } from "@/components/ShooterHeader";
import { isAdminAuthenticated, isShooterAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams: Promise<{
    code?: string;
    token?: string;
    username?: string;
    role?: string;
    expires?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const [shooterAuthenticated, adminAuthenticated] = await Promise.all([
    isShooterAuthenticated(),
    isAdminAuthenticated(),
  ]);

  return (
    <div className="site-root">
      <ShooterHeader
        authenticated={shooterAuthenticated}
        adminAuthenticated={adminAuthenticated}
        active="login"
      />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title page-title--compact">ACCOUNT SETUP</h1>
        </section>

        <section className="dashboard-grid auth-grid auth-grid--single">
          <SetupPanel
            code={params.code ?? params.token}
            username={params.username}
            role={params.role}
            expires={params.expires}
            error={params.error}
            success={params.success}
          />
        </section>
      </main>
    </div>
  );
}
