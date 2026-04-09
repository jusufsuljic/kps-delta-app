import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  if (await isAdminAuthenticated()) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const configured = Boolean(
    process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET,
  );

  return (
    <div className="site-root">
      <AppHeader authenticated={false} active="admin" />

      <main className="site-shell page-stack">
        <section className="hero hero--admin">
          <div className="section-heading">
            <p className="section-eyebrow">ADMIN ACCESS</p>
            <h1>LEADERBOARD CONTROL ROOM</h1>
          </div>
          <p className="hero-copy">
            Admin login is isolated to this app and only controls seasons, drills, users,
            entries, and public leaderboard publication.
          </p>
        </section>

        <section className="panel auth-panel">
          <div className="section-heading">
            <p className="section-eyebrow">LOGIN</p>
            <h2>Sign In</h2>
          </div>

          {!configured ? (
            <p className="error-banner">
              Missing `ADMIN_USERNAME`, `ADMIN_PASSWORD`, or `AUTH_SECRET` in the environment.
            </p>
          ) : null}

          {params.error === "invalid" ? (
            <p className="error-banner">Invalid admin credentials.</p>
          ) : null}

          <form action="/api/auth/login" method="post" className="form-grid form-grid--single">
            <label className="field">
              <span className="field__label">Username</span>
              <input
                className="text-input"
                name="username"
                type="text"
                autoComplete="username"
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="text-input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" className="button button--primary" disabled={!configured}>
              ENTER DASHBOARD
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
