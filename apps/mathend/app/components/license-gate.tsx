"use client";

import { type FormEvent, useCallback, useState } from "react";
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
  const checkoutUrl = status?.checkoutUrl?.trim() || "https://lemonsqueezy.com";
  const controlsDisabled = isLoading || isActivating;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void onActivate({ licenseKey, email });
    },
    [licenseKey, email, onActivate],
  );

  return (
    <main className="license-gate-shell">
      <div className="license-gate-container">
        <header className="license-gate-header">
          <p className="license-gate-brand">mathend</p>
          <div className="license-gate-topLinks">
            <button
              type="button"
              className="license-gate-refreshBtn"
              onClick={() => void onRefresh()}
              disabled={controlsDisabled}
            >
              {isLoading ? "Checking..." : "Refresh"}
            </button>
          </div>
        </header>

        <div className="license-gate-content" aria-live="polite">
          <section className="license-gate-hero">
            <p className="license-gate-kicker">activation</p>
            <h1 className="license-gate-title">Unlock Mathend Studio.</h1>
            <p className="license-gate-subhead">
              Enter your license key to access the workspace. Or purchase a new
              license.
            </p>
          </section>

          <section className="license-gate-formSection">
            <div className="license-gate-formCard">
              {(status?.error || activateError) && (
                <p className="license-gate-error">
                  {status?.error || activateError}
                </p>
              )}

              <form className="license-gate-form" onSubmit={handleSubmit}>
                <div className="license-gate-formRow">
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(event) => setLicenseKey(event.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="license-gate-input"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="license-gate-submit"
                    disabled={controlsDisabled}
                  >
                    {isActivating ? "Activating..." : "Activate"}
                  </button>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Purchase email (optional)"
                  className="license-gate-input"
                  autoComplete="email"
                />
              </form>

              <div className="license-gate-purchaseRow">
                <a
                  className="license-gate-purchaseLink"
                  href={checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buy new license
                </a>
              </div>
            </div>
          </section>
        </div>

        <footer className="license-gate-footer">
          <p className="license-gate-footerBrand">Mathend Studio</p>
          <p className="license-gate-footerCopy">
            &copy; 2026. Restrained simplicity.
          </p>
        </footer>
      </div>
    </main>
  );
}
