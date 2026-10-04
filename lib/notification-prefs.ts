"use client";

/* ═══════════════════════════════════════════════════════════════════
   Email preferences, from the account service

   These choices used to live in this browser's localStorage, which meant
   a person paused mail on one laptop while the senders on the brain kept
   reading a different answer. The brain now owns the single truth
   (features/notifications/notifications.ts): every read and every write
   here goes to `/api/notifications/prefs`, and the PUT answers with the
   full merged preference object so the screen can settle on what the
   account actually holds rather than what it hoped to save.

   Security mail is deliberately absent: it cannot be opted out of, so
   there is no field to send. "Pause everything" is `emailPaused`, with
   `emailPausedUntil` as epoch ms or null for "until I say so" — a date
   already behind us reads as unpaused, exactly as the senders see it.

   This module is also the ONE reader. The notifications page and the
   settings hub both want the answer (the hub prints "Paused" beside its
   row), and each used to fetch it on its own mount — which is why the dev
   log showed the same GET twice over, once for the page and once for
   React's second effect pass. Now a read that is already in flight is the
   read every caller gets, and a just-landed answer is served from memory
   for a few seconds, so one visit to the account costs one round trip. The
   memory only ever holds what the brain answered — never a default, never a
   copy in localStorage — and a pull-to-refresh asks past it.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";

export type SummaryFrequency = "daily" | "weekly" | "monthly";

/** The fields this screen decides, as the merged prefs object carries them. */
export type EmailPrefs = {
  /** Non-essential mail held back entirely while true (see emailPausedUntil). */
  emailPaused: boolean;
  /** Epoch ms the pause lapses at; null = paused until turned back off. */
  emailPausedUntil: number | null;
  productEmail: boolean;
  offersEmail: boolean;
  tipsEmail: boolean;
  /** The one recurring account recap: whether it comes, and how often. */
  summaryEnabled: boolean;
  summaryFrequency: SummaryFrequency;
};

/** How long an answer the brain just gave stays good enough to hand out
    without another round trip. Short on purpose: it collapses the reads that
    happen in the same breath (two mounts, React's dev pass) while a reload a
    minute later still asks the account. */
const SHARED_READ_MS = 10_000;

let cached: EmailPrefs | null = null;
let cachedAt = 0;
let inFlight: Promise<EmailPrefs> | null = null;

/** The merged answer the brain holds becomes the shared answer, whoever got it. */
function adopt(prefs: EmailPrefs): EmailPrefs {
  cached = prefs;
  cachedAt = Date.now();
  return prefs;
}

/**
 * Read the account's preferences. Concurrent callers share one request, and a
 * read that landed less than `SHARED_READ_MS` ago is reused unless the caller
 * says `refresh` — which is what a pull-to-refresh means.
 */
export function readEmailPrefs(opts: { refresh?: boolean } = {}): Promise<EmailPrefs> {
  if (inFlight) return inFlight;
  if (!opts.refresh && cached && Date.now() - cachedAt < SHARED_READ_MS) {
    return Promise.resolve(cached);
  }
  const request = apiJson<EmailPrefs>("/api/notifications/prefs").then(
    (prefs) => {
      if (inFlight === request) inFlight = null;
      return adopt(prefs);
    },
    (err) => {
      // A failed read leaves nothing behind, so the next mount tries again
      // rather than handing out an answer that is now stale.
      if (inFlight === request) inFlight = null;
      throw err;
    },
  );
  inFlight = request;
  return request;
}

/** Writes a patch and returns the account's FULL merged prefs, so the
    caller can adopt the server's answer instead of guessing at it. The merged
    reply is what every other reader sees too — a "Paused" badge on the hub
    next to the switch that just moved is the same answer, not a stale one. */
export function saveEmailPrefs(patch: Partial<EmailPrefs>): Promise<EmailPrefs> {
  return apiJson<EmailPrefs>("/api/notifications/prefs", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).then(adopt);
}
