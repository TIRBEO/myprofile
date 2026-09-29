"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   The account's own requests, and what became of them

   Everything here is a record of something this account asked for and
   then either undid or left standing: a pause, a deletion, a review
   request on a decision. Nothing is invented — a row is open because the
   thing it asked for is still in force, and it is closed because someone
   closed it, with the moment recorded.

   That's why the history page can honestly say "restored" or "reversed"
   rather than a status nobody could have observed.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:account-requests";

/** Every account state — the pause, the deletion, the review — goes through
    this module, so this is the one event the gate has to listen to. */
export const ACCOUNT_EVENT = "tirbeo:account-state";

export type RequestKind = "deactivation" | "deletion" | "appeal";

export type RequestOutcome = "open" | "restored" | "reversed" | "reviewed";

export type AccountRequest = {
  /** Deactivations and deletions have one open row at a time; an appeal is
      filed against a decision, so its id is the decision's. */
  id: string;
  kind: RequestKind;
  at: number;
  /** null while the request is still in force. */
  closedAt: number | null;
  outcome: RequestOutcome;
};

export const OUTCOME_LABEL: Record<RequestOutcome, string> = {
  open: "Still in force",
  restored: "Restored",
  reversed: "Reversed",
  reviewed: "Sent for review",
};

export const KIND_LABEL: Record<RequestKind, string> = {
  deactivation: "Deactivation",
  deletion: "Account deletion",
  appeal: "Appeal",
};

/** What a closed row says about itself, in the tense that matches. */
export const OUTCOME_SENTENCE: Record<RequestOutcome, string> = {
  open: "This is what the account looks like right now.",
  restored: "Signed back in, and everything that was kept came back.",
  reversed: "The close was called off before it became final.",
  reviewed: "The note went in, and the decision is waiting on a reading of it.",
};

export const REQUEST_KINDS: RequestKind[] = ["deactivation", "deletion", "appeal"];

function read(): AccountRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is AccountRequest =>
        typeof row?.id === "string" &&
        typeof row?.at === "number" &&
        (row?.closedAt === null || typeof row?.closedAt === "number") &&
        REQUEST_KINDS.includes(row.kind) &&
        row.outcome in OUTCOME_LABEL,
    );
  } catch {
    return [];
  }
}

function write(list: AccountRequest[]): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    /* private mode — the request still holds for this session */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

/** Newest first, which is the only order a list of requests reads well in. */
export function readRequests(): AccountRequest[] {
  return read().sort((a, b) => b.at - a.at);
}

/** Adds a request, replacing any open row for the same id so re-doing
    something doesn't leave two copies of it standing. */
export function openRequest(id: string, kind: RequestKind): AccountRequest {
  const row: AccountRequest = { id, kind, at: Date.now(), closedAt: null, outcome: "open" };
  write([row, ...read().filter((existing) => existing.id !== id)]);
  return row;
}

/** Marks a request as no longer in force. Returns whether there was one. */
export function closeRequest(id: string, outcome: RequestOutcome): boolean {
  const list = read();
  const at = list.findIndex((row) => row.id === id && row.closedAt === null);
  if (at < 0) return false;
  list[at] = { ...list[at], closedAt: Date.now(), outcome };
  write(list);
  return true;
}

export function requestFor(id: string): AccountRequest | null {
  return read().find((row) => row.id === id) ?? null;
}

export function countRequests(): { total: number; open: number } {
  const list = read();
  return { total: list.length, open: list.filter((row) => row.closedAt === null).length };
}

/** The log, newest first, re-read whenever a request is filed or closed —
    which is any change to the account's own state, wherever it happens. */
export function useRequests(): AccountRequest[] {
  const [list, setList] = useState<AccountRequest[]>([]);
  useEffect(() => {
    const look = () => setList(readRequests());
    look();
    window.addEventListener(ACCOUNT_EVENT, look);
    window.addEventListener("storage", look);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, look);
      window.removeEventListener("storage", look);
    };
  }, []);
  return list;
}
