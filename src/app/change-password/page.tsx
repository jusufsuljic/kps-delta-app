import { PasswordChangePanel } from "@/components/auth/PasswordChangePanel";
import { ShooterHeader } from "@/components/ShooterHeader";
import { isAdminAuthenticated, isShooterAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PasswordChangeMode = "authenticated" | "forced" | "request-reset";

type ChangePasswordPageProps = {
  searchParams: Promise<{
    mode?: string;
    username?: string;
    error?: string;
    success?: string;
  }>;
};

function resolvePasswordChangeMode(value?: string): PasswordChangeMode {
  if (value === "forced") {
    return "forced";
  }

  if (value === "request-reset") {
    return "request-reset";
  }

  return "authenticated";
}

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const params = await searchParams;
  const mode = resolvePasswordChangeMode(params.mode);
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
          <h1 className="page-title page-title--compact">
            {mode === "request-reset" ? "REQUEST RESET" : "CHANGE PASSWORD"}
          </h1>
        </section>

        <section className="dashboard-grid auth-grid auth-grid--single">
          <PasswordChangePanel
            mode={mode}
            username={params.username}
            error={params.error}
            success={params.success}
          />
        </section>
      </main>
    </div>
  );
}
