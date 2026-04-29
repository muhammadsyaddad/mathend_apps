"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import type { LicenseStatusResponse } from "../lib/license-types";
import styles from "./page.module.css";

type DownloadCatalogItem = {
  platform: "windows" | "macos" | "linux";
  label: string;
  fileName: string;
  downloadPath: string;
  expiresAt: string;
};

type DownloadCatalogResponse = {
  configured: boolean;
  licensed: boolean;
  checkoutUrl: string;
  reason?: string;
  error?: string;
  warning?: string;
  productId?: string;
  buyerEmail?: string;
  licenseKeyPreview?: string;
  activatedAt?: string;
  lastVerifiedAt?: string;
  reverifyDays?: number;
  platforms?: DownloadCatalogItem[];
};

type LicenseStateResponse = LicenseStatusResponse;

const FALLBACK_CHECKOUT_URL = "https://lemonsqueezy.com";

const toLicenseStatus = (
  payload: LicenseStateResponse | DownloadCatalogResponse,
): LicenseStatusResponse => {
  return {
    configured: payload.configured,
    licensed: payload.licensed,
    checkoutUrl: payload.checkoutUrl,
    productId: payload.productId,
    buyerEmail: payload.buyerEmail,
    licenseKeyPreview: payload.licenseKeyPreview,
    activatedAt: payload.activatedAt,
    lastVerifiedAt: payload.lastVerifiedAt,
    reverifyDays: payload.reverifyDays,
    reason: payload.reason,
    error: payload.error,
  };
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

const formatExpiry = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Expires soon";
  }
  return `Expires ${parsed.toLocaleTimeString()}`;
};

