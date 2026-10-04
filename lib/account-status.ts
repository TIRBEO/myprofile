"use client";

import { apiJson } from "@/lib/api";
import { ACCOUNT_EVENT, openRequest, type RequestKind } from "@/lib/account-history";

/* ═══════════════════════════════════════════════════════════════════
   Account status — the real checks, from the account

   The screen that answers "is my account in good standing, and if not,
   what exactly is wrong." Every number on it comes from /api/user/
   account-checks on the brain, which counts only what each label says:

     • Account standing ......... the account's own status + the admin's
                                  number
     • Sign-ins we stopped ...... stopped sign-in attempts that were never
                                  followed by getting in
     • What's limited right now . restrictions still in force
     • Checks waiting on you .... notices waiting on an answer from you
     • What stops people finding
       your account ............. discovery restrictions

   A brand-new account has nothing in any of those tables, so every check
   reads 0 and the page reads as a quiet all-clear. Nothing is invented
   here anymore — no stand-in rows, no counts from this browser.

   The last snapshot the account sent back is kept so the settings gate
   can answer synchronously between loads; before the first reply lands
   the default is the same answer a clean account gets: five empty checks.

   Filing a review is the one action: it goes to the brain (POST
   /api/support/appeal) and attaches to a real restriction, and the
   account's appeals are read back from the brain too — so a second
   device sees the same review that the first one filed.
   ═══════════════════════════════════════════════════════════════════ */

const CHECKS_STORE = "tirbeo:account-status:checks";
const APPEALS_STORE = "tirbeo:account-status:appeals";

export type Severity = "ok" | "warning" | "action";

/** One line under a status heading — a block, a limit, a check. */
export type StatusItem = {
  id: string;
  title: string;
  sub: string;
  /** The rule it was judged against, shown as its own line. */
  guideline: string;
  at: number;
  /** Whether a review can still be requested for this item. Only a real
      restriction can carry an appeal, and only once. */
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

/** A review you've asked for, as the account holds it. `id` is the appeal
    row; `restrictionId` is the decision it argues with. */
export type Appeal = {
  id: string;
  restrictionId: string;
  at: number;
  note: string;
  /** null while nobody has read it yet. */
  decision: "pending" | "upheld" | "overturned" | null;
};

/** How a decision reads in the list and on its detail page. */
export type DecisionTone = "warn" | "danger" | "muted";

/** The one status word a decision carries, derived from its live state. */
export function decisionStatus(
  item: StatusItem,
  appeal: Appeal | null,
): { word: string; tone: DecisionTone } {
  if (appeal?.decision === "overturned") return { word: "Lifted", tone: "muted" };
  if (appeal?.decision === "upheld") return { word: "Final", tone: "muted" };
  if (appeal) return { word: "Under review", tone: "warn" };
  if (item.appealable) return { word: "Needs action", tone: "danger" };
  return { word: "Final", tone: "muted" };
}

/* ── The five checks, in the order the page lists them ──────────── */

type SectionId = "standing" | "sign-ins" | "limits" | "checks" | "discovery";

const SECTION_TITLES: Record<SectionId, string> = {
  standing: "Account standing",
  "sign-ins": "Sign-ins we stopped",
  limits: "What's limited right now",
  checks: "Checks waiting on you",
  discovery: "What stops people finding your account",
};

function summaryFor(id: SectionId, n: number): string {
  if (n === 0) {
    switch (id) {
      case "standing":
        return "Your account is in good standing.";
      case "sign-ins":
        return "No sign-in has been stopped on your account.";
      case "limits":
        return "Nothing on the account is on hold.";
      case "checks":
        return "Nothing is waiting on an answer from you.";
      case "discovery":
        return "Nothing here is blocking your account from being found.";
    }
  }
  switch (id) {
    case "standing":
      return "The account itself is not in its normal state.";
    case "sign-ins":
      return `${n} ${n === 1 ? "attempt was" : "attempts were"} blocked before ${n === 1 ? "it" : "they"} got into your account.`;
    case "limits":
      return n === 1
        ? "One part of the account is on hold until a decision lifts."
        : `${n} parts of the account are on hold until a decision lifts.`;
    case "checks":
      return n === 1
        ? "One thing needs an answer from you before it closes."
        : `${n} things need an answer from you before they close.`;
    case "discovery":
      return `${n} ${n === 1 ? "decision is" : "decisions are"} limiting how people find your account.`;
  }
}

function severityFor(id: SectionId, n: number): Severity {
  if (!n) return "ok";
  return id === "standing" || id === "limits" || id === "checks" ? "action" : "warning";
}

/** The answer for an account nobody has decided anything about — the same
    five checks, all empty. */
export function cleanSections(): StatusSection[] {
  return (Object.keys(SECTION_TITLES) as SectionId[]).map((id) => ({
    id,
    title: SECTION_TITLES[id],
    summary: summaryFor(id, 0),
    severity: "ok" as Severity,
    items: [],
  }));
}

/* The brain's reply shape — one row per real event, nothing invented. */
type ServerCheckItem = {
  id: string;
  title: string;
  sub: string;
  guideline: string;
  at: string;
  appealable: boolean;
  ask: string;
};
type ServerChecks = {
  level: number;
  sections: { id: string; title: string; items: ServerCheckItem[] }[];
};

function shapeSection(raw: { id: string; title?: string; items: ServerCheckItem[] }): StatusSection {
  const id = raw.id as SectionId;
  const items: StatusItem[] = raw.items.map((row) => ({
    id: row.id,
    title: row.title,
    sub: row.sub,
    guideline: row.guideline,
    at: Date.parse(row.at) || Date.now(),
    appealable: !!row.appealable,
    ask: row.ask ?? "",
  }));
  return {
    id,
    title: SECTION_TITLES[id] ?? raw.title,
    summary: summaryFor(id, items.length),
    severity: severityFor(id, items.length),
    items,
  };
}

type ChecksSnapshot = { level: number; sections: StatusSection[] };

function readSnapshot(): ChecksSnapshot {
  if (typeof window === "undefined") return { level: 0, sections: cleanSections() };
  try {
    const raw = localStorage.getItem(CHECKS_STORE);
    if (!raw) return { level: 0, sections: cleanSections() };
    const parsed = JSON.parse(raw) as ChecksSnapshot;
    if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return { level: 0, sections: cleanSections() };
    }
    return {
      level: typeof parsed.level === "number" && parsed.level >= 0 ? parsed.level : 0,
      sections: parsed.sections,
    };
  } catch {
    return { level: 0, sections: cleanSections() };
  }
}

