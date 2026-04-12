"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import SettingsModal from "./ui/setting-modal";
import AccountTrigger from "./ui/account-trigger";
import type { LicenseStatusResponse } from "../lib/license-types";

type SettingsTriggerProps = {
  licenseStatus: LicenseStatusResponse | null;
  isLoadingLicense: boolean;
  onRefreshLicenseStatus: () => Promise<void>;
  onDeactivateLicense: () => Promise<void>;
};

export default function SettingsTrigger({
  licenseStatus,
  isLoadingLicense,
  onRefreshLicenseStatus,
  onDeactivateLicense,
}: SettingsTriggerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="sidebar-footer">
      <AccountTrigger
        licenseStatus={licenseStatus}
        isLoadingLicense={isLoadingLicense}
        onRefreshLicenseStatus={onRefreshLicenseStatus}
        onDeactivateLicense={onDeactivateLicense}
      />

      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="settings-icon-button"
        aria-label="Open settings"
      >
        <Settings className="settings-icon" aria-hidden />
      </button>

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
