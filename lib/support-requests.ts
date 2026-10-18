"use client";

/* ═══════════════════════════════════════════════════════════════════
   Support requests

   A request goes to the account: `POST /api/support/tickets/create`, which
   is the support desk this build has — one written explanation attached to
   one decision on the account (`user_appeals`), answered with the row it
   made and what the reviewer has since decided. `GET
   /api/support/tickets/appeals` reads them back, so a second device sees the
   same request the first one filed. The per-ticket endpoints beside them
   (`/api/support/tickets/{id}`, `/reply`, `/close`) are answered 410 by the
   API, so nothing here asks them: the list carries the whole row.

   Two things the endpoint cannot hold stay on this device, and the screen
   says so rather than implying a reader has them: the topic the request was
   filed under, and the article or policy page it was written from.

   A write that did not land is never dropped. It keeps its drafted text in
   the settings bag as `pending` (the network refused) or `failed` (the
   account refused, with its sentence attached), and the same screen that
   wrote it offers to send it again.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";
import { adoptLegacy, getStored, setStored } from "@/lib/remote-store";
import { loadAccountChecks, sections, type StatusItem } from "@/lib/account-status";

const STORE = "tirbeo:support-requests";

export const MAX_REQUESTS = 20;
/** The desk's own floor and ceiling for one explanation (40 to 900
    characters) — asked here so the note lands under the box instead of
    arriving back as a refusal. */
export const MIN_MESSAGE = 40;
export const MAX_MESSAGE = 800;

/** Where the request was written from, so a later reader can tell "the person
    hit this on the backup-codes page" from "this came in cold". Kept locally:
    the endpoint stores the explanation and nothing else. */
export type RequestOrigin = { slug: string; title: string; kind: "article" | "policy" };

/** `sent` is on the account. `pending` never left the device (offline, or no
    answer), `failed` reached it and was refused — both keep their text. */
export type SupportState = "sent" | "pending" | "failed";

export type SupportRequest = {
  id: string;
  at: number;
  topic: string;
  message: string;
  origin?: RequestOrigin;
  state: SupportState;
  /** The row the account made, printed as the reference a person quotes. */
  reference?: string;
  /** What the reviewer has done with it: nothing yet, upheld, overturned. */
  status?: string;
  /** Why it has not landed, in the account's own words. */
  error?: string;
  /** When the desk's refusal needs a sentence rather than a machine phrase:
      a request with no decision to argue with is what this build's support
      endpoint cannot take, and saying only "restrictionId is required" would
      hand the reader a field name to guess at. */
  reason?: string;
  /** The decision this request argues with, named for the screen. */
  decision?: string;
};

/** What the desk's list endpoint answers — one appeal row plus the decision
    it argues with. Mirrors `features/support/appeals.ts` on the API. */
type ServerAppeal = {
  id: string;
  restrictionId: string;
  note: string;
  decision: string | null;
  createdAt: string;
  decidedAt: string | null;
  restriction: { title: string; guideline: string; severity: string } | null;
};

/** The create endpoint's answer. */
type CreatedTicket = { ok: boolean; appeal: ServerAppeal };

/** The bag's answer, which for a while was the only answer: rows written
    before this build had a server carry no state at all. */
function readStored(): SupportRequest[] {
  if (typeof window === "undefined") return [];
  adoptLegacy(STORE);
  const parsed = getStored<unknown>(STORE, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (item): item is SupportRequest =>
        typeof item?.id === "string" &&
        typeof item?.at === "number" &&
        typeof item?.topic === "string" &&
        typeof item?.message === "string",
    )
    .map((item) => ({
      ...item,
      /* Nothing in the bag is confirmed until the account says so, so an
         unlabelled older row reads as "written, never sent". */
      state: item.state === "sent" || item.state === "failed" || item.state === "pending"
        ? item.state
        : "pending",
      origin:
        item.origin && typeof item.origin.slug === "string" && typeof item.origin.title === "string"
          ? item.origin
          : undefined,
    }));
}

/** Only the rows that still have to reach the desk. Sent ones live there. */
function writeQueue(list: SupportRequest[]): void {
  const unsent = list.filter((row) => row.state !== "sent").slice(0, MAX_REQUESTS);
  setStored(STORE, unsent);
}

/** Same explanation, said the way the account would say it back: the queue and
    the desk's list are matched on this, so a request that landed is read from
    the desk and not shown twice. */
function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function shapeAppeal(row: ServerAppeal): SupportRequest {
  return {
    id: row.id,
    at: Date.parse(row.createdAt) || Date.now(),
    // The desk's own record is the explanation; the topic chip is local colour.
    topic: row.restriction?.title ?? "Review of a decision on your account",
    message: row.note,
    state: "sent",
    reference: row.id,
    status: row.decision ?? "pending",
    decision: row.restriction?.title,
  };
}

