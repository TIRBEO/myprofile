"use client";

/* ═══════════════════════════════════════════════════════════════════
   Whether the account is open at all

   Six things can shut the settings area: a ban, a suspension, a deletion
   that already ran, a pause you took, a deletion waiting to become final,
   and a decision the account has to answer before it carries on. They are
   read here, in one place, in the order that matters — the states a person
   cannot undo outrank the ones they can, and a scheduled deletion outranks
   the rest, because it is the only one that runs down a clock by itself.

   The point of resolving them to a single answer is that the gate and the
   screen it shows can never disagree, and no page has to remember to
   check. Anything that isn't the screen for the current state is
   unreachable while that state lasts.

   A lock has no address. It used to have one of its own, which meant a
   screen whose whole meaning was "your account is closed" could be opened
   when it wasn't — and, worse, that the page for the step before it could
   be skipped by typing a URL. The gate now puts the screen up over whatever
   path you asked for, so there is nothing to type and nothing to skip.
   ═══════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore, useEffect } from "react";
import {
  ACCOUNT_EVENT,
  accountStateFailed,
  accountStateLoaded,
  getAccountState,
  loadAccountState,
} from "@/lib/account-lifecycle";
import {
  loadAccountChecks,
  loadAppeals,
  readAppeals,
  sections,
  type StatusItem,
  type StatusSection,
} from "@/lib/account-status";
import { adoptLegacy, getStored, setStored } from "@/lib/remote-store";

export type LockKind =
  | "deletion"
  | "deactivated"
  | "restriction"
  | "banned"
  | "suspended"
  | "deleted";

export type Lock = {
  kind: LockKind;
  /** A restriction can be read and set aside; the other two cannot. */
  skippable: boolean;
  title: string;
  sub: string;
  /** Only set for a restriction, which has to name the rule it rests on. */
  decision?: { section: StatusSection; item: StatusItem };
};

/** A restriction stops nagging once it's been answered or set aside; the
    decision itself stays on the account-status pages either way. */
const SKIP_STORE = "tirbeo:account-status:skipped";

export function readSkips(): string[] {
  if (typeof window === "undefined") return [];
  adoptLegacy(SKIP_STORE);
  const parsed = getStored<unknown>(SKIP_STORE, []);
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
}

