"use client";

import { useState } from "react";
import { Bot, Settings } from "lucide-react";
import SettingsModal from "./ui/setting-modal";
import AccountTrigger from "./ui/account-trigger";
import AgentPanel from "./ui/agent-panel";

type AgentActiveFile = {
  id: string;
  title: string;
  content: string;
};

type SettingsTriggerProps = {
  activeFile: AgentActiveFile | null;
  onOverwriteActiveFile: (nextContent: string) => boolean;
  onAppendToActiveFile: (appendContent: string) => boolean;
  onReplaceInActiveFile: (find: string, replaceWith: string) => number;
};

export default function SettingsTrigger({
  activeFile,
  onOverwriteActiveFile,
  onAppendToActiveFile,
  onReplaceInActiveFile,
}: SettingsTriggerProps) {
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
        activeFile={activeFile}
        onOverwriteActiveFile={onOverwriteActiveFile}
        onAppendToActiveFile={onAppendToActiveFile}
        onReplaceInActiveFile={onReplaceInActiveFile}
      />
    </div>
  );
}
