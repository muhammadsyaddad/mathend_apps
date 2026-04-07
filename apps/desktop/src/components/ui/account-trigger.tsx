"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import AccountModal from "./account-modal";

export default function AccountTrigger() {
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
      />
    </>
  );
}
