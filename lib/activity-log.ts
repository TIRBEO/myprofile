"use client";

/* ═══════════════════════════════════════════════════════════════════
   Activity log — changes to the account itself

   Nothing keeps this record server-side yet, so it is the account's own
   list of the edits it has made: what field, what it was, what it is
   now, and where the change came from. The seed rows below stand in for
   that record until the API returns it — the shape is deliberately the
   one the backend will hand back, so the page won't need changing.

   Every seed value is invented for display. A log the user can't read
   in full isn't a log, so nothing here is masked — the only value that
   is never kept is the password itself. A change the owner has said
   "that wasn't me" carries that answer on its own record (youSaid), so
   the list can mark it red everywhere, not just on the page it was
   answered on.
   ═══════════════════════════════════════════════════════════════════ */

import { dayLabel } from "@/lib/dates";

const STORE = "tirbeo:activity-log";
/** Where answers used to live, one page of its own before the answer
    moved onto the record. Read once, merged in, then deleted. */
const LEGACY_ANSWERS = "tirbeo:activity-log:answers";

export const MAX_ENTRIES = 30;

export type ChangeKind =
  | "account"
  | "email"
  | "recovery-email"
  | "phone"
  | "username"
  | "password"
  | "two-factor"
  | "passkey"
  | "visibility"
  | "language"
  | "connected-app"
  | "data-request";

/** The owner's answer to "was this you" — absent means unanswered. */
export type YouSaid = "recognised" | "not-me";

export type ChangeEntry = {
  id: string;
  at: number;
  kind: ChangeKind;
  /** The field the edit landed on — the sheet files everything under it. */
  field: string;
  from: string;
  to: string;
  device: string;
  location: string;
  /** The address the request came from — the first thing anyone checks
      when a change wasn't theirs. */
  ip: string;
  /** Kept on the record so every surface — the list above all — can mark
      a change the owner says wasn't theirs. Missing means unanswered. */
  youSaid?: YouSaid;
  /** When that answer was given. */
  youSaidAt?: number;
};

/** One line per kind — the row's title. */
export const CHANGE_TITLE: Record<ChangeKind, string> = {
  account: "Account created",
  email: "Email address changed",
  "recovery-email": "Recovery email changed",
  phone: "Phone number changed",
  username: "Username changed",
  password: "Password changed",
  "two-factor": "Two-factor setting changed",
  passkey: "Passkey added",
  visibility: "Account privacy changed",
  language: "App language changed",
  "connected-app": "Connected app removed",
  "data-request": "Data archive requested",
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function seed(): ChangeEntry[] {
  const now = Date.now();
  const rows: [
    offset: number,
    kind: ChangeKind,
    field: string,
    from: string,
    to: string,
    device: string,
    location: string,
    ip: string,
  ][] = [
    [26 * MIN, "email", "Email address", "aarav.shrestha92@gmail.com", "a.shrestha97@gmail.com", "Chrome on macOS", "Kathmandu, Nepal", "202.79.160.14"],
    [4 * HOUR, "language", "App language", "नेपाली", "English", "Chrome on macOS", "Kathmandu, Nepal", "202.79.160.14"],
    [1 * DAY + 3 * HOUR, "username", "Username", "aarav-shrestha", "aarav", "Tirbeo app on iPhone 15 Pro", "Kathmandu, Nepal", "103.181.81.44"],
    // A password change says that it happened — the value itself is never kept.
    [2 * DAY + 5 * HOUR, "password", "Password", "", "", "Chrome on macOS", "Kathmandu, Nepal", "202.79.160.14"],
    [6 * DAY, "two-factor", "Two-factor authentication", "Off", "On", "Chrome on macOS", "Kathmandu, Nepal", "202.79.160.14"],
    [9 * DAY, "passkey", "Passkey", "None saved", "iCloud Keychain", "Safari on iPad Air", "Lalitpur, Nepal", "182.93.183.7"],
    [14 * DAY, "visibility", "Account privacy", "Public", "Private", "Tirbeo app on iPhone 15 Pro", "Kathmandu, Nepal", "103.181.81.44"],
    [23 * DAY, "connected-app", "Connected app", "Slideshare", "Removed", "Chrome on Windows", "Kathmandu, Nepal", "110.34.236.19"],
    [38 * DAY, "phone", "Phone number", "+977 98412 06121", "+977 98064 18877", "Chrome on Windows", "Pokhara, Nepal", "116.212.101.8"],
    [52 * DAY, "recovery-email", "Recovery email", "None saved", "aarav.shrestha92@gmail.com", "Chrome on Windows", "Kathmandu, Nepal", "110.34.236.19"],
    [74 * DAY, "data-request", "Data archive", "Requested", "Downloaded", "Chrome on Windows", "Kathmandu, Nepal", "110.34.236.19"],
    [186 * DAY, "account", "Account", "—", "Aarav Shrestha", "Chrome on Windows", "Kathmandu, Nepal", "110.34.236.19"],
  ];
  return rows.map(([offset, kind, field, from, to, device, location, ip]) => ({
    id: `${(now - offset).toString(36)}-${kind}`,
    at: now - offset,
    kind,
    field,
    from,
    to,
    device,
    location,
    ip,
  }));
}

export function readChanges(): ChangeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as Partial<ChangeEntry>[]) : null;
    // Anything that doesn't match the current shape — including a log
    // stored before entries carried an IP or an answer — is replaced by
    // the seed. An older entry simply arrives with youSaid absent, which
    // reads as unanswered.
    const stored = Array.isArray(parsed) ? parsed.filter(isEntry).map(normalise) : [];
    const kept = unmask(stored);
    if (!kept.length) {
      const seeded = mergeLegacyAnswers(seed());
      writeChanges(seeded);
      return seeded;
    }
    const withLegacy = mergeLegacyAnswers(kept);
    if (kept !== stored || withLegacy !== kept) writeChanges(withLegacy);
    return withLegacy.sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function isEntry(entry: Partial<ChangeEntry> | null | undefined): entry is ChangeEntry {
  return (
    typeof entry?.id === "string" &&
    typeof entry?.at === "number" &&
    typeof entry?.field === "string" &&
    typeof entry?.from === "string" &&
    typeof entry?.to === "string" &&
    typeof entry?.device === "string" &&
    typeof entry?.location === "string" &&
    typeof entry?.ip === "string" &&
    !!entry?.kind
  );
}

