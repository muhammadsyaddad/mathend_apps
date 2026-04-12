"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { LicenseStatusResponse } from "../../lib/license-types";

type AccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
  licenseStatus: LicenseStatusResponse | null;
  isLoadingLicense: boolean;
  onRefreshLicenseStatus: () => Promise<void>;
  onDeactivateLicense: () => Promise<void>;
};

export default function AccountModal({
  isOpen,
  onClose,
  licenseStatus,
  isLoadingLicense,
  onRefreshLicenseStatus,
  onDeactivateLicense,
}: AccountModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) {
      return;
    }

    setIsClosing(true);
    const timeout = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLicenseError(null);

    void onRefreshLicenseStatus().catch(() => {
      setLicenseError("Failed to load desktop license status.");
    });

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, onRefreshLicenseStatus]);

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    setLicenseError(null);

    try {
      await onDeactivateLicense();
    } catch {
      setLicenseError("Failed to deactivate this desktop license session.");
    } finally {
      setIsDeactivating(false);
    }
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={
        isClosing
          ? "settings-modal-overlay settings-modal-overlay-exit"
          : "settings-modal-overlay settings-modal-overlay-enter"
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
    >
      <div className="settings-modal-backdrop" onClick={onClose} aria-hidden />
      <section
        className={
          isClosing
            ? "settings-panel settings-panel-exit"
            : "settings-panel settings-panel-enter"
        }
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-head">
          <h3 id="account-title" className="settings-title">
            Account
          </h3>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close account"
          >
            ×
          </button>
        </header>

        <p className="settings-subtitle">
          Manage this desktop license session.
        </p>

        <div className="settings-list">
          <div className="settings-row">
            <span className="settings-label">Licensed email</span>
            <span className="settings-value">
              {licenseStatus?.buyerEmail ?? "license required"}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Product</span>
            <span className="settings-value">
              {licenseStatus?.productId ?? "not configured"}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Plan</span>
            <span className="settings-value">
              {licenseStatus?.licensed ? "Lifetime" : "Unlicensed"}
            </span>
          </div>
          <div className="settings-row settings-row-stack">
            <span className="settings-label">License key</span>
            <span className="settings-value">
              {licenseStatus?.licenseKeyPreview ?? "not activated"}
            </span>
            {licenseStatus?.lastVerifiedAt && (
              <span className="settings-muted-text">
                Verified{" "}
                {new Date(licenseStatus.lastVerifiedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {isLoadingLicense && (
          <p className="settings-subtitle">
            <Loader2 size={14} className="spin" aria-hidden /> Loading
            license...
          </p>
        )}

        {licenseStatus?.error && (
          <p className="agent-inline-error">{licenseStatus.error}</p>
        )}
        {licenseError && <p className="agent-inline-error">{licenseError}</p>}

        {licenseStatus?.licensed && (
          <button
            type="button"
            className="settings-dismiss settings-dismiss-danger"
            onClick={() => void handleDeactivate()}
            disabled={isDeactivating}
          >
            {isDeactivating ? "Deactivating..." : "Deactivate this desktop"}
          </button>
        )}

        <button
          type="button"
          onClick={() => void onRefreshLicenseStatus()}
          className="settings-dismiss"
          disabled={isLoadingLicense}
        >
          Refresh License Status
        </button>

        <button type="button" onClick={onClose} className="settings-dismiss">
          Back to Notes
        </button>
      </section>
    </div>
  );
}
