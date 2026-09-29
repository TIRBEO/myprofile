"use client";

/* ═══════════════════════════════════════════════════════════════════
   Login activity

   There's no server logging sign-ins yet, so this is the account's own
   list of them: what happened, from where, and whether you said it was
   you. Seed rows stand in for the real log until the backend fills it —
   the shape is the same, so the page won't need changing. Anything you
   mark is kept in localStorage.
   ═══════════════════════════════════════════════════════════════════ */

import { appLocale } from "@/lib/language";
import { dayLabel, formatShortDate } from "@/lib/dates";

const STORE = "tirbeo:login-activity";
export const MAX_EVENTS = 40;

export type EventKind = "signin" | "signout" | "failed" | "password" | "two-factor" | "passkey";

export type ActivityEvent = {
  id: string;
  at: number;
  kind: EventKind;
  device: string;
  location: string;
  /** The address it arrived on — the first thing anyone checks. */
  ip: string;
  /** How they proved who they were: a password, a passkey, a saved session. */
  method: string;
  /** The sign-in this page is being read from. */
  current: boolean;
  /** Marked by the system as worth a look — a blocked attempt, a new country. */
  suspicious: boolean;
  /** Your answer to "was this you", kept on the device. Absent means never
      answered, which is what the log's "Review" marker is for. */
  review?: Review | null;
  /** When you answered — so the page can say "you confirmed this 2 min ago". */
  reviewedAt?: number | null;
  /** Only on an entry this screen caused — what it actually did. */
  note?: string;
};

export type Review = "me" | "not-me";

export type EventGroup = "all" | "signins" | "security";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** One line per kind — the row's title. */
export const EVENT_TITLE: Record<EventKind, string> = {
  signin: "Signed in",
  signout: "Signed out everywhere",
  failed: "Blocked sign-in attempt",
  password: "Password changed",
  "two-factor": "Two-factor turned on",
  passkey: "Passkey added",
};

export const EVENT_GROUPS: { value: EventGroup; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "signins", label: "Sign-ins" },
  { value: "security", label: "Security" },
];

export function inGroup(event: ActivityEvent, group: EventGroup): boolean {
  if (group === "signins") return event.kind === "signin" || event.kind === "failed";
  if (group === "security") return event.kind !== "signin" && event.kind !== "failed";
  return true;
}

function seed(): ActivityEvent[] {
  const now = Date.now();
  const rows: [
    offset: number,
    kind: EventKind,
    device: string,
    location: string,
    ip: string,
    method: string,
  ][] = [
    [14 * MIN, "signin", "Chrome on macOS", "Kathmandu, Nepal", "202.79.160.14", "Saved session"],
    [2 * HOUR, "signin", "Tirbeo app on iPhone 15 Pro", "Kathmandu, Nepal", "103.181.81.44", "Passkey"],
    [1 * DAY + 3 * HOUR, "signin", "Safari on iPad Air", "Lalitpur, Nepal", "182.93.183.7", "Password and code"],
    [2 * DAY + 5 * HOUR, "failed", "Unknown browser", "Lagos, Nigeria", "102.89.44.19", "Wrong password, 3 times"],
    [5 * DAY, "password", "Chrome on Windows", "Kathmandu, Nepal", "110.34.236.19", "Password"],
    [6 * DAY, "two-factor", "Chrome on Windows", "Kathmandu, Nepal", "110.34.236.19", "Password"],
    [9 * DAY, "passkey", "Tirbeo app on Pixel 9", "Kathmandu, Nepal", "45.127.88.3", "Password"],
    [21 * DAY, "signout", "Tirbeo app on iPhone 15 Pro", "Kathmandu, Nepal", "103.181.81.44", "Passkey"],
  ];
  return rows.map(([offset, kind, device, location, ip, method], i) => ({
    id: `${(now - offset).toString(36)}-${kind}`,
    at: now - offset,
    kind,
    device,
    location,
    ip,
    method,
    // The newest sign-in is the one this page is being read from.
    current: i === 0,
    suspicious: false,
    review: null,
    reviewedAt: null,
  }));
}