/** A stored answer that isn't one of the two real ones is dropped rather
    than taking the whole record down with it. Missing reads as unanswered. */
function normalise(entry: ChangeEntry): ChangeEntry {
  return entry.youSaid === "recognised" || entry.youSaid === "not-me"
    ? entry
    : { ...entry, youSaid: undefined };
}

/** Addresses used to be stored with their middle dotted out. A log written
    before that changed keeps the dotted form on the device that saw it, so
    it's repaired on read rather than lost — the seed knows the real value
    for every field this log can hold. */
function unmask(entries: ChangeEntry[]): ChangeEntry[] {
  const dotted = /[•…]|\*\*/;
  if (!entries.some((entry) => dotted.test(entry.from) || dotted.test(entry.to))) return entries;
  const truth = new Map(seed().map((row) => [row.field, row]));
  return entries.map((entry) => {
    if (!dotted.test(entry.from) && !dotted.test(entry.to)) return entry;
    const known = truth.get(entry.field);
    return known ? { ...entry, from: known.from, to: known.to } : entry;
  });
}

/** Answers used to live in their own store, invisible to the list. They
    move onto the records once, then the old store is deleted. */
function mergeLegacyAnswers(entries: ChangeEntry[]): ChangeEntry[] {
  let answers: Record<string, unknown> | null = null;
  try {
    const raw = localStorage.getItem(LEGACY_ANSWERS);
    if (!raw) return entries;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      answers = parsed as Record<string, unknown>;
    }
  } catch {
    return entries;
  }
  if (!answers) return entries;
  const merged = entries.map((entry) => {
    const said = answers![entry.id];
    return said === "recognised" || said === "not-me" ? { ...entry, youSaid: said as YouSaid } : entry;
  });
  try {
    localStorage.removeItem(LEGACY_ANSWERS);
  } catch {
    /* the merge already happened for this visit */
  }
  return merged;
}

/** Record the owner's answer to "was this you" — null undoes it. The
    answer lives on the entry itself so the list marks it everywhere, and so
    does the moment it was given: an entry you settled a week ago and one you
    settled a minute ago are not the same thing to read. */
export function setYouSaid(id: string, answer: YouSaid | null): ChangeEntry | null {
  const next = readChanges().map((entry) =>
    entry.id === id
      ? {
          ...entry,
          youSaid: answer ?? undefined,
          youSaidAt: answer ? Date.now() : undefined,
        }
      : entry,
  );
  writeChanges(next);
  return next.find((entry) => entry.id === id) ?? null;
}

function writeChanges(entries: ChangeEntry[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* private mode — the list simply isn't kept between visits */
  }
}

/** One change by its id, for the page that shows nothing but it. */
export function findChange(id: string | undefined): ChangeEntry | null {
  if (!id) return null;
  return readChanges().find((entry) => entry.id === id) ?? null;
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
