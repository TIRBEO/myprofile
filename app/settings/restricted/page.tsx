"use client";

import { AccountLockScreen } from "@/components/account-lock";

/* ═══════════════════════════════════════════════════════════════════
   A decision to read

   Something has been decided about the account and it has to be seen
   before the account carries on. This is the only locked state that lets
   you go: appealing is an answer, and so is reading it and saying so.
   Neither one lifts the decision — both leave it on file under Account
   status, where the history of everything like it lives.
   ═══════════════════════════════════════════════════════════════════ */

export default function RestrictedPage() {
  return <AccountLockScreen />;
}
