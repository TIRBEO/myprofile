"use client";

/* ═══════════════════════════════════════════════════════════════════
   Support requests

   This build has no message server, so a request is written down here,
   in this browser, and stays here. The list is the record a person can
   read back — not a queue anything is watching. Wire `add` to the
   support API when one exists and nothing else has to change.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:support-requests";

export const MAX_REQUESTS = 20;
export const MIN_MESSAGE = 20;
export const MAX_MESSAGE = 800;

/** Where the request was written from, so a later reader can tell "the person
    hit this on the backup-codes page" from "this came in cold". */
export type RequestOrigin = { slug: string; title: string; kind: "article" | "policy" };

export type SupportRequest = {
  id: string;
  at: number;
  topic: string;
  message: string;
  origin?: RequestOrigin;
};

function readStored(): SupportRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<SupportRequest>[];
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
        origin:
          item.origin && typeof item.origin.slug === "string" && typeof item.origin.title === "string"
            ? item.origin
            : undefined,
      }));
  } catch {
    return [];
  }
}

export function readRequests(): SupportRequest[] {
  return readStored().sort((a, b) => b.at - a.at);
}

export function addRequest(
  topic: string,
  message: string,
  origin?: RequestOrigin,
): SupportRequest[] {
  const next: SupportRequest = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    topic,
    message: message.trim(),
    origin,
  };
  const stored = [next, ...readStored()].slice(0, MAX_REQUESTS);
  try {
    localStorage.setItem(STORE, JSON.stringify(stored));
  } catch {
    /* private mode — the request holds for this visit and no longer */
  }
  return readRequests();
}
