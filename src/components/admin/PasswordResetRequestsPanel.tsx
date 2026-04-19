"use client";

import { useState } from "react";

type PasswordResetRequestItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  createdAt: string;
  reviewedAt: string | null;
  completedAt: string | null;
  reviewerNote: string | null;
  user: {
    id: string;
    username: string;
    role: "ADMIN" | "SHOOTER";
  };
  reviewedBy: {
    id: string;
    username: string;
  } | null;
  setupCode: {
    id: string;
    codeSuffix: string;
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
  } | null;
};

type LastApprovedState = {
  username: string;
  code: string;
  expiresAt: string;
};

type PasswordResetRequestsPanelProps = {
  requests: PasswordResetRequestItem[];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PasswordResetRequestsPanel({
  requests,
}: PasswordResetRequestsPanelProps) {
  const [rows, setRows] = useState(requests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastApproved, setLastApproved] = useState<LastApprovedState | null>(null);

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    setPendingId(requestId);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("action", action);
      if (action === "approve") {
        formData.set("expiresInHours", "24");
      }

      const response = await fetch(`/api/auth/password-reset-requests/${requestId}`, {
        method: "PATCH",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Unable to review the password reset request.");
        return;
      }

      if (action === "approve" && payload?.setupCode?.code) {
        const requestUser = rows.find((row) => row.id === requestId)?.user.username ?? "User";
        setLastApproved({
          username: requestUser,
          code: payload.setupCode.code,
          expiresAt: payload.setupCode.expiresAt,
        });
      }

      setRows((currentRows) =>
        currentRows.map((row) => {
          if (row.id !== requestId) {
            return row;
          }

          return {
            ...row,
            status: action === "approve" ? "APPROVED" : "REJECTED",
            reviewedAt: new Date().toISOString(),
            setupCode:
              action === "approve" && payload?.setupCode
                ? {
                    id: payload.setupCode.id,
                    codeSuffix: payload.setupCode.codeSuffix,
                    createdAt: payload.setupCode.createdAt,
                    expiresAt: payload.setupCode.expiresAt,
                    usedAt: payload.setupCode.usedAt ?? null,
                    revokedAt: payload.setupCode.revokedAt ?? null,
                  }
                : row.setupCode,
          };
        }),
      );
    } catch {
      setError("Unable to review the password reset request.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Copy failed. Copy the value manually.");
    }
  }

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h2>Password Reset Queue</h2>
        </div>
        <span className="panel-note">{`${rows.length} total`}</span>
      </div>

      <p className="notice-copy">
        Users can request a reset without exposing whether the username exists. Approving a request
        issues a one-time reset code that the user can log in with, then they are forced to change
        the password immediately.
      </p>

      {error ? <p className="error-banner">{error}</p> : null}

      {lastApproved ? (
        <div className="success-banner">
          <strong>{`${lastApproved.username}: `}</strong>
          <span>{lastApproved.code}</span>
          <span>{` (expires ${formatDateTime(lastApproved.expiresAt)})`}</span>
          <div className="button-row">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => handleCopy(lastApproved.code)}
            >
              COPY RESET CODE
            </button>
          </div>
        </div>
      ) : null}

      <div className="entity-list entity-list--scroll">
        {rows.length > 0 ? (
          rows.map((request) => (
            <div key={request.id} className="entity-card">
              <div className="entity-meta entity-meta--stack">
                <div className="entity-badge-row">
                  <span className="status-badge status-badge--neutral">{request.user.role}</span>
                  <span
                    className={`status-badge ${
                      request.status === "PENDING"
                        ? "status-badge--warn"
                        : request.status === "APPROVED"
                          ? "status-badge--ok"
                          : "status-badge--neutral"
                    }`}
                  >
                    {request.status}
                  </span>
                </div>
                <strong>{request.user.username}</strong>
                <span>{`Requested ${formatDateTime(request.createdAt)}`}</span>
                {request.setupCode ? (
                  <span>{`Code suffix ${request.setupCode.codeSuffix} • expires ${formatDateTime(
                    request.setupCode.expiresAt,
                  )}`}</span>
                ) : null}
                {request.reviewedBy ? (
                  <span>{`Reviewed by ${request.reviewedBy.username} on ${formatDateTime(
                    request.reviewedAt,
                  )}`}</span>
                ) : null}
              </div>

              {request.status === "PENDING" ? (
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => reviewRequest(request.id, "approve")}
                    disabled={pendingId === request.id}
                  >
                    {pendingId === request.id ? "WORKING..." : "APPROVE"}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => reviewRequest(request.id, "reject")}
                    disabled={pendingId === request.id}
                  >
                    REJECT
                  </button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="empty-state">No password reset requests have been submitted yet.</div>
        )}
      </div>
    </article>
  );
}
