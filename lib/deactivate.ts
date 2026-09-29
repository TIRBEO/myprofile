"use client";

import { closeRequest, openRequest } from "@/lib/account-history";

/* ═══════════════════════════════════════════════════════════════════
   Temporary deactivation

   The other way out, and the one most people actually want: the profile
   stops existing in public, every session ends, and nothing is deleted.
   Like the deletion schedule, the only thing kept is the record that you
   asked — plus the reason you gave, so the page can show the same answer
   back to you if you come back to reactivate. Signing in again, here or
   on any device, is what reverses it.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:account-deactivation";

export type Deactivation = {
  /** When the profile went away. */
  at: number;
  /** The reason picked on the way out. */
  reason: string;
};

/** Why someone walks away for a while, in their words. */
export const REASONS = [
  "I'm taking a break from Tirbeo",
  "I have too many other things to do",
  "I'm not seeing anything I like",
  "I saw too much content I don't like",
  "My posts aren't getting seen",
  "Something else",
];

export function readDeactivation(): Deactivation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Deactivation>;
    if (typeof parsed?.at !== "number" || typeof parsed?.reason !== "string") return null;
    return { at: parsed.at, reason: parsed.reason };
  } catch {
    return null;
  }
}

/** Hides the profile and returns the record of it being hidden. */
export function deactivate(reason: string): Deactivation {
  const record: Deactivation = { at: Date.now(), reason };
  try {
    localStorage.setItem(STORE, JSON.stringify(record));
  } catch {
    /* private mode — the deactivation still holds for this session */
  }
  openRequest("deactivation", "deactivation");
  return record;
}

/** Signs back in from wherever the profile was hidden. */
export function reactivate(): null {
  try {
    localStorage.removeItem(STORE);
  } catch {
    /* private mode — nothing to clear */
  }
  closeRequest("deactivation", "restored");
  return null;
}
