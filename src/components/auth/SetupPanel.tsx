type SetupPanelProps = {
  code?: string;
  username?: string;
  role?: string;
  expires?: string;
  error?: string;
  success?: string;
};

function getSetupErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Open the setup page from a valid setup link and complete all required fields.";
    case "expired":
      return "This setup link has expired. Ask for a new one from the admin dashboard.";
    case "used":
      return "This setup link has already been used.";
    case "mismatch":
      return "The password confirmation did not match.";
    case "weak":
      return "Choose a stronger password with at least 8 characters.";
    case "invalid":
      return "That setup code was not recognized.";
    default:
      return null;
  }
}

function getSetupSuccessMessage(success?: string) {
  if (success === "complete") {
    return "Setup complete. Continue to the unified login screen to sign in.";
  }

  return null;
}

export function SetupPanel({
  code,
  username,
  role,
  expires,
  error,
  success,
}: SetupPanelProps) {
  const errorMessage = getSetupErrorMessage(error);
  const successMessage = getSetupSuccessMessage(success);

  if (!code && !successMessage) {
    return (
      <section className="panel auth-panel auth-panel--wide">
        <div className="section-heading">
          <p className="section-eyebrow">ONBOARDING</p>
          <h2>Setup Link Required</h2>
        </div>
        <p className="notice-copy">
          Open this page from an onboarding link that includes a valid setup code.
        </p>
        <p className="error-banner">
          No setup code was provided, so the onboarding flow cannot continue.
        </p>
      </section>
    );
  }

  return (
    <section className="panel auth-panel auth-panel--wide">
      <div className="section-heading">
        <p className="section-eyebrow">ONBOARDING</p>
        <h2>Complete Account Setup</h2>
      </div>
      <p className="notice-copy">
        Use the setup code issued by the admin dashboard to create the first working password for
        this account.
      </p>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <div className="account-readonly-grid">
        {username ? (
          <div className="readonly-field">
            <span className="field__label">Username</span>
            <div className="readonly-field__value">{username}</div>
          </div>
        ) : null}
        {role ? (
          <div className="readonly-field">
            <span className="field__label">Role</span>
            <div className="readonly-field__value">{role}</div>
          </div>
        ) : null}
        {expires ? (
          <div className="readonly-field">
            <span className="field__label">Expires</span>
            <div className="readonly-field__value">{expires}</div>
          </div>
        ) : null}
      </div>

      {code ? (
        <form action="/api/auth/setup" method="post" className="form-grid form-grid--single">
          <input type="hidden" name="code" value={code} />
          {username ? <input type="hidden" name="username" value={username} /> : null}

          <label className="field">
            <span className="field__label">New Password</span>
            <input
              className="text-input"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Confirm Password</span>
            <input
              className="text-input"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>

          <button type="submit" className="button button--primary">
            COMPLETE SETUP
          </button>
        </form>
      ) : null}
    </section>
  );
}
