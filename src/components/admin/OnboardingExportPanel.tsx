"use client";

import { useState } from "react";

type OnboardingExportPanelProps = {
  pendingShooterCount: number;
};

function readFilename(response: Response) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="(.+?)"/);
  return match?.[1] ?? "delta-onboarding.csv";
}

export function OnboardingExportPanel({
  pendingShooterCount,
}: OnboardingExportPanelProps) {
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("scope", "setup-pending-shooters");
      formData.set("expiresInHours", expiresInHours);

      const response = await fetch("/api/auth/setup-codes/export", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Unable to export onboarding codes.");
        return;
      }

      const csv = await response.text();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = readFilename(response);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      setSuccess(
        `Exported onboarding codes for ${pendingShooterCount} setup-pending shooter accounts.`,
      );
    } catch {
      setError("Unable to export onboarding codes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h2>Onboarding Export</h2>
        </div>
        <span className="panel-note">{`${pendingShooterCount} pending`}</span>
      </div>

      <p className="notice-copy">
        Generate a CSV of onboarding links for shooter accounts that still do not have a password.
        Reissuing export codes revokes any still-active onboarding codes for those same users.
      </p>

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
          onClick={handleExport}
          disabled={pending || pendingShooterCount === 0}
        >
          {pending ? "EXPORTING..." : "EXPORT ONBOARDING CSV"}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {success ? <p className="success-banner">{success}</p> : null}
    </article>
  );
}
