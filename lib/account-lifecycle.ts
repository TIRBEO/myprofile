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
import { SIGNED_OUT_ANSWER } from "@/lib/account-prefetch";

/** The bus every account-state change is announced on. The gate, the status
    screens and the account's request rows all repaint from it, so a change
    made on one screen reaches the others without a reload. */
export const ACCOUNT_EVENT = "tirbeo:account-state";

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

/* ── The snapshot this device keeps ──────────────────────────────
   The gate is presentation: every door behind it is enforced by the brain's
   own status gate, so the settings shell has no reason to wait for a round
   trip before it decides what to paint. The last answer is kept briefly and
   a reload paints from it while the fresh read is in the air — which is the
   difference between a page that opens and a page that spins.

   Briefly, and per device, and dropped on sign-out (see `endSession`): the
   snapshot names an account's state, its reason and its dates, and none of
   that belongs to whoever sits down at this browser next. */
const SNAPSHOT_STORE = "tirbeo:account-state";
const SNAPSHOT_TTL = 5 * 60_000;

function readSnapshot(): AccountState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORE);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { state?: AccountState; at?: number };
    if (!saved?.state || typeof saved.at !== "number" || Date.now() - saved.at > SNAPSHOT_TTL) return null;
    return saved.state;
  } catch {
    return null;
  }
}

function writeSnapshot(state: AccountState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_STORE, JSON.stringify({ state, at: Date.now() }));
  } catch {
    /* private mode or a full quota — the read still lands in memory */
  }
}

/** The last snapshot read from the brain, shared by every reader. */
let cached: AccountState | null = readSnapshot();
let loadedOnce = false;
/** The read that answered last time did not answer now. A gate that treats
    "the brain is unreachable" as "the account is open" hands a closed account
    its dashboard — so the failure is a state of its own, not an empty cache. */
let failed = false;
/** The last read refused this cookie. Separate from `failed` because it is not
    a failure: a signed-out reader who is shown "we couldn't read your account"
    and a Retry button will press that button until their fingers hurt. */
let signedOut = false;
let inflight: Promise<AccountState | null> | null = null;

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

export function getAccountState(): AccountState | null {
  return cached;
}

/** This browser has stopped holding that account — signed out, or switched to
    another one. The bag is wiped by `clearAccountTraces`, and the copy in
    memory goes with it: leaving it here would paint one account's state,
    reason and dates over whoever signs in next. */
export function forgetAccountState(): void {
  cached = null;
  loadedOnce = false;
  failed = false;
  signedOut = false;
  inflight = null;
}

/** Whether this browser holds any answer at all, fresh or kept. The gate
    paints from it; `accountStateLoaded` says whether it is this visit's. */
export function accountStateKnown(): boolean {
  return cached !== null;
}

/** Whether the brain has answered the account-state read at least once.
    The gate needs the difference between "the account is open" and "nobody
    has asked yet" — the first is a fact, the second is an empty cache. */
export function accountStateLoaded(): boolean {
  return loadedOnce;
}

/** The read failed and there is nothing standing in for it.
 *
 *  A kept *lock* is not "nothing" — it is the conservative answer, and what it
 *  paints is a lock screen. A kept *absence* of a lock is not an answer either:
 *  it is the state of a visit that has not asked, and the person whose account
 *  is closed is the one holding the browser that decides whether the question
 *  gets through. So a failed read over a kept "open" counts as a failure here,
 *  even though a value is in the cache, and the gate shows what it cannot
 *  prove rather than what it can no longer check. */
export function accountStateFailed(): boolean {
  if (!loadedOnce || !failed) return false;
  return cached === null || cached.status === "active";
}

/** The last read refused this cookie — the reader is signed out rather than
    unreached. The gate paints a door with a way back in, not a service error
    with a Retry that can only fail again. */
export function accountStateSignedOut(): boolean {
  return loadedOnce && signedOut;
}

