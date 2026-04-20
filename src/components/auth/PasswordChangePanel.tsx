type PasswordChangeMode = "authenticated" | "forced" | "request-reset";

type PasswordChangePanelProps = {
  mode: PasswordChangeMode;
  email?: string;
  error?: string;
  success?: string;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "expired":
      return "That reset code has expired. Request a new password reset.";
    case "weak":
      return "Choose a stronger password with at least 8 characters.";
    case "mismatch":
      return "The password confirmation did not match.";
    case "missing":
      return "Fill in the required password fields and try again.";
    case "invalid":
      return "The current password or auth token was not accepted.";
    case "required":
      return "A password change is required before you can continue.";
    default:
      return null;
  }
}

function getSuccessMessage(success?: string) {
  switch (success) {
    case "requested":
      return "Reset request recorded. An admin can now issue a one-time reset code for this account.";
    case "updated":
      return "Password updated. Sign in again with the new credential.";
    default:
      return null;
  }
}

export function PasswordChangePanel({
  mode,
  email,
  error,
  success,
}: PasswordChangePanelProps) {
  const isResetRequest = mode === "request-reset";
  const isForcedChange = mode === "forced";
  const actionPath = isResetRequest ? "/api/auth/request-reset" : "/api/auth/change-password";
  const title = isResetRequest
    ? "Request Reset"
    : isForcedChange
      ? "Change Password"
      : "Update Password";
  const description = isResetRequest
    ? "Request a password reset when you no longer have a working credential."
    : isForcedChange
      ? "A password rotation has been required for this account. Set a new password before you continue."
      : "Use your current password to rotate to a new credential. If you no longer have access, request a reset instead.";
  const submitLabel = isResetRequest
    ? "REQUEST RESET"
    : "UPDATE PASSWORD";
  const errorMessage = getErrorMessage(error);
  const successMessage = getSuccessMessage(success);

  return (
    <section className="panel auth-panel auth-panel--wide">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <p className="notice-copy">{description}</p>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      {email && !isResetRequest ? (
        <div className="readonly-field">
          <span className="field__label">Account</span>
          <div className="readonly-field__value">{email}</div>
        </div>
      ) : null}

      <form action={actionPath} method="post" className="form-grid form-grid--single">
        <input type="hidden" name="mode" value={mode} />
        {email && !isResetRequest ? (
          <input type="hidden" name="username" value={email} />
        ) : null}

        {isResetRequest ? (
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="text-input"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              required
            />
          </label>
        ) : null}

        {!isResetRequest && !isForcedChange ? (
          <label className="field">
            <span className="field__label">Current Password</span>
            <input
              className="text-input"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        ) : null}

        {!isResetRequest ? (
          <>
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
              <span className="field__label">Confirm New Password</span>
              <input
                className="text-input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          </>
        ) : null}

        <button type="submit" className="button button--primary">
          {submitLabel}
        </button>
      </form>
    </section>
  );
}
