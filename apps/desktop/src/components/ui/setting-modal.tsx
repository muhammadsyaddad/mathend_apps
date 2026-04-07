"use client";
import { useState, useEffect } from "react";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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
      aria-labelledby="settings-title"
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
          <h3 id="settings-title" className="settings-title">
            Settings
          </h3>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <p className="settings-subtitle">
          Tweak your editor preferences without leaving this page.
        </p>

        <div className="settings-list">
          <div className="settings-row">
            <span className="settings-label">Auto-save notes</span>
            <span className="settings-value">On (Local SQLite)</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Math command popover</span>
            <span className="settings-value">On</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Sidebar mode</span>
            <span className="settings-value">Remember last state</span>
          </div>
        </div>

        <button type="button" onClick={onClose} className="settings-dismiss">
          Back to Notes
        </button>
      </section>
    </div>
  );
}
