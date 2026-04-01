"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import SettingsModal from "./ui/setting-modal";

export default function SettingsTrigger() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="sidebar-footer">
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="nav-item nav-item-button settings-link"
        aria-label="Open settings"
      >
        <Settings className="nav-icon" aria-hidden />
        <span className="nav-item-label">Settings</span>
      </button>

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
