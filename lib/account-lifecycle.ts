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
  status: string;
  deactivated: boolean;
  deactivatedAt: string | null;
  deactivatedReason: string | null;
  deletionPending: boolean;
  deletionFinalAt: string | null;
  deletionDaysRemaining: number | null;
  signInMethods: SignInMethods;
  connections: Connection[];
};

/** The last snapshot read from the brain, shared by every reader. */
let cached: AccountState | null = null;
let loadedOnce = false;

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

export function getAccountState(): AccountState | null {
  return cached;
}

/** Pull the real state and republish it. Never throws — a failed read leaves
    the last snapshot in place and the gate simply shows what it already knew. */
export async function loadAccountState(): Promise<AccountState | null> {
  try {
    const next = await apiJson<AccountState>("/api/user/account-state");
    cached = next;
  } catch {
    /* network/auth hiccup — keep the last known state rather than flash open */
  }
  loadedOnce = true;
  notify();
  return cached;
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
