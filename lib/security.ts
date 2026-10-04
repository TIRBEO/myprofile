"use client";

/* ═══════════════════════════════════════════════════════════════════
   The password and security hub, from the account service

   Three facts and two actions. The facts — whether this account has a
   password at all, and the address a recovery would be sent to — come
   from the brain, because a browser copy of them is a second truth that
   drifts the moment the account is touched from another device. The
   actions go through the brain too: it is the only thing that may write a
   password hash or mark an address verified, and it is where the audit
   row and the "your password changed" notice get made.

   A recovery address is not believed until its owner proves they receive
   mail there, so setting one is two calls: send a code, then spend it.
   The send reports honestly whether the mail left, because "check your
   inbox" is a lie when nothing was delivered.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson, apiSend } from "@/lib/api";

export type SecurityStatus = {
  /** False for an account made through a provider, which has no password yet. */
  hasPassword: boolean;
  /** The address a recovery would go to, or null when none is on file. */
  recoveryEmail: string | null;
  recoveryEmailVerified: boolean;
};

export async function readSecurityStatus(): Promise<SecurityStatus> {
  return apiJson<SecurityStatus>("/api/security/status");
}

/** A second factor the account can demand for a password change: the live
    authenticator code, or one of the printed backup codes. */
export type SecondFactor = { code?: string; backupCode?: string };

/** Replaces the password and signs every *other* device out — the brain does
    both, so the browser cannot report success for half of it. When the account
    has "require 2FA for sensitive actions" on, the brain refuses the first
    attempt with SECOND_FACTOR_REQUIRED and the caller retries with `factor`. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  factor: SecondFactor = {},
): Promise<void> {
  await apiSend("/api/security/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword, ...factor }),
  });
}

/** True when the mail actually left. The code itself is never returned. */
export async function sendRecoveryCode(email: string): Promise<boolean> {
  const reply = await apiJson<{ ok: boolean; delivered?: boolean }>(
    "/api/security/recovery-email/send-code",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  return reply.delivered !== false;
}

/** Spends the code and stores the address as the account's recovery contact. */
export async function verifyRecoveryEmail(email: string, code: string): Promise<void> {
  await apiSend("/api/security/recovery-email/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}
