"use client";

/* ═══════════════════════════════════════════════════════════════════
   One account's traces, gone when the account is

   Several screens keep a local copy of what the account told them: the
   profile the header shows, the settings bag that mirrors the account's
   choices, the device log, the answers ticked on login-activity rows,
   the appeal and export requests, the recently-deleted tray. They are
   caches of a SPECIFIC account, but localStorage is keyed by this browser
   alone — so signing out and signing in as somebody else in the same tab
   used to paint the first person's name, email and history over the
   second person's account. Worse, a screen that trusts a stale email will
   mail a deletion code to the address on the account and tell you it went
   to the one on the screen.

   Two doors fix it, and both are here:

     • logout clears every trace — endSession() calls clearAccountTraces()
     • an account switch clears them too — bindAccount() runs on every
       profile the account itself sends back, and wipes when the id it
       carries isn't the id the traces belong to

   Deliberately NOT on the list: theme and language (this device's own
   choices, not the account's record), the docs guides and their
   helpful-fingers (about the docs, not the person), and the translation
   cache (keyed by content). Wiping those would punish a second account
   for nothing.
   ═══════════════════════════════════════════════════════════════════ */

/** Every localStorage key that holds one account's data in this browser. */
const ACCOUNT_TRACES = [
  "tirbeo:edit-profile", // the profile cache — the name and email every header reads
  "tirbeo:settings-bag", // the local mirror of the account's settings
  "tirbeo:account-requests", // export and deletion requests raised from here
  "tirbeo:account-deactivation", // the "you paused this" record
  "tirbeo:account-status:appeals", // the account's appeals, as last read from the brain
  "tirbeo:account-status:checks", // the account's checks, as last read from the brain
  "tirbeo:account-status:skipped", // which notices were dismissed
  "tirbeo:devices:log", // sign-out notes shown on the devices screen
  "tirbeo:login-activity:answers", // was-this-you answers
  "tirbeo:narration", // per-account voice-over choices
  "tirbeo:support-requests", // support tickets opened from here
  "tirbeo:your-activity:deleted", // the recently-deleted tray
  "tirbeo:welcome-back", // the one-time welcome note
  "tirbeo:token-user", // the cached token's copy of who is signed in
];

/** Which account the traces above belong to. */
const OWNER_KEY = "tirbeo:account-id";

/**
 * Drop everything this browser knows about the account it was holding.
 *
 * A removeItem on one key is a silent no-op when localStorage is
 * unavailable (private mode, quota), and the whole point is that nothing of
 * the old account survives — so every key is rewritten to "" and removed
 * again. That's the trick the session layer already uses to make the change
 * visible to other tabs through the storage event.
 */
export function clearAccountTraces(): void {
  if (typeof window === "undefined") return;
  for (const key of [...ACCOUNT_TRACES, OWNER_KEY]) {
    try {
      if (window.localStorage.getItem(key) === null) continue;
      window.localStorage.setItem(key, "");
      window.localStorage.removeItem(key);
    } catch {
      /* private mode — nothing was persisted anyway */
    }
  }
  // In-memory copies of the same data, held by the modules that read them.
  for (const name of ["tirbeo:account-state", "tirbeo:profile", "tirbeo:session"]) {
    try {
      window.dispatchEvent(new Event(name));
    } catch {
      /* nothing listening */
    }
  }
}

/**
 * Say which account the traces now belong to, wiping whatever was there if
 * that changed. Call it with the id the account row itself sent back — never
 * with anything a screen guessed — because this is the only thing standing
 * between a shared browser and the previous person's data.
 *
 * An empty id is read as "the server didn't say", not "nobody is signed in":
 * it leaves the traces alone. Sign-out is a separate, deliberate act and
 * calls clearAccountTraces() itself.
 *
 * Returns true when it cleared.
 */
export function bindAccount(id: string | null | undefined): boolean {
  if (typeof window === "undefined" || !id) return false;
  let previous: string | null = null;
  try {
    previous = window.localStorage.getItem(OWNER_KEY);
  } catch {
    return false;
  }
  if (previous === id) return false;

  clearAccountTraces();
  try {
    window.localStorage.setItem(OWNER_KEY, id);
  } catch {
    /* private mode — the wipe still happened for this session */
  }
  return true;
}

/** The account the local traces belong to, if any. */
export function boundAccount(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
