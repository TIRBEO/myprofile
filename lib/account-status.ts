"use client";

import { openRequest } from "@/lib/account-history";

/* ═══════════════════════════════════════════════════════════════════
   Account status

   The screen that answers "is my account in good standing, and if not,
   what exactly is wrong." Nothing here is decided by this app — there's
   no review server yet — so this is the shape the API will hand back
   later, with representative rows standing in.

   Everything on this page is about the account itself: what was blocked,
   what's limited, what's waiting on an answer from you. Nothing here
   counts posts, comments or likes, because none of that is measured yet.
   Asking for a review is the one action, and it's a written explanation,
   so it gets a page with a box to type in rather than a button that
   decides on its own.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:account-status:appeals";

export type Severity = "ok" | "warning" | "action";

/** One line under a status heading — a block, a limit, a check. */
export type StatusItem = {
  id: string;
  title: string;
  sub: string;
  /** The rule it was judged against, shown as its own line. */
  guideline: string;
  at: number;
  /** Whether a review can still be requested for this item. */
  appealable: boolean;
  /** What a review is being asked to change, said back to you. */
  ask: string;
};

export type StatusSection = {
  id: string;
  title: string;
  /** The one-line verdict shown at the top of the section. */
  summary: string;
  severity: Severity;
  items: StatusItem[];
};

/** A review you've asked for, and what you said in it. */
export type Appeal = { id: string; at: number; note: string };

/** How a decision reads in the list and on its detail page. A review that's
    been filed, a limit still open to you, and a decision that's closed all
    read differently — but only through the theme's text tokens, never a fill. */
export type DecisionTone = "warn" | "danger" | "muted";

/** The one status word a decision carries, derived from its live state. */
export function decisionStatus(
  item: StatusItem,
  appeal: Appeal | null,
): { word: string; tone: DecisionTone } {
  if (appeal) return { word: "Under review", tone: "warn" };
  if (item.appealable) return { word: "Needs action", tone: "danger" };
  return { word: "Final", tone: "muted" };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function sections(): StatusSection[] {
  const now = Date.now();
  return [
    {
      id: "standing",
      title: "Account standing",
      summary: "Your account is in good standing.",
      severity: "ok",
      items: [],
    },
    {
      id: "sign-ins",
      title: "Sign-ins we stopped",
      summary: "2 attempts were blocked before they got into your account.",
      severity: "warning",
      items: [
        {
          id: "blocked-lagos",
          title: "A sign-in was blocked",
          sub: "26 Sept 2026. Three wrong passwords in a row from an address that had never reached your account.",
          guideline: "Automated protection — repeated wrong passwords",
          at: now - 1 * DAY,
          appealable: true,
          ask: "Tell us it was you and we'll stop holding that network back.",
        },
        {
          id: "held-new-device",
          title: "A new device was held for a code",
          sub: "14 Sept 2026. The password was right, so it waited for a two-factor code before it got in.",
          guideline: "Two-factor — first sign-in on a new device",
          at: now - 13 * DAY,
          appealable: false,
          ask: "",
        },
      ],
    },
    {
      id: "limits",
      title: "What's limited right now",
      summary: "Two parts of the account are on hold until something is confirmed.",
      severity: "action",
      items: [
        {
          id: "changes-on-hold",
          title: "Account changes are on hold",
          sub: "Details can't be edited until the new email address is confirmed. Everything else works as normal.",
          guideline: "Verification — unconfirmed email address",
          at: now - 4 * DAY,
          appealable: true,
          ask: "Explain why the confirmation isn't reaching you and we'll check the address by hand.",
        },
        {
          id: "recovery-stale",
          title: "Recovery details need re-confirming",
          sub: "Since 3 Sept 2026. The phone number on the account hasn't been checked in two years.",
          guideline: "Recovery — stale phone number",
          at: now - 24 * DAY,
          appealable: false,
          ask: "",
        },
      ],
    },
    {
      id: "checks",
      title: "Checks waiting on you",
      summary: "One thing needs an answer from you before it closes.",
      severity: "action",
      items: [
        {
          id: "confirm-pokhara",
          title: "Confirm whether a sign-in was yours",
          sub: "Opened 2 days ago. A sign-in from Pokhara was marked as not you, and nothing has said otherwise since.",
          guideline: "Security — sign-in reported by you",
          at: now - 2 * DAY,
          appealable: true,
          ask: "Say it was you and the report closes. Say it wasn't and the password reset stays in force.",
        },
      ],
    },
    {
      id: "discovery",
      title: "What stops people finding your account",
      summary: "Nothing here is blocking your account from being found.",
      severity: "ok",
      items: [],
    },
  ];
}

/** One section by its id, for the page that lists just its decisions. */
export function findSection(id: string | undefined): StatusSection | null {
  if (!id) return null;
  return sections().find((section) => section.id === id) ?? null;
}

/** One decision, looked up through the section it sits under. */
export function findItem(
  sectionId: string | undefined,
  itemId: string | undefined,
): { section: StatusSection; item: StatusItem } | null {
  const section = findSection(sectionId);
  const item = section?.items.find((row) => row.id === itemId);
  return section && item ? { section, item } : null;
}

/** Where a decision lives, when all you have is its id — which is what a
    review request keeps. Lets the history page link straight to it. */
export function findItemById(itemId: string): { section: StatusSection; item: StatusItem } | null {
  for (const section of sections()) {
    const item = section.items.find((row) => row.id === itemId);
    if (item) return { section, item };
  }
  return null;
}

export function readAppeals(): Appeal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is Appeal =>
        typeof row?.id === "string" && typeof row?.at === "number" && typeof row?.note === "string",
    );
  } catch {
    return [];
  }
}

/** The review filed for one decision, if there is one. */
export function appealFor(id: string): Appeal | null {
  return readAppeals().find((appeal) => appeal.id === id) ?? null;
}

/** Files a review request with what you wrote, and returns the full list. */
export function appeal(id: string, note: string): Appeal[] {
  const next = [
    ...readAppeals().filter((appeal) => appeal.id !== id),
    { id, at: Date.now(), note: note.trim() },
  ];
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    /* private mode — the appeal still holds for this session */
  }
  openRequest(id, "appeal");
  return next;
}
