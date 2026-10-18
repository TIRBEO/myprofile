"use client";

/* ═══════════════════════════════════════════════════════════════════
   "Welcome back" — the account, after it was given back

   Three different things used to end an account's interruption with the
   same silence: a ban lifted by staff, a suspension that ran out, a pause
   you took and a deletion you called off. Whoever put it back, the settings
   page just opened as if nothing had happened — and a person who has been
   away for six weeks does not know yet that the six weeks are over.

   So the brain keeps the record of the way back (`GET
   /api/users/welcome-back` — which state it came from, why it happened, who
   resolved it and how long the account was shut for) and answers it exactly
   once per person: the screen below spends it with `POST
   /api/users/welcome-back/ack`, and every load after that gets `null`.

   Two things this has to get right, and both are about not being annoying
   about something that is genuinely over:

     • one read per browser session, however many pages mount and remount
       inside it — the state lives on `globalThis` for the same reason the
       session probe does (see lib/session): Next can put this module in more
       than one chunk, and each copy asking its own question is a screen that
       flickers on every navigation;
     • a restoration that has already been shown is never shown twice, even
       in a fresh tab a week later — the `restoredAt` of the last one this
       browser displayed is kept, and a newer restoration still surfaces.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useSyncExternalStore } from "react";
import { apiJson } from "@/lib/api";

export type WelcomeBackFrom = "banned" | "suspended" | "deactivated" | "deletion_pending";

export type WelcomeBack = {
  from: WelcomeBackFrom;
  reason: string | null;
  /** admin: staff gave the account back. user: the person did it themselves. */
  actor: "admin" | "user";
  pausedAt: string;
  restoredAt: string;
  daysOff: number;
};

/** Where the last restoration this browser has shown is kept, so a screen
    that has already been read doesn't come back for a second tab. Plain
    localStorage rather than the settings bag: this is a courtesy about this
    device having shown something, not a choice the account should carry, and
    the ack endpoint is what tells the *account* it has been seen. */
const SHOWN_STORE = "tirbeo:welcome-back:shown";

const CHANGE_EVENT = "tirbeo:welcome-back";

/** The whole state on one object on `globalThis`, shared by every copy of
    this module. */
const STORE_KEY = "__tirbeoWelcomeBack";

type Store = {
  /** The restoration on offer, or null — either there isn't one, or it has
      already been dealt with in this session. */
  value: WelcomeBack | null;
  /** A snapshot string for `useSyncExternalStore`, which compares by identity. */
  key: string;
  /** This session has already asked, one way or another. */
  asked: boolean;
  /** The read in the air, shared instead of duplicated. */
  inFlight: Promise<WelcomeBack | null> | null;
};

function shared(): Store {
  const holder = globalThis as unknown as Record<string, Store | undefined>;
  return (holder[STORE_KEY] ??= { value: null, key: "", asked: false, inFlight: null });
}

function publish(value: WelcomeBack | null): void {
  const store = shared();
  store.value = value;
  store.key = value ? `${value.from}|${value.restoredAt}` : "";
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

function alreadyShown(welcome: WelcomeBack): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SHOWN_STORE) === welcome.restoredAt;
  } catch {
    return false;
  }
}

function markShown(welcome: WelcomeBack): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOWN_STORE, welcome.restoredAt);
  } catch {
    /* private mode — the ack to the account is the half that matters */
  }
}

/* ── The read ─────────────────────────────────────────────────────── */

/** Ask the account once. Every later call in the same browser session returns
    the same answer without a round trip, and a failed read is not retried on
    every mount — an account that couldn't be asked simply doesn't get the
    screen, which is the correct outcome for a courtesy. */
export async function loadWelcomeBack(): Promise<WelcomeBack | null> {
  const store = shared();
  if (typeof window === "undefined") return null;
  if (store.asked || store.inFlight) return store.inFlight ?? store.value;
  store.asked = true;

  store.inFlight = apiJson<{ welcomeBack?: WelcomeBack | null }>("/api/users/welcome-back")
    .then((reply) => {
      const welcome = shaped(reply?.welcomeBack ?? null);
      const show = welcome && !alreadyShown(welcome) ? welcome : null;
      store.inFlight = null;
      publish(show);
      return show;
    })
    .catch(() => {
      store.inFlight = null;
      publish(null);
      return null;
    });

  return store.inFlight;
}

/** What the endpoint promises, checked before any of it is put on a screen.
    A reply missing the state it names would render a headline about nothing,
    and the safe answer to an unreadable record is silence — the dashboard is
    open either way, and a courtesy that fails must not fail loudly. */
const FROMS = new Set<WelcomeBackFrom>(["banned", "suspended", "deactivated", "deletion_pending"]);

function shaped(value: WelcomeBack | null | undefined): WelcomeBack | null {
  if (!value || typeof value !== "object") return null;
  if (!FROMS.has(value.from)) return null;
  if (typeof value.restoredAt !== "string" || typeof value.pausedAt !== "string") return null;
  return {
    from: value.from,
    reason: typeof value.reason === "string" && value.reason.trim() ? value.reason : null,
    actor: value.actor === "user" ? "user" : "admin",
    pausedAt: value.pausedAt,
    restoredAt: value.restoredAt,
    daysOff: Number(value.daysOff) || 0,
  };
}

/** Pressing Continue: tell the account it has been seen, so the next load
    isn't interrupted, and take the screen down. */
export async function acknowledgeWelcomeBack(welcome: WelcomeBack): Promise<void> {
  markShown(welcome);
  publish(null);
  try {
    await apiJson("/api/users/welcome-back/ack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch {
    /* The screen is already down and this browser won't ask again; the ack
       only exists to stop other devices seeing it, and a courtesy is not
       worth a second attempt. */
  }
}

/** A sign-out ends the account, so it ends the answer with it: whoever signs
    in next has their own restoration to be told about. */
export function resetWelcomeBack(): void {
  const store = shared();
  store.asked = false;
  store.inFlight = null;
  publish(null);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** The restoration to announce, or null. Rendering the dashboard is what this
    gate decides, so a read that hasn't answered yet is `null` — the screen is
    an interruption, and holding the whole app behind it while a courtesy
    loads would make it a much worse one. */
export function useWelcomeBack(): WelcomeBack | null {
  const key = useSyncExternalStore(subscribe, snapshotKey, () => "");
  useEffect(() => {
    void loadWelcomeBack();
  }, []);
  return key ? shared().value : null;
}

function snapshotKey(): string {
  return shared().key;
}

/* A sign-out — or an account switch in the same browser — wipes every trace
   of the account this device was holding, and announces it with this event
   (see lib/account-cache). The answer about *that* account's restoration goes
   with them: whoever signs in next has a restoration of their own to be told
   about, and a cached "nothing to say" would keep it from being said. */
if (typeof window !== "undefined") {
  window.addEventListener("tirbeo:session", () => resetWelcomeBack());
}
