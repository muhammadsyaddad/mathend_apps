"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import AccountModal from "./account-modal";
import type { LicenseStatusResponse } from "../../lib/license-types";

type AccountTriggerProps = {
  licenseStatus: LicenseStatusResponse | null;
  isLoadingLicense: boolean;
  onRefreshLicenseStatus: () => Promise<void>;
  onDeactivateLicense: () => Promise<void>;
};

export default function AccountTrigger({
  licenseStatus,
  isLoadingLicense,
  onRefreshLicenseStatus,
  onDeactivateLicense,
}: AccountTriggerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="settings-icon-button"
        aria-label="Open account"
      >
        <UserRound className="settings-icon" aria-hidden />
      </button>

      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        licenseStatus={licenseStatus}
        isLoadingLicense={isLoadingLicense}
        onRefreshLicenseStatus={onRefreshLicenseStatus}
        onDeactivateLicense={onDeactivateLicense}
      />
    </>
  );
}
