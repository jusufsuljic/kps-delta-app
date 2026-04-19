import Link from "next/link";

import { formatDateTime } from "@/lib/format";

type ProfileAccountPanelProps = {
  username: string;
  role: string;
  joinedAt: Date;
  passwordUpdatedAt: Date | null;
};

export function ProfileAccountPanel({
  username,
  role,
  joinedAt,
  passwordUpdatedAt,
}: ProfileAccountPanelProps) {
  const requestResetHref = `/change-password?mode=request-reset&username=${encodeURIComponent(username)}`;

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
            If you lose access, request a reset. The admin dashboard or future auth backend can
            issue a reset or setup link from there.
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