/** The decision a request can be attached to.
    The desk only takes an explanation that argues with a real decision, so the
    account's own checks are asked for one that is still open. A read that
    cannot be made is not an error to report here — it just means no decision
    is known, and the create call's own answer says what the desk thought of
    that. */
async function openDecision(): Promise<StatusItem | null> {
  try {
    await loadAccountChecks();
  } catch {
    /* Fall back to the checks the account last sent. */
  }
  for (const section of sections()) {
    for (const item of section.items) {
      if (item.appealable) return item;
    }
  }
  return null;
}

/** Sends one explanation to the desk. Returns the row as it now stands, with
    `sent` decided by the account rather than by the request having been made. */
async function send(row: SupportRequest): Promise<SupportRequest> {
  const note = row.message.trim();
  const decision = await openDecision();
  try {
    const reply = await apiJson<CreatedTicket>("/api/support/tickets/create", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      /* Only the fields the desk reads. It answers 400 for a missing
         restrictionId and 409 when one already has a review — both are shown
         as the account's own sentence rather than turned into a success. */
      body: JSON.stringify({
        restrictionId: decision?.id ?? "",
        note,
      }),
    });
    const shaped = shapeAppeal(reply.appeal);
    return {
      ...row,
      ...shaped,
      topic: row.topic,
      origin: row.origin,
      state: "sent",
      error: undefined,
      decision: shaped.decision ?? decision?.title,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "The desk did not answer, so nothing was filed.";
    return {
      ...row,
      state: "failed",
      error: message,
      /* A refusal worded as a column name is not something a reader can act
         on, so the shape of what the desk takes is said alongside it. */
      reason: decision
        ? undefined
        : "The desk takes a message that argues with a decision on your account — a ban, a suspension, a limit in force. This account has no such decision, so there was nothing to attach this to and nothing was filed.",
    };
  }
}

/** The list as it now stands: what the desk holds, plus anything this device
    still owes. One `error` when the desk could not be reached at all, so the
    screen can say the list may be incomplete instead of showing a quiet
    "nothing asked yet" over a network that timed out. */
export async function loadRequests(): Promise<{ requests: SupportRequest[]; error: string | null }> {
  const queue = readStored();
  let appeals: ServerAppeal[] | null = null;
  let failure: string | null = null;
  try {
    const reply = await apiJson<{ ok: boolean; appeals: ServerAppeal[] }>(
      "/api/support/tickets/appeals",
    );
    appeals = reply.appeals ?? [];
  } catch (error) {
    failure =
      error instanceof Error && error.message.trim()
        ? error.message
        : "The support desk could not be reached.";
  }

  const sent = (appeals ?? []).map(shapeAppeal);
  /* A queued row the desk now has is dropped from the queue — it landed, and
     it is read back from the desk with its reference and status. */
  const stillOurs = queue.filter(
    (row) => !sent.some((server) => sameText(server.message, row.message)),
  );
  if (stillOurs.length !== queue.length) writeQueue(stillOurs);

  return {
    requests: [...sent, ...stillOurs].sort((a, b) => b.at - a.at),
    error: failure,
  };
}

export function readRequests(): SupportRequest[] {
  return readStored().sort((a, b) => b.at - a.at);
}

/** Files a request. The drafted text is written to the queue first, so a page
    that closes, a device that goes offline, or a desk that refuses the note
    cannot lose what was typed; the queue row is then replaced by the account's
    answer. */
export async function submitRequest(
  topic: string,
  message: string,
  origin?: RequestOrigin,
): Promise<{ row: SupportRequest; sent: boolean; error?: string }> {
  const draft: SupportRequest = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    topic,
    message: message.trim(),
    origin,
    state: "pending",
  };
  writeQueue([draft, ...readStored()]);

  const row = await send(draft);
  const queue = readStored().filter((item) => item.id !== row.id);
  writeQueue(row.state === "sent" ? queue : [row, ...queue]);
  return { row, sent: row.state === "sent", error: row.error };
}

/** Sends a queued request again, from the screen that wrote it. */
export async function retryRequest(id: string): Promise<{ row: SupportRequest | null; sent: boolean; error?: string }> {
  const draft = readStored().find((row) => row.id === id);
  if (!draft) return { row: null, sent: false, error: "That request is not on this device any more." };

  const row = await send({ ...draft, error: undefined });
  const queue = readStored().filter((item) => item.id !== id);
  writeQueue(row.state === "sent" ? queue : [row, ...queue]);
  return { row, sent: row.state === "sent", error: row.error };
}

/** The one word a person reading the list wants: has anyone said anything
    back yet. */
export function statusWords(status?: string): string {
  switch (status) {
    case undefined:
    case null:
    case "pending":
      return "Filed — nobody has read it yet";
    case "upheld":
      return "Read — the decision stands";
    case "overturned":
      return "Read — the decision was changed";
    default:
      return `Read — ${status}`;
  }
}
