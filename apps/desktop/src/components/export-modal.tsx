"use client";

import { useEffect, useState } from "react";

export type ExportFormat = "pdf" | "png";

type ExportModalProps = {
  isOpen: boolean;
  initialFormat?: ExportFormat;
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
};

export function ExportModal({
  isOpen,
  initialFormat = "pdf",
  onClose,
  onExport,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] =
    useState<ExportFormat>(initialFormat);
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
    if (isOpen) {
      setSelectedFormat(initialFormat);
    }
  }, [isOpen, initialFormat]);

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
          ? "modal-overlay modal-overlay-exit"
          : "modal-overlay modal-overlay-enter"
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <div className="modal-backdrop" onClick={onClose} aria-hidden />
      <div
        className={
          isClosing
            ? "export-modal export-modal-exit"
            : "export-modal export-modal-enter"
        }
        onClick={(event) => event.stopPropagation()}
      >
        <header className="export-header">
          <h3 id="export-title" className="export-title">
            Ekspor Catatan
          </h3>
          <button
            type="button"
            className="export-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            ×
          </button>
        </header>

        <div className="export-body">
          <div
            className="export-grid"
            role="radiogroup"
            aria-label="Pilih format ekspor"
          >
            <label
              className={
                selectedFormat === "pdf"
                  ? "export-option export-option-active"
                  : "export-option"
              }
            >
              <input
                className="export-input"
                type="radio"
                name="export-format"
                value="pdf"
                checked={selectedFormat === "pdf"}
                onChange={() => setSelectedFormat("pdf")}
              />
              <span className="export-icon" aria-hidden>
                PDF
              </span>
              <span className="export-name">PDF Document</span>
              <span className="export-help">Sempurna untuk dicetak</span>
              <span className="export-check" aria-hidden>
                ✓
              </span>
            </label>

            <label
              className={
                selectedFormat === "png"
                  ? "export-option export-option-active"
                  : "export-option"
              }
            >
              <input
                className="export-input"
                type="radio"
                name="export-format"
                value="png"
                checked={selectedFormat === "png"}
                onChange={() => setSelectedFormat("png")}
              />
              <span className="export-icon" aria-hidden>
                PNG
              </span>
              <span className="export-name">PNG Image</span>
              <span className="export-help">Baik untuk dibagikan</span>
              <span className="export-check" aria-hidden>
                ✓
              </span>
            </label>
          </div>
        </div>

        <footer className="export-footer">
          <button
            type="button"
            className="export-submit"
            onClick={() => onExport(selectedFormat)}
          >
            Ekspor
          </button>
          <button type="button" className="export-cancel" onClick={onClose}>
            Batal
          </button>
        </footer>
      </div>
    </div>
  );
}
