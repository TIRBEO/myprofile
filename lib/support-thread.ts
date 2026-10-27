"use client";

/* ═══════════════════════════════════════════════════════════════════
   One support thread, from this side of it

   The mail that answers a request used to be the end of it: reading the
   answer was possible, replying meant filing a new request that arrived
   looking like a first one. This is the screen the answer links to — the
   same reference, both sides' words in order, and a box to write in.

   Nothing is stored here. The thread is the ledger rows the desk already
   has, and a follow-up is another row of the same shape, so the panel and
   this page cannot disagree about what was said.

   An hour away costs an identity proof before the next message goes out —
   the same check the account service asks for before it deletes anything.
   Reading is not gated that way: the link in a mail has to open.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";
import { withProof, type ReauthProof } from "@/lib/reauth";

export type ThreadFrom = "account" | "staff" | "system";

export type ThreadMessage = {
  id: string;
  from: ThreadFrom;
  kind: string;
  at: string;
  subject: string;
  text: string;
};

export type Thread = {
  ref: string;
  subject: string;
  status: "open" | "answered" | "closed";
  /** Whose turn it is, in the words the screen prints. */
  waitingOn: "you" | "the team" | null;
  askedAt: string | null;
  lastAt: string | null;
  closedAt: string | null;
  /** The service's own answer to "has this session been idle long enough to
      ask for a proof?" — the page says so before the Send button is pressed
      rather than refusing after. */
  needsReauth?: boolean;
  messages: ThreadMessage[];
};

export const MIN_REPLY = 2;
export const MAX_REPLY = 4000;

export async function loadThread(ref: string): Promise<Thread> {
  const res = await apiJson<{ thread: Thread }>(
    `/api/support/thread?ref=${encodeURIComponent(ref)}`,
  );
  return res.thread;
}

/** Write back. The proof is folded into the same body: a session that is
    recent enough ignores it, and one that is not spends it. */
export async function postFollowup(ref: string, message: string, proof: ReauthProof = {}): Promise<Thread> {
  const res = await apiJson<{ thread: Thread }>(`/api/support/thread/reply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withProof({ ref, message }, proof)),
  });
  return res.thread;
}

export async function closeThread(ref: string): Promise<Thread> {
  const res = await apiJson<{ thread: Thread }>(`/api/support/thread/close`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  return res.thread;
}

/** Who wrote it, in the words a reader expects. */
export function speaker(from: ThreadFrom): string {
  if (from === "staff") return "Tirbeo Support";
  if (from === "system") return "This thread";
  return "You";
}
