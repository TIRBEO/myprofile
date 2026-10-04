"use client";

/* ═══════════════════════════════════════════════════════════════════
   Proving it's really you before something sensitive happens

   A session cookie says "this browser signed in". It does not say "the
   person who owns this account is holding it right now" — so the account
   service refuses the actions that are hard to undo (remove a passkey, turn
   off 2FA, sign every other device out, disconnect an app, delete the
   account) until the request also carries a fresh proof.

   The proof rides inside the action's own body, never as a separate
   hand-wave: there is nothing to expire, nothing to store on this side, and
   a stolen session still can't do any of it. Which proofs exist is the
   service's call, not ours — it answers a refusal with the doors *this*
   account can actually open, and the sheet offers exactly those.

   Deliberately not pre-verified: the code dialog could confirm the proof
   first, but a code is single-use. Spending it on a check would leave the
   action itself with nothing to present.
   ═══════════════════════════════════════════════════════════════════ */

import { ApiError, apiJson } from "@/lib/api";

/** Ways the account service will accept an identity proof. */
export type ReauthMethod = "passkey" | "password" | "totp" | "code";

/** Collected proof, ready to fold into a request body. */
export type ReauthProof = {
  password?: string;
  /** 6 digits from the authenticator app — the field the service has always read. */
  code?: string;
  /** 6 digits emailed to the sign-in address. Its own field: `code` means TOTP. */
  reauthCode?: string;
};

/** The proof a person walked away from — not a failure, so nothing to report. */
export class ReauthDeclined extends Error {
  constructor() {
    super("Identity check cancelled");
    this.name = "ReauthDeclined";
  }
}

export function wasDeclined(err: unknown): boolean {
  return err instanceof ReauthDeclined;
}

/** Add the proof to whatever the action already sends. */
export function withProof<T extends Record<string, unknown>>(payload: T, proof: ReauthProof): T {
  return { ...payload, ...proof };
}

/** Whether the service stopped for a proof rather than failing at the thing. */
export function needsReauth(err: unknown): boolean {
  return err instanceof ApiError && err.code === "REAUTH_REQUIRED";
}

/** Only these are worth offering from the browser; a passkey needs a ceremony
    no settings screen drives yet, and every account has a sign-in address, so
    an answer that left the emailed code out is treated as code + password. */
function offerable(methods: unknown): ReauthMethod[] {
  const allowed = new Set<ReauthMethod>(["password", "totp", "code"]);
  const list = Array.isArray(methods) ? methods.filter((m): m is ReauthMethod => allowed.has(m as ReauthMethod)) : [];
  return list.length ? list : ["password", "code"];
}

/** Which doors the service said *this* account can open. */
export function offeredMethods(err: unknown): ReauthMethod[] {
  return offerable(err instanceof ApiError ? err.data?.methods : undefined);
}

/** Ask the service to mail a fresh code to the account's sign-in address.
    The reply names the address in masked form and never the code. */
export async function sendReauthCode(): Promise<{ email: string; message: string }> {
  const reply = await apiJson<{ email?: string; message?: string }>(
    "/api/auth/reauth/send-code",
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
  );
  return { email: reply.email || "", message: reply.message || "A code is on its way" };
}
