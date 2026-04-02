"use client";

import { useState } from "react";
import { Bot, Settings } from "lucide-react";
import SettingsModal from "./ui/setting-modal";
import AccountTrigger from "./ui/account-trigger";
import AgentPanel from "./ui/agent-panel";

export default function SettingsTrigger() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);

  return (
    <div className="sidebar-footer">
      <AccountTrigger />

      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="settings-icon-button"
        aria-label="Open settings"
      >
        <Settings className="settings-icon" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => setIsAgentPanelOpen((value) => !value)}
        className={
          isAgentPanelOpen
            ? "settings-icon-button settings-icon-button-active"
            : "settings-icon-button"
        }
        aria-label={isAgentPanelOpen ? "Close agent panel" : "Open agent panel"}
        aria-pressed={isAgentPanelOpen}
      >
        <Bot className="settings-icon" aria-hidden />
      </button>

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <AgentPanel
        isOpen={isAgentPanelOpen}
        onClose={() => setIsAgentPanelOpen(false)}
      />
    </div>
  );
}
