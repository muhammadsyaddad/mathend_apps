"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { LicenseStatusResponse } from "../../lib/license-types";

type AccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseStatusResponse | null>(null);
  const [isLoadingLicense, setIsLoadingLicense] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  const loadLicenseStatus = useCallback(async () => {
    setIsLoadingLicense(true);
    setLicenseError(null);

    try {
      const response = await fetch("/api/license/status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as LicenseStatusResponse;
      setLicenseStatus(payload);

      if (!response.ok && payload.error) {
        setLicenseError(payload.error);
      }
    } catch {
      setLicenseError("Failed to load license status.");
    } finally {
      setIsLoadingLicense(false);
    }
  }, []);

  const handleDeactivate = useCallback(async () => {
    setIsDeactivating(true);
    setLicenseError(null);

    try {
      const response = await fetch("/api/license/deactivate", {
        method: "POST",
      });
      const payload = (await response.json()) as LicenseStatusResponse;
      setLicenseStatus(payload);
      if (response.ok) {
        window.location.reload();
        return;
      }
      if (!response.ok && payload.error) {
        setLicenseError(payload.error);
      }
    } catch {
      setLicenseError("Failed to deactivate this browser session.");
    } finally {
      setIsDeactivating(false);
    }
  }, []);

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

    void loadLicenseStatus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, loadLicenseStatus, onClose]);

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
          Manage profile details and workspace access for this project.
        </p>

        <div className="settings-list">
          <div className="settings-row">
            <span className="settings-label">Signed in as</span>
            <span className="settings-value">
              {licenseStatus?.buyerEmail ?? "license required"}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Role</span>
            <span className="settings-value">Owner</span>
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

        {licenseError && <p className="agent-inline-error">{licenseError}</p>}

        {licenseStatus?.licensed && (
          <button
            type="button"
            className="settings-dismiss settings-dismiss-danger"
            onClick={() => void handleDeactivate()}
            disabled={isDeactivating}
          >
            {isDeactivating ? "Deactivating..." : "Deactivate this browser"}
          </button>
        )}

        <button type="button" onClick={onClose} className="settings-dismiss">
          Back to Notes
        </button>
      </section>
    </div>
  );
}
