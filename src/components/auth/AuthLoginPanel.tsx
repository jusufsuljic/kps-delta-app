type AuthLoginMode = "shooter" | "admin";

type AuthLoginPanelProps = {
  mode: AuthLoginMode;
  error?: "invalid" | "missing";
  success?: "setup-complete" | "password-updated";
};

function getPanelCopy(mode: AuthLoginMode) {
  if (mode === "admin") {
    return {
      title: "Admin Login",
      description: "Use an admin account to access the dashboard.",
      submitLabel: "SIGN IN",
      invalidMessage: "That account does not have dashboard access or the password is incorrect.",
      missingMessage: "Your session is no longer valid. Sign in again.",
    };
  }

  return {
    title: "Login",
    description: "Enter your username and password.",
    submitLabel: "SIGN IN",
    invalidMessage: "Invalid username or password.",
    missingMessage: "Your session is no longer valid. Sign in again.",
  };
}

function getSuccessMessage(success?: AuthLoginPanelProps["success"]) {
  if (success === "setup-complete") {
    return "Account setup is complete. Sign in with the password you just created.";
  }

  if (success === "password-updated") {
    return "Password updated. Continue with the new credential.";
  }

  return null;
}

export function AuthLoginPanel({
  mode,
  error,
  success,
}: AuthLoginPanelProps) {
  const copy = getPanelCopy(mode);
  const errorMessage =
    error === "invalid"
      ? copy.invalidMessage
      : error === "missing"
        ? copy.missingMessage
        : null;
  const successMessage = getSuccessMessage(success);

  return (
    <section className="panel auth-panel auth-panel--wide">
      <div className="section-heading">
        <h2>{copy.title}</h2>
      </div>
      <p className="notice-copy">{copy.description}</p>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <form action="/api/auth/login" method="post" className="form-grid form-grid--single">
        <input type="hidden" name="mode" value={mode} />

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
          {copy.submitLabel}
        </button>
      </form>
    </section>
  );
}
