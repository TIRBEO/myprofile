"use client";

/* ═══════════════════════════════════════════════════════════════════
   "Was this helpful?"

   The answer is kept on this device against the article's slug, so the
   page can remember it and change the question into a confirmation with-
   out a round trip. There is no server to send it to in this build, and
   the row on the article says that plainly rather than implying someone
   is reading the tally.

   A "no" is the one answer that leads somewhere: it offers the support
   form with this article already attached to the request.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:docs-helpful";

export type DocVote = "yes" | "no";

function readAll(): Record<string, DocVote> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, DocVote> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === "yes" || value === "no") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
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
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* private mode — the answer holds for this visit and no longer */
  }
  return all;
}
