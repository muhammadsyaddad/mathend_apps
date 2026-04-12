"use client";

import { useEffect, useState } from "react";
import type { LicenseStatusResponse } from "../lib/license-types";

type LicenseGateProps = {
  status: LicenseStatusResponse | null;
  isLoading: boolean;
  isActivating: boolean;
  activateError: string | null;
  onActivate: (params: { licenseKey: string; email: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
};

export default function LicenseGate({
  status,
  isLoading,
  isActivating,
  activateError,
  onActivate,
  onRefresh,
}: LicenseGateProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const checkoutUrl =
    status?.checkoutUrl?.trim() || "https://muhamsyad.gumroad.com/l/mathend";
  const controlsDisabled = hasHydrated ? isLoading || isActivating : false;

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return (
    <main className="license-gate-shell">
      <section className="license-gate-card" aria-live="polite">
        <p className="license-gate-kicker">Mathend Desktop License</p>
        <h1 className="license-gate-title">Activate your lifetime access</h1>
        <p className="license-gate-copy">
          Mathend Desktop verifies your Gumroad license before opening the
          workspace.
        </p>

        <div className="license-gate-actions">
          <a
            className="license-gate-buy"
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer"
          >
            Buy Mathend License
          </a>
          <button
            type="button"
            className="license-gate-refresh"
            onClick={() => void onRefresh()}
            disabled={controlsDisabled}
          >
            Refresh Status
          </button>
        </div>

        <form
          className="license-gate-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onActivate({ licenseKey, email });
          }}
        >
          <label className="license-gate-field">
            <span>License key</span>
            <input
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
            />
          </label>

          <label className="license-gate-field">
            <span>Purchase email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <button
            type="submit"
            className="license-gate-submit"
            disabled={controlsDisabled}
          >
            {isActivating ? "Activating..." : "Activate License"}
          </button>
        </form>

        {status?.error && <p className="license-gate-error">{status.error}</p>}
        {activateError && <p className="license-gate-error">{activateError}</p>}

        {status?.reason && !status.licensed && (
          <p className="license-gate-hint">Status: {status.reason}</p>
        )}
      </section>
    </main>
  );
}
