type AuthLoginMode = "shooter" | "admin";

type AuthLoginPanelProps = {
  mode: AuthLoginMode;
  error?: "invalid" | "missing" | "pending" | "rejected";
  success?: "registration-submitted" | "password-updated";
};

function getPanelCopy(mode: AuthLoginMode) {
  if (mode === "admin") {
    return {
      title: "Admin Login",
      description: "Use an admin account to access the dashboard.",
      identifierLabel: "Email or Username",
      identifierAutoComplete: "username",
      submitLabel: "SIGN IN",
      invalidMessage: "That account does not have dashboard access or the password is incorrect.",
      missingMessage: "Your session is no longer valid. Sign in again.",
    };
  }

  return {
    title: "Login",
    description: "Enter your email and password.",
    identifierLabel: "Email",
    identifierAutoComplete: "email",
    submitLabel: "SIGN IN",
    invalidMessage: "Invalid email or password.",
    missingMessage: "Your session is no longer valid. Sign in again.",
  };
}

function getSuccessMessage(success?: AuthLoginPanelProps["success"]) {
  if (success === "registration-submitted") {
    return "Your application will be reviewed soon.";
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
        : error === "pending"
          ? "Your application will be reviewed soon."
          : error === "rejected"
            ? "Please contact Delta administrator."
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
          <span className="field__label">{copy.identifierLabel}</span>
          <input
            className="text-input"
            name="identifier"
            type="text"
            autoComplete={copy.identifierAutoComplete}
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
