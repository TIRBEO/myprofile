"use client";

/* ═══════════════════════════════════════════════════════════════════
   "Was this helpful?"

   The answer is kept on this device against the article's slug, so the
   page can remember it and change the question into a confirmation with-
   out a round trip, and it rides the settings bag up to the account on
   the next persist — stored, but not tallied anywhere: the row on the
   article says "Noted", which is exactly what it is.

   A "no" is the one answer that leads somewhere: it offers the support
   form with this article already attached to the request.
   ═══════════════════════════════════════════════════════════════════ */

import { adoptLegacy, getStored, setStored } from "@/lib/remote-store";

const STORE = "tirbeo:docs-helpful";

export type DocVote = "yes" | "no";

function readAll(): Record<string, DocVote> {
  if (typeof window === "undefined") return {};
  // Carry a pre-sync vote onto the account once, then read the bag.
  adoptLegacy(STORE);
  const parsed = getStored<Record<string, unknown>>(STORE, {});
  const out: Record<string, DocVote> = {};
  for (const [key, value] of Object.entries(parsed ?? {})) {
    if (value === "yes" || value === "no") out[key] = value;
  }
  return out;
}

export function readVotes(): Record<string, DocVote> {
  return readAll();
}

/** Setting it to the value it already holds clears the answer, which is what
    a second tap on the same button means. */
export function setVote(slug: string, vote: DocVote): Record<string, DocVote> {
  const all = readAll();
  if (all[slug] === vote) delete all[slug];
  else all[slug] = vote;
  setStored(STORE, all);
  return all;
}
