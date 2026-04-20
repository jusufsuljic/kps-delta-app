import Link from "next/link";

import { formatDateTime } from "@/lib/format";

type ProfileAccountPanelProps = {
  username: string;
  email: string | null;
  role: string;
  joinedAt: Date;
  passwordUpdatedAt: Date | null;
};

export function ProfileAccountPanel({
  username,
  email,
  role,
  joinedAt,
  passwordUpdatedAt,
}: ProfileAccountPanelProps) {
  const requestResetHref = `/change-password?mode=request-reset${
    email ? `&email=${encodeURIComponent(email)}` : ""
  }`;

  return (
    <section className="panel profile-section">
      <div className="panel-header">
        <div>
          <p className="section-eyebrow">ACCOUNT</p>
          <h2>Access & Recovery</h2>
        </div>
        <span
          className="status-badge status-badge--ok"
        >
          ACTIVE ACCESS
        </span>
      </div>

      <div className="account-readonly-grid">
        <div className="readonly-field">
          <span className="field__label">Username</span>
          <div className="readonly-field__value">{username}</div>
        </div>
        <div className="readonly-field">
          <span className="field__label">Role</span>
          <div className="readonly-field__value">{role}</div>
        </div>
        <div className="readonly-field">
          <span className="field__label">Email</span>
          <div className="readonly-field__value">{email ?? "Not set"}</div>
        </div>
        <div className="readonly-field">
          <span className="field__label">Joined</span>
          <div className="readonly-field__value">{formatDateTime(joinedAt)}</div>
        </div>
        <div className="readonly-field">
          <span className="field__label">Password Updated</span>
          <div className="readonly-field__value">{formatDateTime(passwordUpdatedAt)}</div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--balanced">
        <article className="subpanel">
          <div className="panel-header">
            <h3>Password</h3>
          </div>
          <p className="notice-copy">
            Rotate your password when you still know the current one. This uses the unified auth
            password-change surface.
          </p>
          <div className="button-row">
            <Link href="/change-password?mode=authenticated" className="button button--primary">
              CHANGE PASSWORD
            </Link>
          </div>
        </article>

        <article className="subpanel">
          <div className="panel-header">
            <h3>Recovery</h3>
          </div>
          <p className="notice-copy">
            If you lose access, request a reset. An admin can approve the request and share a
            one-time reset code with you offline.
          </p>
          <div className="button-row">
            <Link href={requestResetHref} className="button button--ghost">
              REQUEST RESET
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
