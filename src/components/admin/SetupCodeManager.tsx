"use client";

import { useState } from "react";

type ActiveSetupCode = {
  codeSuffix: string;
  createdAt: string;
  expiresAt: string;
};

type SetupCodeManagerProps = {
  userId: string;
  username: string;
  activeSetupCode?: ActiveSetupCode | null;
};

type IssuedSetupCodeState = {
  code: string;
  expiresAt: string;
  setupUrl: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildSetupUrl(username: string, code: string) {
  if (typeof window === "undefined") {
    return `/setup?username=${encodeURIComponent(username)}&code=${encodeURIComponent(code)}`;
  }

  const url = new URL("/setup", window.location.origin);
  url.searchParams.set("username", username);
  url.searchParams.set("code", code);
  return url.toString();
}

function toAbsoluteUrl(value: string) {
  if (typeof window === "undefined") {
    return value;
  }

  return new URL(value, window.location.origin).toString();
}

export function SetupCodeManager({
  userId,
  username,
  activeSetupCode = null,
}: SetupCodeManagerProps) {
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedSetupCodeState | null>(null);
  const [currentCode, setCurrentCode] = useState(activeSetupCode);

  async function handleIssue() {
    setPending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("purpose", "ONBOARDING");
      formData.set("expiresInHours", expiresInHours);

      const response = await fetch("/api/auth/setup-codes", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.setupCode?.code) {
        setError(payload?.error ?? "Unable to issue a setup code.");
        return;
      }

      setIssued({
        code: payload.setupCode.code,
        expiresAt: payload.setupCode.expiresAt,
        setupUrl:
          typeof payload.setupHref === "string" && payload.setupHref
            ? toAbsoluteUrl(payload.setupHref)
            : buildSetupUrl(username, payload.setupCode.code),
      });
      setCurrentCode({
        codeSuffix: payload.setupCode.codeSuffix,
        createdAt: payload.setupCode.createdAt,
        expiresAt: payload.setupCode.expiresAt,
      });
    } catch {
      setError("Unable to issue a setup code.");
    } finally {
      setPending(false);
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
    <div className="subpanel">
      <div className="panel-header">
        <div>
          <p className="section-eyebrow">ONBOARDING</p>
          <h3>Setup Code</h3>
        </div>
        <span className="panel-note">One-time link</span>
      </div>

      {currentCode ? (
        <div className="entity-card">
          <div className="entity-meta entity-meta--stack">
            <strong>Active setup code</strong>
            <span>{`Ends with ${currentCode.codeSuffix}`}</span>
            <span>{`Issued ${formatDateTime(currentCode.createdAt)}`}</span>
            <span>{`Expires ${formatDateTime(currentCode.expiresAt)}`}</span>
          </div>
        </div>
      ) : (
        <p className="panel-note">No active onboarding code is currently issued.</p>
      )}

      <label className="field">
        <span className="field__label">Expiry Window</span>
        <select
          className="text-input"
          value={expiresInHours}
          onChange={(event) => setExpiresInHours(event.target.value)}
        >
          <option value="48">48 hours</option>
          <option value="72">72 hours</option>
          <option value="168">7 days</option>
        </select>
      </label>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          onClick={handleIssue}
          disabled={pending}
        >
          {pending ? "ISSUING..." : "ISSUE SETUP CODE"}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {issued ? (
        <div className="entity-list">
          <div className="entity-card">
            <div className="entity-meta entity-meta--stack">
              <strong>Plaintext code</strong>
              <span>{issued.code}</span>
              <span>{`Expires ${formatDateTime(issued.expiresAt)}`}</span>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => handleCopy(issued.code)}
              >
                COPY CODE
              </button>
            </div>
          </div>

          <div className="entity-card">
            <label className="field">
              <span className="field__label">Setup Link</span>
              <input className="text-input text-input--readonly" readOnly value={issued.setupUrl} />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => handleCopy(issued.setupUrl)}
              >
                COPY LINK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
