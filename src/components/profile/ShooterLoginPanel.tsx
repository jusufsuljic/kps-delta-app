import { AuthLoginPanel } from "@/components/auth/AuthLoginPanel";

type ShooterLoginPanelProps = {
  error?: "invalid" | "missing";
  actionPath?: string;
};

export function ShooterLoginPanel({
  error,
  actionPath = "/api/profile/login",
}: ShooterLoginPanelProps) {
  if (actionPath !== "/api/profile/login") {
    return (
      <section className="panel auth-panel auth-panel--profile">
        <div className="section-heading">
          <p className="section-eyebrow">ACCESS</p>
          <h2>Sign In</h2>
        </div>

        {error === "invalid" ? (
          <p className="error-banner">Invalid shooter credentials.</p>
        ) : null}

        {error === "missing" ? (
          <p className="error-banner">Your profile could not be loaded. Please sign in again.</p>
        ) : null}

        <form action={actionPath} method="post" className="form-grid form-grid--single">
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

          <button type="submit" className="button button--primary">
            ENTER PROFILE
          </button>
        </form>
      </section>
    );
  }

  return (
    <AuthLoginPanel mode="shooter" error={error} />
  );
}