function writeSnapshot(snapshot: ChecksSnapshot): void {
  try {
    localStorage.setItem(CHECKS_STORE, JSON.stringify(snapshot));
  } catch {
    /* private mode — the read still answers for this session */
  }
  /* The gate and the pages read the checks synchronously; they need to hear
     that the account just answered. */
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

/** Ask the brain for the account's real checks and keep the answer.
    Resolves with the fresh sections; rejects only if the brain didn't
    answer, so a page can say so and offer the way to ask again. */
export async function loadAccountChecks(): Promise<ChecksSnapshot> {
  const res = await apiJson<ServerChecks & { ok: boolean }>("/api/user/account-checks");
  const snapshot: ChecksSnapshot = {
    level: typeof res.level === "number" ? res.level : 0,
    sections: (Object.keys(SECTION_TITLES) as SectionId[]).map((id) => {
      const raw = res.sections?.find((s) => s.id === id);
      return raw ? shapeSection(raw) : cleanSections().find((s) => s.id === id)!;
    }),
  };
  writeSnapshot(snapshot);
  return snapshot;
}

/** The checks as the account last sent them. Before the first read lands
    this is the answer a clean account gets — five empty checks — so
    nothing here can lock or alarm an account on a guess. */
export function sections(): StatusSection[] {
  return readSnapshot().sections;
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

/* ── Appeals — on the account, not on this device ──────────────── */

type ServerAppeal = {
  id: string;
  restrictionId: string;
  note: string;
  decision: string | null;
  createdAt: string;
};

const DECISIONS = new Set(["pending", "upheld", "overturned"]);

function asAppeal(row: unknown): row is Appeal {
  return (
    !!row &&
    typeof (row as Appeal).id === "string" &&
    typeof (row as Appeal).restrictionId === "string" &&
    typeof (row as Appeal).at === "number" &&
    typeof (row as Appeal).note === "string"
  );
}

function readAppealRows(): Appeal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(APPEALS_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(asAppeal);
  } catch {
    return [];
  }
}

function writeAppealRows(list: Appeal[]): void {
  try {
    localStorage.setItem(APPEALS_STORE, JSON.stringify(list));
  } catch {
    /* private mode — the read still answers for this session */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

/** The account's appeals as the brain last sent them, newest first. */
export function readAppeals(): Appeal[] {
  return readAppealRows().sort((a, b) => b.at - a.at);
}

/** The review filed for one decision, if there is one. */
export function appealFor(id: string): Appeal | null {
  return readAppeals().find((appeal) => appeal.restrictionId === id) ?? null;
}

/** Pull the appeals from the brain and keep the answer for the gate. */
export async function loadAppeals(): Promise<Appeal[]> {
  const res = await apiJson<{ ok: boolean; appeals: ServerAppeal[] }>(
    "/api/support/tickets/appeals",
  );
  const list: Appeal[] = (res.appeals ?? []).map((row) => ({
    id: row.id,
    restrictionId: row.restrictionId,
    at: Date.parse(row.createdAt) || Date.now(),
    note: row.note,
    decision: (DECISIONS.has(String(row.decision)) ? row.decision : "pending") as Appeal["decision"],
  }));
  writeAppealRows(list);
  return readAppeals();
}

/** Files a review request with what you wrote. The brain attaches it to
    the real decision and refuses a second appeal on the same one — so a
    restriction is the only thing that can ever be appealed here. */
export async function appeal(restrictionId: string, note: string): Promise<Appeal> {
  const res = await apiJson<{ ok: boolean; appeal: ServerAppeal }>("/api/support/appeal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ restrictionId, note: note.trim() }),
  });
  const row: Appeal = {
    id: res.appeal.id,
    restrictionId: res.appeal.restrictionId,
    at: Date.parse(res.appeal.createdAt) || Date.now(),
    note: res.appeal.note,
    decision: (res.appeal.decision ?? "pending") as Appeal["decision"],
  };
  writeAppealRows([row, ...readAppealRows().filter((a) => a.id !== row.id)]);
  openRequest(restrictionId, "appeal" satisfies RequestKind);
  return row;
}
