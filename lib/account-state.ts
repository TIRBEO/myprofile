"use client";

/* ═══════════════════════════════════════════════════════════════════
   Whether the account is open at all

   Three things can shut the settings area: a pause you took, a deletion
   waiting to become final, and a decision the account has to answer
   before it carries on. They are read here, in one place, in the order
   that matters — a scheduled deletion outranks everything, because it is
   the only one that runs down a clock by itself.

   The point of resolving them to a single answer is that the gate and the
   screen it shows can never disagree, and no page has to remember to
   check. Anything that isn't the screen for the current state is
   unreachable while that state lasts.
   ═══════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore, useEffect } from "react";
import { getAccountState, loadAccountState } from "@/lib/account-lifecycle";
import {
  loadAccountChecks,
  loadAppeals,
  readAppeals,
  sections,
  type StatusItem,
  type StatusSection,
} from "@/lib/account-status";
import { ACCOUNT_EVENT, requestFor } from "@/lib/account-history";

export type LockKind = "deletion" | "deactivated" | "restriction";

export type Lock = {
  kind: LockKind;
  /** The one page that is reachable while this holds. */
  href: string;
  /** A restriction can be read and set aside; the other two cannot. */
  skippable: boolean;
  title: string;
  sub: string;
  /** Only set for a restriction, which has to name the rule it rests on. */
  decision?: { section: StatusSection; item: StatusItem };
};

export const LOCK_HREF: Record<LockKind, string> = {
  deletion: "/settings/deletion-pending",
  deactivated: "/settings/deactivated",
  restriction: "/settings/restricted",
};

/** Every page that only exists while a lock holds — reached from one, with no
    lock, is a page that has nothing left to say. */
export const LOCK_HREFS: string[] = Object.values(LOCK_HREF);

/** A restriction stops nagging once it's been answered or set aside; the
    decision itself stays on the account-status pages either way. */
const SKIP_STORE = "tirbeo:account-status:skipped";

export function readSkips(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SKIP_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function skipRestriction(id: string): void {
  const next = [...new Set([...readSkips(), id])];
  try {
    localStorage.setItem(SKIP_STORE, JSON.stringify(next));
  } catch {
    /* private mode — the acknowledgement still holds for this session */
  }
  accountStateChanged();
}

/** The decision that has to be dealt with before anything else, if there is
    one. A decision stops blocking the moment it's appealed, resolved, or
    read and set aside — its job was to be seen. */
function openRestriction(): Lock["decision"] | null {
  const appeals = readAppeals();
  const skipped = readSkips();
  for (const section of sections()) {
    if (section.severity === "ok") continue;
    for (const item of section.items) {
      /* Every row here came from the account — a real restriction, a stopped
         sign-in, a decision an admin made. The gate only holds on the ones
         that ask something of the person: an appealable decision, until it's
         appealed or set aside. */
      if (!item.appealable) continue;
      if (appeals.some((appeal) => appeal.restrictionId === item.id)) continue;
      if (skipped.includes(item.id)) continue;
      return { section, item };
    }
  }
  return null;
}

/** null while the account is open normally. Deletion and deactivation come
    straight from the account on the brain — never a flag left in this browser,
    which is what let a second device or a cleared cache disagree with reality. */
export function readLock(): Lock | null {
  const account = getAccountState();

  if (account?.deletionPending) {
    return {
      kind: "deletion",
      href: LOCK_HREF.deletion,
      skippable: false,
      title: "Your account is scheduled for deletion",
      sub: "Nothing else on the account is open while that clock runs. This is the one page you can reach, and the only choice on it is to stop it.",
    };
  }

  if (account?.deactivated) {
    return {
      kind: "deactivated",
      href: LOCK_HREF.deactivated,
      skippable: false,
      title: "Your account is deactivated",
      sub: "Everything is where you left it. Reactivate it and it all comes back — until you do, this is the only page the account opens.",
    };
  }

  const decision = openRestriction();
  if (decision) {
    return {
      kind: "restriction",
      href: LOCK_HREF.restriction,
      skippable: true,
      title: decision.item.title,
      sub: `A decision about your account has to be read before anything else. You can appeal it here, or set it aside and carry on — either way it stays listed under Account status.`,
      decision,
    };
  }

  return null;
}

/** Whether a path is the page the current lock allows. */
export function lockAllows(lock: Lock | null, pathname: string): boolean {
  if (!lock) return true;
  return pathname === lock.href || pathname.startsWith(lock.href + "/");
}

/* ── The screen after a lock is lifted ───────────────────────────
   Coming back from a pause used to land you on the settings page with a
   toast at the bottom of it — the account reopening said in a strip the
   width of a sentence. So the way out ends on a screen of its own instead.
   It lives here because it is the same kind of thing the gate reads: a
   state that lives in storage, announced when it changes, and gone as soon
   as it's been acknowledged.                                     */

const WELCOME_STORE = "tirbeo:welcome-back";

export type Welcome = {
  /** Which lock has just been lifted. */
  kind: "reactivated" | "deletion-cancelled";
  /** When it was lifted. */
  at: number;
  /** When the state that has now ended began, so the screen can date it. */
  from: number;
};

/** A receipt, not a queue. Read an hour later and the account has simply
    been open the whole time, so the screen lets itself expire rather than
    interrupting someone who closed the tab and came back tomorrow. */
const WELCOME_WINDOW = 5 * 60_000;

function rawWelcome(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(WELCOME_STORE) ?? "";
  } catch {
    return "";
  }
}

