type RegisterPanelProps = {
  error?: "missing" | "mismatch" | "weak" | "invalid-email" | "exists";
  success?: "submitted";
};

function getRegisterErrorMessage(error?: RegisterPanelProps["error"]) {
  switch (error) {
    case "missing":
      return "Fill in all required fields and try again.";
    case "mismatch":
      return "The password confirmation did not match.";
    case "weak":
      return "Choose a stronger password with at least 8 characters.";
    case "invalid-email":
      return "Email format is invalid.";
    case "exists":
      return "An account with this email already exists. Log in with your email and password.";
    default:
      return null;
  }
}

function getRegisterSuccessMessage(success?: RegisterPanelProps["success"]) {
  if (success === "submitted") {
    return "Your application will be reviewed soon.";
  }

  return null;
}

export function RegisterPanel({ error, success }: RegisterPanelProps) {
  const errorMessage = getRegisterErrorMessage(error);
  const successMessage = getRegisterSuccessMessage(success);

  return (
    <section className="panel auth-panel auth-panel--wide">
      <div className="section-heading">
        <h2>Register</h2>
      </div>
      <p className="notice-copy">
        Submit your information for review. Once approved, you can log in with your email and password.
      </p>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <form action="/api/auth/register" method="post" className="form-grid form-grid--single">
        <label className="field">
          <span className="field__label">First Name</span>
          <input className="text-input" name="firstName" type="text" autoComplete="given-name" required />
        </label>

        <label className="field">
          <span className="field__label">Last Name</span>
          <input className="text-input" name="lastName" type="text" autoComplete="family-name" required />
        </label>

        <label className="field">
          <span className="field__label">Email</span>
          <input className="text-input" name="email" type="email" autoComplete="email" required />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="text-input"
            name="password"
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
          SUBMIT APPLICATION
        </button>
      </form>
    </section>
  );
}
