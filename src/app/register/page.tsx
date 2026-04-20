import { redirect } from "next/navigation";

import { RegisterPanel } from "@/components/auth/RegisterPanel";
import { ShooterHeader } from "@/components/ShooterHeader";
import { isAdminAuthenticated, isShooterAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const [shooterAuthenticated, adminAuthenticated] = await Promise.all([
    isShooterAuthenticated(),
    isAdminAuthenticated(),
  ]);

  if (shooterAuthenticated) {
    redirect("/profile");
  }

  if (adminAuthenticated) {
    redirect("/admin/dashboard");
  }

  const error =
    params.error === "missing"
      ? "missing"
      : params.error === "mismatch"
        ? "mismatch"
        : params.error === "weak"
          ? "weak"
          : params.error === "invalid-email"
            ? "invalid-email"
            : params.error === "exists"
              ? "exists"
              : undefined;
  const success = params.success === "submitted" ? "submitted" : undefined;

  return (
    <div className="site-root">
      <ShooterHeader authenticated={false} adminAuthenticated={false} active="register" />

      <main className="site-shell page-stack">
        <section className="page-bar">
          <h1 className="page-title page-title--compact">REGISTER</h1>
        </section>

        <section className="dashboard-grid auth-grid auth-grid--single">
          <RegisterPanel error={error} success={success} />
        </section>
      </main>
    </div>
  );
}
