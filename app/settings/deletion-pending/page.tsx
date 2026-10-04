"use client";

import { useState } from "react";
import { PillButton } from "@/components/settings-shell";
import { GRACE_DAYS, countdownLabel } from "@/lib/delete-account";
import { getAccountState, apiCancelDeletion } from "@/lib/account-lifecycle";
import { writeWelcome } from "@/lib/account-state";
import { formatDate, formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Closing

   A deletion already asked for, and the clock it runs down. This is the
   one locked state with no way round it: nothing else on the account
   opens while it lasts. One card says the date and what the window means,
   and the only thing it offers is to call it off.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeletionPendingPage() {
  const [busy, setBusy] = useState(false);
  const account = getAccountState();
  const finalAt = account?.deletionFinalAt ? Date.parse(account.deletionFinalAt) : null;

  if (finalAt === null) return null;
  const over = Date.now() >= finalAt;
  const asked = finalAt - GRACE_DAYS * 86_400_000;

  async function keepIt() {
    if (busy) return;
    setBusy(true);
    try {
      await apiCancelDeletion();
      writeWelcome({ kind: "deletion-cancelled", at: Date.now(), from: asked });
      haptic("success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-6 sm:p-7">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">
          Your account closes on {formatDate(finalAt)}
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Requested on {formatStamp(asked)}. After that date nothing can be restored.
        </p>
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
          {over
            ? "The window to change your mind has run out and the account is being closed for good. Nothing can be restored."
            : `Nothing has been deleted yet. You have about ${countdownLabel(finalAt)} left to change your mind — cancel below and everything stays exactly as it was.`}
        </p>
        {!over ? (
          <div className="mt-6">
            <PillButton
              label={busy ? "Cancelling…" : "Keep my account"}
              onClick={keepIt}
              disabled={busy}
            />
          </div>
        ) : (
          <p className="mt-6 text-[13px] leading-relaxed text-muted">
            If you believe this is wrong, contact support@tirbeo.app.
          </p>
        )}
      </div>
    </div>
  );
}
