"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
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
            license_key: licenseKeyInput,
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

  const platformItems = catalogStatus?.platforms ?? [];
  const isLicensed = Boolean(licenseStatus?.licensed);
  const combinedError = formError ?? licenseStatus?.error ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.topBar}>
          <p className={styles.brand}>mathend</p>
          <div className={styles.topLinks}>
            <Link href="/">{"Back"}</Link>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.hero}>
            <p className={styles.kicker}>download</p>
            <h1 className={styles.headline}>Get Mathend Studio.</h1>
            <p className={styles.subhead}>
              One purchase, yours forever. No subscriptions.
            </p>
          </section>

          {!isLicensed && (
            <section className={styles.unlicensed}>
              <div className={styles.unlicensedContent}>
                <h2 className={styles.unlicensedTitle}>Activate license</h2>
                <p className={styles.unlicensedText}>
                  Enter your license key to unlock downloads. Or purchase a new
                  license.
                </p>

                {combinedError && (
                  <p className={styles.error}>{combinedError}</p>
                )}

                <form className={styles.form} onSubmit={handleActivate}>
                  <div className={styles.formRow}>
                    <input
                      type="text"
                      value={licenseKeyInput}
                      onChange={(event) =>
                        setLicenseKeyInput(event.target.value)
                      }
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className={styles.input}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className={styles.button}
                      disabled={isActivating || isStatusLoading}
                    >
                      {isActivating ? "Activating..." : "Activate"}
                    </button>
                  </div>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(event) => setEmailInput(event.target.value)}
                    placeholder="Purchase email (optional)"
                    className={styles.input}
                    autoComplete="email"
                  />
                </form>

                <div className={styles.purchaseRow}>
                  <a
                    className={styles.purchaseLink}
                    href={checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buy new license
                  </a>
                </div>
              </div>
            </section>
          )}

          {isLicensed && (
            <section className={styles.licensed}>
              <div className={styles.licensedHeader}>
                <span className={styles.statusBadge}>Activated</span>
                <p className={styles.licensedEmail}>
                  {licenseStatus?.buyerEmail}
                </p>
              </div>

              {platformItems.length > 0 ? (
                <div className={styles.downloadList}>
                  {platformItems.map((item) => (
                    <div key={item.platform} className={styles.downloadRow}>
                      <div className={styles.downloadInfo}>
                        <p className={styles.downloadPlatform}>{item.label}</p>
                        <p className={styles.downloadMeta}>
                          {item.fileName} · {formatExpiry(item.expiresAt)}
                        </p>
                      </div>
                      <a
                        className={styles.downloadBtn}
                        href={item.downloadPath}
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.hint}>
                  No installers configured. Set WEB_DOWNLOAD_WINDOWS_URL,
                  WEB_DOWNLOAD_MACOS_URL, and WEB_DOWNLOAD_LINUX_URL on the
                  deployed server.
                </p>
              )}

              <div className={styles.licensedActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => void loadCatalog()}
                  disabled={isCatalogLoading}
                >
                  {isCatalogLoading ? "Refreshing..." : "Refresh links"}
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => void handleDeactivate()}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? "Clearing..." : "Sign out"}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Mathend Studio</p>
        <p className={styles.footerCopy}>&copy; 2026. Restrained simplicity.</p>
      </footer>
    </div>
  );
}