export function skipRestriction(id: string): void {
  const next = [...new Set([...readSkips(), id])];
  setStored(SKIP_STORE, next);
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

  /* A closure that the person cannot un-do by themselves outranks every other
     state, and — unlike a decision — it is not something to be read and set
     aside. A banned or suspended account that could "carry on" past this screen
     would be a ban in name only, so these are checked before the restriction
     gate ever gets a chance to be dismissed. */
  if (account?.status === "deleted") {
    return {
      kind: "deleted",
      skippable: false,
      title: "Your account has been deleted",
      sub: "The account and everything saved to it are gone. This screen is the last place the account was — there is nothing left on it to open.",
    };
  }

  if (account?.status === "banned") {
    return {
      kind: "banned",
      skippable: false,
      title: "Your account has been banned",
      sub: "Access is closed until this decision is lifted. You can appeal it below, or write to support — either way nothing else on the account opens while the ban stands.",
    };
  }

  if (account?.status === "suspended") {
    return {
      kind: "suspended",
      skippable: false,
      title: "Your account is suspended",
      sub: "Access is paused for a set time. You can appeal it below, or write to support — the account opens again on its own when the suspension ends.",
    };
  }

  if (account?.deletionPending) {
    return {
      kind: "deletion",
      skippable: false,
      title: "Your account is scheduled for deletion",
      sub: "Nothing else on the account is open while that clock runs. This is the one page you can reach, and the only choice on it is to stop it.",
    };
  }

  if (account?.deactivated) {
    return {
      kind: "deactivated",
      skippable: false,
      title: "Your account is deactivated",
      sub: "Everything is where you left it. Reactivate it and it all comes back — until you do, this is the only page the account opens.",
    };
  }

  const decision = openRestriction();
  if (decision) {
    return {
      kind: "restriction",
      skippable: true,
      title: decision.item.title,
      sub: `A decision about your account has to be read before anything else. You can appeal it here, or set it aside and carry on — either way it stays listed under Account status.`,
      decision,
    };
  }

  return null;
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

/* The bag holds the receipt as an object; `useSyncExternalStore` compares
   snapshots by identity, so the getSnapshot returns the value stringified —
   equal content yields an equal string, and the screen only repaints when the
   receipt actually changes. */
function rawWelcome(): string {
  if (typeof window === "undefined") return "";
  adoptLegacy(WELCOME_STORE);
  const value = getStored<Welcome | null>(WELCOME_STORE, null);
  return value ? JSON.stringify(value) : "";
}

export function writeWelcome(welcome: Welcome): void {
  setStored(WELCOME_STORE, welcome);
  accountStateChanged();
}

export function clearWelcome(): void {
  setStored(WELCOME_STORE, null);
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

/* ── Telling the gate about it ────────────────────────────────────
   Every state on this page comes out of storage, so a lock only exists as
   long as the thing that made it does. Both halves of that — the value and
   the news that it changed — live in one place, which is why the gate and
   the page it shows can never end up disagreeing.                    */

/** Fired by anything that starts or ends a state — the same event the
    lifecycle snapshot is announced on, so one news item repaints both. */
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
  /* A lock carried over from the last visit paints at once: it is the
     conservative answer, and the fresh read underneath can only confirm or
     replace it with another lock. A carried-over *absence* of lock is not —
     the account can have been closed since that read, and painting the
     dashboard on that guess is exactly the frame this gate exists to prevent.
     So "open" only counts once this document has actually asked. */
  if (key || accountStateLoaded()) return key;
  /* No answer at all, and the read did not come back: not "open", not "unknown
     yet", but "we could not ask" — a gate that renders the dashboard here is a
     gate that fails open. */
  if (key) return `?${key}`;
  return accountStateFailed() ? "!" : "?";
}

/** The lock in force, and whether the account has been asked yet. Re-read
    whenever a state is announced or a fresh read from the brain lands.
    `lock === null` with `loading === false` means the account is open normally;
    `loading === true` means nobody knows yet and `failed === true` means the
    read did not answer — neither is the same as "open", and neither may render
    the dashboard. Every mount revalidates against the brain; what it paints
    while that is in the air is the state this browser last saw, so a returning
    reader is not made to watch a spinner for a round trip. */
export function useAccountLock(): { lock: Lock | null; loading: boolean; failed: boolean } {
  /* The server has never asked, so it answers "unknown" and the gate holds.
     Every screen here is prerendered, so whatever this snapshot picks is the
     first HTML a reader sees — and a closed account reading back its own rail,
     panels and search box for the length of hydration is a glimpse all the
     same, with no client code able to take it back. */
  const snapshot = useSyncExternalStore(subscribe, currentKey, () => "?");
  useEffect(() => {
    void loadAccountState().then((state) => {
      /* A hard closure (banned / suspended / deleted) has nothing to enumerate
         and its status gate refuses those reads — asking would only spend the
         session on a 403. The lock itself needs none of it. For every other
         state the checks and appeals are read from the account too, so the
         restriction lock reflects what the brain says — never a stale guess. */
      if (state && (state.status === "banned" || state.status === "suspended" || state.status === "deleted")) {
        return;
      }
      void loadAccountChecks().catch(() => {});
      void loadAppeals().catch(() => {});
    });
  }, []);
  const failed = snapshot === "!";
  const loading = !failed && snapshot.startsWith("?");
  const key = loading ? snapshot.slice(1) : snapshot;
  return { lock: key && !failed ? (CACHE.get(key) ?? null) : null, loading, failed };
}
