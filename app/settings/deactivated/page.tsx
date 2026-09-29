"use client";

import { AccountLockScreen } from "@/components/account-lock";

/* ═══════════════════════════════════════════════════════════════════
   Paused

   The whole account while it lasts: the settings layout drops its rail,
   its search and its back row for a locked account and hands the viewport
   to this screen, and anything else you try to open is sent back here.
   One action on it — reactivate — because that is the only thing a paused
   account can do.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeactivatedPage() {
  return <AccountLockScreen />;
}
