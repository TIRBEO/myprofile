"use client";

/* ═══════════════════════════════════════════════════════════════════
   Activity log — changes to the account itself

   This is the account's own record, read from the server that keeps it:
   every change row in the activity ledger, newest first, with the machine
   it arrived on, the network address behind that and the instant it landed.

   What the record does *not* hold is the old value and the new one. A change
   says which field moved, not what it moved from or to — so this page says
   which field moved, and never shows a before/after it doesn't have. The one
   value that is never written down anywhere is the password itself.

   The answer to "was this you" is sent to the server and kept as a record of
   its own, in the same ledger as the change it is about. That is what makes
   it worth having: it survives the device it was given on, it is dated by the
   server rather than the clock on the phone, and changing it leaves both the
   new answer and the fact that there was an older one.
   ═══════════════════════════════════════════════════════════════════ */

import { ApiError, apiJson, apiSend } from "@/lib/api";
import { coordsOf } from "@/lib/coords";
import { dayLabel } from "@/lib/dates";

/** How many of the newest changes a page shows. The log itself keeps every
    one; this is only how far the list reaches before it asks for more. */
export const PAGE = 50;

/** The owner's answer to "was this you" — absent means unanswered. */
export type YouSaid = "recognised" | "not-me";

export type ChangeEntry = {
  id: string;
  at: number;
  /** The machine name the server wrote for this change — free-form, so the
      page reads `title` rather than switching on it. */
  kind: string;
  title: string;
  /** Which fields the change touched. Empty means the record only knows that
      something of this kind happened. */
  fields: string[];
  severity: string;
  device: string;
  location: string | null;
  ip: string | null;
  /** The point the edge resolved that address to. Absent means no map, not a
      map somewhere else — the page shows the words it has instead. */
  coords?: [number, number] | null;
  youSaid?: YouSaid;
  youSaidAt?: number;
};

type ChangeRow = {
  id: string;
  kind: string;
  title: string;
  fields: string[];
  severity: string;
  at: string;
  ip: string | null;
  device: string;
  location: string | null;
  coords?: [number, number] | null;
  said: { answer: string; at: string } | null;
};

function toEntry(row: ChangeRow): ChangeEntry {
  return {
    id: row.id,
    at: Date.parse(row.at),
    kind: row.kind,
    title: row.title,
    fields: Array.isArray(row.fields) ? row.fields.filter((f) => typeof f === "string") : [],
    severity: row.severity,
    device: row.device || "an unknown device",
    location: row.location ?? null,
    ip: row.ip ?? null,
    coords: coordsOf(row.coords),
    youSaid: row.said?.answer === "not-me" ? "not-me" : row.said ? "recognised" : undefined,
    youSaidAt: row.said ? Date.parse(row.said.at) : undefined,
  };
}

/** The account's changes, newest first. Sign-ins are not here — they have a
    page of their own, and mixing them in would hide the edits under a pile of
    ordinary mornings. */
export async function readChanges(limit = PAGE): Promise<ChangeEntry[]> {
  const reply = await apiJson<{ changes: ChangeRow[] }>(`/api/user/changes?limit=${limit}`);
  return (reply.changes || []).map(toEntry).sort((a, b) => b.at - a.at);
}

/** One change by its id, for the page that shows nothing but it. A change
    that isn't in this account's history reads as missing, not as an error —
    but a service that 500s or doesn't answer is an error, and saying "that
    change isn't in your history" over a blip would tell someone their own
    record had vanished. Only a 404 is allowed to read as missing. */
export async function findChange(id: string | undefined): Promise<ChangeEntry | null> {
  if (!id) return null;
  try {
    const reply = await apiJson<{ change: ChangeRow }>(`/api/user/changes/${id}`);
    return reply.change ? toEntry(reply.change) : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Write the answer to the account, then read the record back — the server
    dates it, and `null` is an answer too: it records that the owner took the
    mark back, and the ledger keeps the fact that one was given. */
export async function answerChange(id: string, answer: YouSaid | null): Promise<ChangeEntry | null> {
  await apiSend(`/api/user/changes/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) });
  /* The answer is written; a failure to read it back is the page's business,
     not a reason to claim the answer itself was never saved. */
  return findChange(id).catch(() => null);
}

/**
 * Entries under a heading per day. The list spans months, so every change
 * keeps its own date rather than collapsing into one "Earlier" block.
 */
export function byDay(entries: ChangeEntry[]): { day: string; entries: ChangeEntry[] }[] {
  const groups: { day: string; entries: ChangeEntry[] }[] = [];
  for (const entry of entries) {
    const day = dayLabel(entry.at);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}
