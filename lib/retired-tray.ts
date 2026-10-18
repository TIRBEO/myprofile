"use client";

/* ═══════════════════════════════════════════════════════════════════
   Retiring the recently-deleted tray

   This module used to be the tray's data source. It was the one invented
   thing in the app: on first read it wrote six example rows — a trip plan, a
   photo roll, an album — into this browser, because the screen needed
   something to show and there was nothing to show.

   Nothing in Tirbeo can put a row there. There is no content model: no
   notes, no albums, no files, no bookmarks, so no per-item delete exists, so
   no delete could ever land in a tray. The screen and its Restore button are
   deleted with it.

   What is left is the cleanup. Every browser that opened that page pushed
   those six fake rows into the account's settings bag, and the archive
   export reads whatever the bag holds — so a copy of somebody's data can
   still contain a trip plan they never wrote. Clearing it is the last job
   this file has.

   See also lib/docs-pack-b.ts, where the article that used to explain the
   tray now explains why there isn't one.
   ═══════════════════════════════════════════════════════════════════ */

import { ensureSettings, getStored, setStored } from "@/lib/remote-store";

/** The bag key the tray lived under. Still listed in lib/account-cache.ts,
    which is what takes it out when an account is signed out of. */
const TRAY = "tirbeo:your-activity:deleted";

/**
 * Empties a tray that was only ever full of examples.
 *
 * Waits for the bag so the answer it reads is the account's, not this
 * browser's stale mirror, and writes only when there is something to remove:
 * an empty tray is already the right value, and re-pushing it on every mount
 * would sync a no-op to the server for the rest of that person's time here.
 * Anything that is not an empty tray gets cleared, including a value shaped
 * like neither — this key holds nothing anybody needs, in any shape.
 *
 * Deliberately not `adoptLegacy` first. That would carry the leftover rows
 * from the raw slot up INTO the account — the opposite of the only job this
 * function has — and land a write of the fiction and a write of the empty
 * tray in flight together, where the server's reply decides which one stays.
 * `getStored` reads the raw slot itself, so one write clears both halves.
 *
 * If a real content model ever ships and starts writing this key, delete this
 * file: at that point the check below would be clearing somebody's live data.
 */
export function retireDeletedTray(): void {
  if (typeof window === "undefined") return;
  void ensureSettings().then(() => {
    const leftover = getStored<unknown>(TRAY, []);
    if (Array.isArray(leftover) && leftover.length === 0) return;
    setStored(TRAY, []);
  });
}
