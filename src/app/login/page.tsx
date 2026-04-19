import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthLoginPanel } from "@/components/auth/AuthLoginPanel";
import { ShooterHeader } from "@/components/ShooterHeader";
import { isAdminAuthenticated, isShooterAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginMode = "shooter" | "admin";

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string;
    error?: string;
    success?: string;
  }>;
};

function resolveLoginMode(value?: string): LoginMode {
  return value === "admin" ? "admin" : "shooter";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const mode = resolveLoginMode(params.mode);

  const [shooterAuthenticated, adminAuthenticated] = await Promise.all([
    isShooterAuthenticated(),
    isAdminAuthenticated(),
  ]);

  if (!params.mode) {
    if (adminAuthenticated) {
      redirect("/admin/dashboard");
    }

    if (shooterAuthenticated) {
      redirect("/profile");
    }
  }

  if (mode === "admin" && adminAuthenticated) {
    redirect("/admin/dashboard");
  }

  if (mode === "shooter" && shooterAuthenticated) {
    redirect("/profile");
  }

  const error =
    params.error === "invalid" ? "invalid" : params.error === "missing" ? "missing" : undefined;
  const success =
    params.success === "setup-complete"
      ? "setup-complete"
      : params.success === "password-updated"
        ? "password-updated"
        : undefined;

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
            {mode === "admin" ? "ADMIN LOGIN" : "LOGIN"}
          </h1>
        </section>

        <section className="dashboard-grid auth-grid auth-grid--single">
          <AuthLoginPanel mode={mode} error={error} success={success} />
        </section>

        <div className="button-row auth-links-row">
          <Link href="/change-password?mode=request-reset" className="button button--ghost">
            REQUEST RESET
          </Link>
          {mode === "admin" ? (
            <Link href="/login" className="button button--ghost">
              STANDARD LOGIN
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