/* ── The read, and the clock on it ────────────────────────────────
   The gate holds the whole settings shell behind this one answer, so the
   read's worst case IS the reader's worst case. Two rules follow from that:

   • Start it as early as the document allows. `app/layout.tsx` fires it from
     a boot script, so the round trip is in the air while the bundle is still
     downloading instead of after hydration — see `PREFETCH_GLOBAL`.
   • Never wait for an answer that is not coming. The bridge aborts its own
     upstream at PROFILE_TIMEOUT_MS (10s by default) and the browser's fetch
     has no deadline of its own, so an unbounded read here is a 10-second
     spinner at best and a permanently hanging one if a hop never returns.
     A bounded read turns "stuck" into `CouldNotRead`, which offers Retry and
     Sign out — both of which are actions. */
const READ_TIMEOUT_MS = 6_000;

/** The hand-off the boot script leaves behind: the read it already started. */
const PREFETCH_GLOBAL = "__tirbeoAccountState";

/** What a read of the account's state can hand back: the state, nothing at all,
    or the boot script's marker for a cookie the account refused. */
type AccountStateAnswer = AccountState | null | typeof SIGNED_OUT_ANSWER;

function takePrefetch(): Promise<AccountStateAnswer> | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const pending = w[PREFETCH_GLOBAL] as Promise<AccountStateAnswer> | undefined;
  if (!pending) return null;
  /* Taken once, and taken for good: a later call (after a write, or a Retry)
     has to ask again for real, not re-read the answer the page came in with. */
  delete w[PREFETCH_GLOBAL];
  return pending;
}

function readSignal(): AbortSignal | undefined {
  const factory = (globalThis.AbortSignal as { timeout?: (ms: number) => AbortSignal } | undefined)?.timeout;
  return typeof factory === "function" ? factory.call(globalThis.AbortSignal, READ_TIMEOUT_MS) : undefined;
}

/** Stop waiting, whatever the request underneath is still doing. The signal
    above normally kills the fetch too; this is the guarantee, and the fallback
    for a runtime without `AbortSignal.timeout`. */
function bounded<T>(read: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Account state read timed out")), READ_TIMEOUT_MS);
    read.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Pull the real state and republish it. Concurrent callers share one read —
    the gate and the screen it renders both ask, and two round-trips for one
    fact is how a screen ends up rendering against a snapshot that changed
    underneath it. */
export function loadAccountState(): Promise<AccountState | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const prefetched = takePrefetch();
      const state = await bounded(
        prefetched ?? apiJson<AccountState>("/api/user/account-state", { signal: readSignal() }),
      );
      /* The boot read answers with this one string for a 401 — it has no body
         to read and no reason to make one. A refused cookie is an answer about
         the reader, not a missing answer, so it is recorded as a sign-out and
         the gate paints the door that says so. */
      if (state === SIGNED_OUT_ANSWER) {
        signedOut = true;
        failed = false;
      } else {
        /* The boot script answers `null` for a 502 or a body it could not read,
           and `apiJson` answers a shaped object. Neither is a fact about the
           account, so neither may be stored as one: a gate that read an empty
           answer here would paint the dashboard for an account it has never
           actually heard about. Anything that is not a state is a failure, and
           a failure is the `CouldNotRead` screen. */
        if (!state || typeof state.status !== "string") throw new Error("Account state did not answer");
        cached = state;
        failed = false;
        signedOut = false;
        writeSnapshot(cached);
      }
    } catch (error) {
      /* Keep the last known state rather than flash the account open. */
      failed = true;
      /* A GET of the account's own state has one reason to say 401: this cookie
         is not a session. Read the status off the error rather than its class,
         so the store does not depend on which wrapper threw it. */
      signedOut = (error as { status?: number } | null)?.status === 401;
      if (signedOut) failed = false;
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

/** Step two: the code proves the mailbox, and a fresh identity proof —
    password, authenticator code, emailed re-auth code or passkey, whatever
    this account can offer — proves the person. The account also enforces its
    "require 2FA for sensitive actions" policy here. A wrong or spent code
    throws with the brain's own words, so the page can say which of the two
    happened. */
export async function apiVerifyDeletion(
  code: string,
  reason: string | null,
  proof: Record<string, string> = {},
): Promise<AccountState | null> {
  await apiSend("/api/user/delete-account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ step: "verify", deleteCode: code, reason, ...proof }),
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
