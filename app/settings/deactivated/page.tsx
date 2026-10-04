"use client";

import { useState } from "react";
import { PillButton } from "@/components/settings-shell";
import { getAccountState, apiReactivate } from "@/lib/account-lifecycle";
import { writeWelcome } from "@/lib/account-state";
import { formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Paused

   The settings layout drops its rail, its search and its back row for a
   locked account and hands the viewport to this screen, and anything else
   you try to open is sent back here. One card, four short sentences, one
   action — reactivate — because that is the only thing a paused account
   can do.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeactivatedPage() {
  const [busy, setBusy] = useState(false);
  const account = getAccountState();
  const pausedAt = account?.deactivatedAt ? Date.parse(account.deactivatedAt) : null;

  async function comeBack() {
    if (busy) return;
    setBusy(true);
    try {
      await apiReactivate();
      if (pausedAt) writeWelcome({ kind: "reactivated", at: Date.now(), from: pausedAt });
      haptic("success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-6 sm:p-7">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">Your account is paused</h1>
        <p className="mt-1 text-[13px] text-muted">
          {pausedAt ? `Paused on ${formatStamp(pausedAt)}.` : "Paused from the settings."}
        </p>
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
          Nothing was deleted. Your profile, your details and everything saved to it are kept
          exactly where you left them, hidden from everyone until you come back.
        </p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          Reactivating opens the account again with everything as it was. Other devices will need
          to sign in again.
        </p>
        <div className="mt-6">
          <PillButton
            label={busy ? "Reactivating…" : "Reactivate now"}
            onClick={comeBack}
            disabled={busy}
          />
        </div>
      </div>
    </div>
  );
}
