"use client";

import { AccountLockScreen } from "@/components/account-lock";

/* ═══════════════════════════════════════════════════════════════════
   Closing

   A deletion already asked for, and the clock it runs down. This is the
   one locked state with no way round it: nothing else on the account
   opens while it lasts, and the only thing this page offers is to call it
   off.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeletionPendingPage() {
  return <AccountLockScreen />;
}