export function readEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) {
      const seeded = seed();
      writeEvents(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<ActivityEvent>[];
    if (!Array.isArray(parsed)) return [];
    const kept = parsed.filter(isEvent);
    // A log saved before events carried the fields today's pages read off
    // them can't fill those lines in, so it starts over from the seed.
    if (kept.length !== parsed.length) {
      const seeded = seed();
      writeEvents(seeded);
      return seeded;
    }
    // A payload saved before the "this wasn't me" answer existed has no such
    // field — read that as never answered rather than leaving it undefined.
    return kept
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_EVENTS)
      .map((event) => ({ ...event, review: event.review ?? null, reviewedAt: event.reviewedAt ?? null }));
  } catch {
    return [];
  }
}

function isEvent(value: Partial<ActivityEvent>): value is ActivityEvent {
  return (
    typeof value?.id === "string" &&
    typeof value?.at === "number" &&
    !!value?.kind &&
    typeof value.device === "string" &&
    typeof value.location === "string" &&
    typeof value.ip === "string" &&
    typeof value.method === "string" &&
    typeof value.current === "boolean"
  );
}

/** One event by its id, for the page that shows nothing but it. */
export function findEvent(id: string | undefined): ActivityEvent | null {
  if (!id) return null;
  return readEvents().find((event) => event.id === id) ?? null;
}

function writeEvents(events: ActivityEvent[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    /* private mode — the change still holds for this session */
  }
}

/** You said it wasn't you — the row keeps the flag so the page can act on it. */
export function setSuspicious(id: string, suspicious: boolean): ActivityEvent[] {
  writeEvents(readEvents().map((event) => (event.id === id ? { ...event, suspicious } : event)));
  return readEvents();
}

/** The answer to "was this you", written with the moment it was given. Both
    halves of the question are an answer, so both are kept — a log where
    nothing was ever reviewed can't say which records you've already checked. */
export function answerEvent(id: string, review: Review): ActivityEvent[] {
  writeEvents(
    readEvents().map((event) =>
      event.id === id ? { ...event, review, reviewedAt: Date.now() } : event,
    ),
  );
  return readEvents();
}

/** Take the answer back — the record goes unsigned and the log asks again. */
export function clearAnswer(id: string): ActivityEvent[] {
  writeEvents(
    readEvents().map((event) =>
      event.id === id ? { ...event, review: null, reviewedAt: null } : event,
    ),
  );
  return readEvents();
}

/** How many records you've settled — the line the log leads with. */
export function reviewedCount(events: ActivityEvent[]): number {
  return events.filter((event) => event.review).length;
}

/** Add the sign-out-everywhere you just performed, so the log carries the
    thing you did here and not only the things that happened to the account. */
export function logSignOutEverywhere(devices: number): ActivityEvent[] {
  const now = Date.now();
  const events = readEvents();
  const entry: ActivityEvent = {
    id: `${now.toString(36)}-signout`,
    at: now,
    kind: "signout",
    device: "This device",
    location: events[0]?.location ?? "Kathmandu, Nepal",
    ip: events.find((event) => event.current)?.ip ?? "202.79.160.14",
    method: "Signed out from the login log",
    current: true,
    suspicious: false,
    review: "me",
    reviewedAt: now,
    note: `Ended ${devices} ${devices === 1 ? "session" : "sessions"} on every other machine.`,
  };
  writeEvents([entry, ...events]);
  return readEvents();
}

/**
 * Today, Yesterday, then the day's name — or its weekday and date once it's
 * past the current week, so two Mondays down the log never read as one.
 * Said in whatever language the device is answering in.
 */
function dayHeading(ts: number): string {
  const date = new Date(ts);
  const today = date.toDateString() === new Date().toDateString();
  const yesterday = date.toDateString() === new Date(Date.now() - 86_400_000).toDateString();
  if (today || yesterday) return dayLabel(ts);
  const word = new Intl.DateTimeFormat(appLocale(), { weekday: "long" }).format(date);
  if (Date.now() - ts < 6 * 86_400_000) return word;
  return `${word}, ${formatShortDate(ts)}`;
}

/**
 * Events under a heading — one block per calendar day, newest first. A row
 * sits with its own day, so the heading above it always says which.
 */
export function byDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups: { key: string; label: string; events: ActivityEvent[] }[] = [];
  for (const event of events) {
    const key = new Date(event.at).toDateString();
    const last = groups[groups.length - 1];
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, label: dayHeading(event.at), events: [event] });
  }
  return groups.map(({ label, events: evs }) => ({ label, events: evs }));
}

