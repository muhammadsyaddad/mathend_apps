"use client";

import { useEffect, useState } from "react";

type AccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

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
            <span className="settings-value">syaddad@mathend.dev</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Role</span>
            <span className="settings-value">Owner</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Plan</span>
            <span className="settings-value">Pro Workspace</span>
          </div>
        </div>

        <button type="button" onClick={onClose} className="settings-dismiss">
          Back to Notes
        </button>
      </section>
    </div>
  );
}