export function writeWelcome(welcome: Welcome): void {
  try {
    localStorage.setItem(WELCOME_STORE, JSON.stringify(welcome));
  } catch {
    /* private mode — the screen still shows for this session */
  }
  accountStateChanged();
}

export function clearWelcome(): void {
  try {
    localStorage.removeItem(WELCOME_STORE);
  } catch {
    /* nothing to clear */
  }
  accountStateChanged();
}

/** The lock that was just lifted, while the screen for it is still worth
    showing. `null` once it has been acknowledged or has aged out. */
export function useWelcome(): Welcome | null {
  const raw = useSyncExternalStore(subscribe, rawWelcome, () => "");
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Welcome;
    if (typeof saved?.at !== "number" || typeof saved?.from !== "number") return null;
    if (Date.now() - saved.at > WELCOME_WINDOW) return null;
    return saved;
  } catch {
    return null;
  }
}

/** The history row that explains why a lock is here, when there is one. */
export function lockRequest(lock: Lock) {
  if (!lock) return null;
  const id = lock.kind === "restriction" ? lock.decision?.item.id : lock.kind;
  return id ? requestFor(id) : null;
}

/* ── Telling the gate about it ────────────────────────────────────
   Every state on this page comes out of storage, so a lock only exists as
   long as the thing that made it does. Both halves of that — the value and
   the news that it changed — live in one place, which is why the gate and
   the page it shows can never end up disagreeing.                    */

/** Fired by anything that starts or ends a state, including the request
    log in lib/account-history that every mutation already writes to. */
export function accountStateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ACCOUNT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ACCOUNT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `useSyncExternalStore` compares snapshots by identity, so a lock is kept
    against a key describing the state instead of being rebuilt every render.
    The key is the whole answer — an unkeyed object would re-render forever. */
const CACHE = new Map<string, Lock>();

function keyOf(lock: Lock | null): string {
  if (!lock) return "";
  return lock.kind === "restriction" ? `restriction:${lock.decision?.item.id}` : lock.kind;
}

function currentKey(): string {
  if (typeof window === "undefined") return "";
  const lock = readLock();
  const key = keyOf(lock);
  if (key && lock) {
    if (CACHE.size > 16) CACHE.clear();
    CACHE.set(key, lock);
  }
  return key;
}

/** The lock in force, re-read whenever the route changes, a state is
    announced, or a fresh read from the brain lands. `null` means the account
    is open normally. The first mount pulls the real state so a page opened
    cold reflects the account rather than an empty browser cache. */
export function useAccountLock(): Lock | null {
  const key = useSyncExternalStore(subscribe, currentKey, () => "");
  useEffect(() => {
    void loadAccountState();
    // The checks and the appeals are read from the account too, so the
    // restriction lock reflects what the brain says — never a stale guess,
    // and never anything invented.
    void loadAccountChecks().catch(() => {});
    void loadAppeals().catch(() => {});
  }, []);
  return key ? (CACHE.get(key) ?? null) : null;
}