export default function DownloadPage() {
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseStatusResponse | null>(null);
  const [catalogStatus, setCatalogStatus] =
    useState<DownloadCatalogResponse | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  // Track whether the component has mounted on the client. We use this to
  // avoid rendering attributes (like `disabled`) differently between the
  // server and the client during hydration which causes React warnings.
  const [isMounted, setIsMounted] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const checkoutUrl =
    licenseStatus?.checkoutUrl?.trim() || FALLBACK_CHECKOUT_URL;

  const loadCatalog = useCallback(async (): Promise<void> => {
    setIsCatalogLoading(true);

    try {
      const response = await fetch("/api/download/catalog", {
        cache: "no-store",
      });
      const payload = (await response.json()) as DownloadCatalogResponse;
      setCatalogStatus(payload);
      setLicenseStatus(toLicenseStatus(payload));

      if (!response.ok) {
        setFormError(payload.error ?? "Failed to load download catalog.");
        return;
      }

      setFormError(null);
    } catch {
      setCatalogStatus({
        configured: true,
        licensed: false,
        checkoutUrl: FALLBACK_CHECKOUT_URL,
        reason: "network_error",
        error: "Failed to load download catalog. Please retry.",
      });
      setFormError("Failed to load download catalog. Please retry.");
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  const loadLicenseStatus = useCallback(async (): Promise<void> => {
    setIsStatusLoading(true);
    setFormError(null);

    try {
      const response = await fetch("/api/license/status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as LicenseStateResponse;
      setLicenseStatus(payload);

      if (!response.ok && payload.error) {
        setFormError(payload.error);
      }

      if (payload.licensed) {
        await loadCatalog();
      } else {
        setCatalogStatus(null);
      }
    } catch {
      setLicenseStatus({
        configured: false,
        licensed: false,
        checkoutUrl: FALLBACK_CHECKOUT_URL,
        reason: "network_error",
        error: "Failed to check license status. Please retry.",
      });
      setCatalogStatus(null);
      setFormError("Failed to check license status. Please retry.");
    } finally {
      setIsStatusLoading(false);
    }
  }, [loadCatalog]);

  useEffect(() => {
    void loadLicenseStatus();
  }, [loadLicenseStatus]);

  // mark mounted so we can safely toggle attributes that would otherwise
  // mismatch between server and client-rendered HTML
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleActivate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsActivating(true);
      setFormError(null);

      try {
        const response = await fetch("/api/license/activate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            licenseKey: licenseKeyInput,
            email: emailInput,
          }),
        });

        const payload = (await response.json()) as LicenseStateResponse;
        setLicenseStatus(payload);
        if (!response.ok) {
          setFormError(payload.error ?? "Failed to activate license.");
          return;
        }

        setLicenseKeyInput("");
        setEmailInput("");
        await loadCatalog();
      } catch {
        setFormError("Failed to activate license. Please retry.");
      } finally {
        setIsActivating(false);
      }
    },
    [emailInput, licenseKeyInput, loadCatalog],
  );

  const handleDeactivate = useCallback(async () => {
    setIsDeactivating(true);
    setFormError(null);

    try {
      const response = await fetch("/api/license/deactivate", {
        method: "POST",
      });

      const payload = (await response.json()) as LicenseStateResponse;
      setLicenseStatus(payload);
      setCatalogStatus(null);
      if (!response.ok) {
        setFormError(payload.error ?? "Failed to clear current session.");
      }
    } catch {
      setFormError("Failed to clear current session.");
    } finally {
      setIsDeactivating(false);
    }
  }, []);

  const refreshButtonLabel = useMemo(() => {
    if (isMounted && (isStatusLoading || isCatalogLoading)) {
      return "Refreshing...";
    }
    return "Refresh";
  }, [isCatalogLoading, isStatusLoading, isMounted]);

  const platformItems = catalogStatus?.platforms ?? [];
  const isLicensed = Boolean(licenseStatus?.licensed);
  const combinedError = formError ?? licenseStatus?.error ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.topBar}>
          <p className={styles.brand}>mathend</p>
          <div className={styles.topLinks}>
            <Link href="/">Back </Link>
            <button
              type="button"
              onClick={() => void loadLicenseStatus()}
              disabled={isMounted && (isStatusLoading || isCatalogLoading)}
            >
              {refreshButtonLabel}
            </button>
          </div>
        </header>

        <section className={styles.hero}>
          <p className={styles.kicker}>desktop download gate</p>
          <h1 className={styles.title}>
            Download Mathend Desktop with license-gated access.
          </h1>
          <p className={styles.description}>
            Strict gate is enabled: only valid Lemon Squeezy buyers can access
            installer links. After install, the desktop app still asks for
            activation again on first open.
          </p>
        </section>

        <section className={styles.card} aria-live="polite">
          <div className={styles.statusLine}>
            <span
              className={`${styles.statusPill} ${
                isLicensed ? styles.statusOk : styles.statusWarn
              }`}
            >
              {isLicensed ? "Licensed" : "Unlicensed"}
            </span>
            {/*<span className={styles.statusPill}>
              {licenseStatus?.configured === false
                ? "License API not configured"
                : "License API ready"}
            </span>*/}
            {isCatalogLoading && (
              <span className={styles.statusPill}>
                Generating secure links...
              </span>
            )}
          </div>

          {combinedError && <p className={styles.error}>{combinedError}</p>}
          {catalogStatus?.warning && (
            <p className={styles.warning}>{catalogStatus.warning}</p>
          )}

          {!isLicensed && (
            <>
              <p className={styles.copy}>
                You need a valid Lemon Squeezy license before download links are
                generated.
              </p>

              <div className={styles.actions}>
                <a
                  className={styles.button}
                  href={checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buy Mathend License
                </a>
                <button
                  type="button"
                  className={styles.buttonGhost}
                  onClick={() => void loadLicenseStatus()}
                  disabled={isStatusLoading}
                >
                  Check Session
                </button>
              </div>

              <form className={styles.form} onSubmit={handleActivate}>
                <label className={styles.field}>
                  <span>License key</span>
                  <input
                    value={licenseKeyInput}
                    onChange={(event) => setLicenseKeyInput(event.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                  />
                </label>

                <label className={styles.field}>
                  <span>Purchase email (optional)</span>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(event) => setEmailInput(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                <button
                  type="submit"
                  className={styles.button}
                  disabled={isActivating || isStatusLoading}
                >
                  {isActivating
                    ? "Activating..."
                    : "Activate and Unlock Download"}
                </button>
              </form>
            </>
          )}

          {isLicensed && (
            <>
              <p className={styles.copy}>
                Secure installer links are short-lived. If they expire, click
                refresh to mint new signed links.
              </p>

              <div className={styles.infoGrid}>
                <article className={styles.infoCard}>
                  <p className={styles.infoLabel}>Buyer</p>
                  <p className={styles.infoValue}>
                    {licenseStatus?.buyerEmail ?? "-"}
                  </p>
                </article>
                <article className={styles.infoCard}>
                  <p className={styles.infoLabel}>License key</p>
                  <p className={styles.infoValue}>
                    {licenseStatus?.licenseKeyPreview ?? "-"}
                  </p>
                </article>
                <article className={styles.infoCard}>
                  <p className={styles.infoLabel}>Last verified</p>
                  <p className={styles.infoValue}>
                    {formatDateTime(licenseStatus?.lastVerifiedAt)}
                  </p>
                </article>
              </div>

              {platformItems.length > 0 ? (
                <div className={styles.downloadGrid}>
                  {platformItems.map((item) => (
                    <article
                      className={styles.downloadItem}
                      key={item.platform}
                    >
                      <p className={styles.downloadLabel}>{item.label}</p>
                      <p className={styles.downloadMeta}>{item.fileName}</p>
                      <p className={styles.downloadMeta}>
                        {formatExpiry(item.expiresAt)}
                      </p>
                      <a
                        className={styles.downloadButton}
                        href={item.downloadPath}
                      >
                        Download
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.hint}>
                  No installer is available yet. Configure
                  `WEB_DOWNLOAD_WINDOWS_URL`, `WEB_DOWNLOAD_MACOS_URL`, and
                  `WEB_DOWNLOAD_LINUX_URL` on the deployed web app.
                </p>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.buttonGhost}
                  onClick={() => void loadCatalog()}
                  disabled={isCatalogLoading}
                >
                  {isCatalogLoading
                    ? "Refreshing links..."
                    : "Refresh secure links"}
                </button>
                <button
                  type="button"
                  className={styles.buttonGhost}
                  onClick={() => void handleDeactivate()}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? "Clearing..." : "Clear session"}
                </button>
              </div>

              <p className={styles.hint}>
                Note: desktop app still enforces in-app activation after install
                as a second license gate.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
