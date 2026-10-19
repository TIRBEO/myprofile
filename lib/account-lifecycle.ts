"use client";

/* ═══════════════════════════════════════════════════════════════════
   Account lifecycle — the brain is the source of truth

   Deactivation and deletion used to be flags kept in this browser, which
   meant a second device had no idea the account was paused and a cleared
   cache "revived" a scheduled deletion. Everything here now reads and
   writes the account's real state on the brain:

     • GET    /api/user/account-state   (the whole truth, one round-trip)
     • POST   /api/user/deactivate
     • POST   /api/user/reactivate
     • POST   /api/user/delete-account  (request code / verify / schedule)
     • DELETE /api/user/delete-account  (cancel inside the window)

   The cached snapshot is what the settings gate reads, so the lock a screen
   shows is the state the account is actually in — and it refreshes itself
   after every action, so no reload trick is needed to see the result.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useSyncExternalStore } from "react";
import { apiJson, apiSend } from "@/lib/api";
import { ACCOUNT_EVENT } from "@/lib/account-history";

export type Connection = {
  id: string;
  provider: string;
  connected: boolean;
  accountId: string | null;
  linkedAt: string | null;
  firstNameUsedAt: string | null;
  lastUsedAt: string | null;
};

export type SignInMethods = {
  password: boolean;
  passkey: boolean;
  oauth: string[];
  total: number;
};

export type AccountState = {
  /** active | restricted | banned | suspended | deactivated | deletion_pending
      | deleted — the account's own lifecycle row on the brain. */
  status: string;
  /** The reason behind the current enforcement, when one was recorded. */
  reason: string | null;
  /** When the current enforcement ends (ISO) — a suspension's end, a
      deletion's final date. Null for open-ended states. */
  until: string | null;
  /** The decision row behind a ban or suspension, when there is one. An appeal
      is filed against it, so the screen never has to guess which decision. */
  decisionId: string | null;
  /** Whether that decision has already been appealed. */
  appealFiled: boolean;
  deactivated: boolean;
  deactivatedAt: string | null;
  deactivatedReason: string | null;
  deletionPending: boolean;
  deletionFinalAt: string | null;
  /** Persisted event reference for the current enforcement state — what
      support and the admin lookup search by. Null when nothing was decided. */
  refCode: string | null;
  signInMethods: SignInMethods;
  connections: Connection[];
};

/** The last snapshot read from the brain, shared by every reader. */
let cached: AccountState | null = null;
let loadedOnce = false;
/** The read that answered last time did not answer now. A gate that treats
    "the brain is unreachable" as "the account is open" hands a closed account
    its dashboard — so the failure is a state of its own, not an empty cache. */
let failed = false;
let inflight: Promise<AccountState | null> | null = null;

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

export function getAccountState(): AccountState | null {
  return cached;
}

/** Whether the brain has answered the account-state read at least once.
    The gate needs the difference between "the account is open" and "nobody
    has asked yet" — the first is a fact, the second is an empty cache. */
export function accountStateLoaded(): boolean {
  return loadedOnce;
}

/** The read failed and there is no snapshot to fall back on. */
export function accountStateFailed(): boolean {
  return loadedOnce && failed && cached === null;
}

/** Pull the real state and republish it. Concurrent callers share one read —
    the gate and the screen it renders both ask, and two round-trips for one
    fact is how a screen ends up rendering against a snapshot that changed
    underneath it. */
export function loadAccountState(): Promise<AccountState | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      cached = await apiJson<AccountState>("/api/user/account-state");
      failed = false;
    } catch {
      /* Keep the last known state rather than flash the account open. */
      failed = true;
    }
    loadedOnce = true;
    inflight = null;
    notify();
    return cached;
  })();
  return inflight;
}

/* ── Actions ───────────────────────────────────────────────────────
   Each write returns the fresh state so callers can branch on it, and
   every one refreshes the shared snapshot first so the gate reacts with
   no reload. apiSend attaches the CSRF token the edge demands.        */

async function afterWrite(): Promise<AccountState | null> {
  return loadAccountState();
}

export async function apiDeactivate(reason: string | null): Promise<AccountState | null> {
  await apiSend("/api/user/deactivate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return afterWrite();
}

export async function apiReactivate(): Promise<AccountState | null> {
  await apiSend("/api/user/reactivate", { method: "POST", body: "{}" });
  return afterWrite();
}

/* ── Coming back with no session to spend ─────────────────────────
   There is no such path any more. Sign-in answers a deactivated or
   deletion-pending account the same way it answers every other closure: the
   decision of record plus a session whose only room is the settings gate,
   where the buttons above live. An email-code door that reopened the account
   without a credential would have been both redundant and an oracle — it
   would have told anyone who typed an address whether that account was closed.
*/

/** Step one of closing the account: the brain mails a 6-digit code to the
    sign-in address and says so. Its reply is handed back, because the page
    should name the inbox from the server's answer rather than guess, and a
    resend that arrives too early comes back as an error carrying the wait.
    The address arrives masked — it is the account's own, shown back to its
    owner, and a settings page is not where a full address belongs in markup. */
export async function apiRequestDeletionCode(): Promise<{ message: string; email: string }> {
  const reply = await apiJson<{ message?: string; email?: string }>("/api/user/delete-account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ step: "request" }),
  });
  return { email: reply.email || "", message: reply.message || "Verification code sent" };
}

/** Step two: the code proves it is really the owner, and the account goes onto
    the 30-day clock. A wrong or spent code throws with the brain's own words,
    so the page can say which of the two happened. */
export async function apiVerifyDeletion(code: string, reason: string | null): Promise<AccountState | null> {
  await apiSend("/api/user/delete-account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ step: "verify", code, reason }),
  });
  return afterWrite();
}

export async function apiCancelDeletion(): Promise<AccountState | null> {
  await apiSend("/api/user/delete-account", { method: "DELETE" });
  return afterWrite();
}

/* ── The hook ───────────────────────────────────────────────────────
   The gate subscribes to the snapshot; the first mount also kicks a read
   so a page opened cold reflects the account rather than an empty cache. */

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ACCOUNT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ACCOUNT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useAccountState(): { state: AccountState | null; loading: boolean } {
  const state = useSyncExternalStore(subscribe, () => cached, () => null);
  useEffect(() => {
    if (!loadedOnce) void loadAccountState();
  }, []);
  return { state, loading: !loadedOnce && state === null };
}
