"use client";

/* ═══════════════════════════════════════════════════════════════════
   Login activity

   The account's real sign-in ledger: every successful and blocked attempt
   from `security.login-history`, plus the notable security changes from
   `security.events` (password changed, two-factor on, passkey added, signed
   out). Both are read from the brain over this app's own origin.

   The one thing kept on the device is your answer to "was this you" — the
   page says so out loud, and the brain has no notion of a review. Those marks
   are an overlay keyed by the server's own event id, so they survive a reload
   and re-attach to the same record next time it's read.
   ═══════════════════════════════════════════════════════════════════ */

import { appLocale } from "@/lib/language";
import { dayLabel, formatShortDate } from "@/lib/dates";
import { describeUserAgent } from "@/lib/device";
import { coordsOf } from "@/lib/coords";
import { apiJson } from "@/lib/api";

const OVERLAY = "tirbeo:login-activity:answers";
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
  /** The point the edge resolved that address to, when it resolved one.
      Absent means no map, not a map somewhere else. */
  coords?: [number, number] | null;
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

/** One line per kind — the row's title. */
export const EVENT_TITLE: Record<EventKind, string> = {
  signin: "Signed in",
  signout: "Signed out everywhere",
  failed: "Blocked sign-in attempt",
  password: "Password changed",
  "two-factor": "Two-factor turned on",
  passkey: "Passkey added",
};

/* ── Server rows ────────────────────────────────────────────────────── */

type LoginRow = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  coords?: [number, number] | null;
  success: boolean;
  method: string;
  createdAt: string;
};

type SecurityEventRow = {
  id: string;
  type: string;
  description: string;
  date: string;
  location?: string;
  ip?: string;
  coords?: [number, number] | null;
  userAgent?: string;
};

/** Security-feed types this page has a home for; the rest live only in
    "Your activity". Mapping here keeps every label truthful. */
const SECURITY_KIND: Record<string, EventKind> = {
  password_change: "password",
  "2fa_enable": "two-factor",
  passkey_add: "passkey",
  session_revoke: "signout",
};

const ts = (iso: string, fallback = Date.now()) => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? fallback : ms;
};

const machine = (ua: string | null | undefined) => {
  const hint = describeUserAgent(ua || "");
  if (!ua) return "Unknown device";
  return hint.browser && hint.name !== "This device" ? `${hint.browser} on ${hint.name}` : hint.name;
};

const METHOD_LABEL: Record<string, string> = {
  password: "Password",
  google: "Google",
  github: "GitHub",
  discord: "Discord",
  magic: "Email link",
  passkey: "Passkey",
  otp: "One-time code",
};
const methodLabel = (m: string) => METHOD_LABEL[m?.toLowerCase()] || (m ? cap(m) : "Saved session");

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Device-local answers (the only thing that isn't the server's) ───── */

type Overlay = { reviews: Record<string, { review: Review; reviewedAt: number }>; local: ActivityEvent[] };

function readOverlay(): Overlay {
  if (typeof window === "undefined") return { reviews: {}, local: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(OVERLAY) || "") as Overlay;
    return { reviews: parsed?.reviews || {}, local: Array.isArray(parsed?.local) ? parsed.local : [] };
  } catch {
    return { reviews: {}, local: [] };
  }
}

function writeOverlay(next: Overlay) {
  try {
    localStorage.setItem(OVERLAY, JSON.stringify(next));
  } catch {
    /* private mode — the answer still holds for this session */
  }
}

// The list as last read, so the synchronous answer helpers can return a
// merged view without re-fetching (a review never needs fresh server data).
let lastEvents: ActivityEvent[] = [];

/**
 * The merged log: sign-ins and blocked attempts from login-history, security
 * changes from the events feed, this device's answers layered on top. Newest
 * first, capped. Marks the newest sign-in on this machine's address as current.
 */
export async function readEvents(): Promise<ActivityEvent[]> {
  const [history, security, sessions] = await Promise.all([
    apiJson<{ logs: LoginRow[] }>("/api/security/login-history?limit=40").catch(() => ({ logs: [] as LoginRow[] })),
    apiJson<{ events: SecurityEventRow[] }>("/api/security/events?limit=40").catch(() => ({ events: [] as SecurityEventRow[] })),
    apiJson<{ ipAddress: string | null; isCurrent: boolean }[]>("/api/security/sessions").catch(() => []),
  ]);

  const currentIp = sessions.find((s) => s.isCurrent)?.ipAddress || null;
  const { reviews, local } = readOverlay();

  const signinEvents: ActivityEvent[] = history.logs.map((row) => ({
    id: row.id,
    at: ts(row.createdAt),
    kind: row.success ? "signin" : "failed",
    device: machine(row.userAgent),
    location: row.location || "Unknown location",
    ip: row.ipAddress || "",
    coords: coordsOf(row.coords),
    method: methodLabel(row.method),
    current: false,
    suspicious: false,
  }));

  // Only the newest sign-in that arrived on this machine's address is "here".
  if (currentIp) {
    const newestHere = signinEvents
      .filter((e) => e.kind === "signin" && e.ip === currentIp)
      .sort((a, b) => b.at - a.at)[0];
    if (newestHere) newestHere.current = true;
  }

  const securityEvents: ActivityEvent[] = security.events
    .filter((e) => SECURITY_KIND[e.type])
    .map((e) => ({
      id: e.id,
      at: ts(e.date),
      kind: SECURITY_KIND[e.type],
      device: machine(e.userAgent),
      location: e.location || "Unknown location",
      ip: e.ip || "",
      coords: coordsOf(e.coords),
      method: "This device",
      current: false,
      suspicious: false,
    }));

  const merged = [...signinEvents, ...securityEvents, ...local]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_EVENTS)
    .map((event) => {
      const answer = reviews[event.id];
      return answer ? { ...event, review: answer.review, reviewedAt: answer.reviewedAt } : event;
    });

  lastEvents = merged;
  return merged;
}

/** One event by its id, for the page that shows nothing but it. */
export async function findEvent(id: string | undefined): Promise<ActivityEvent | null> {
  if (!id) return null;
  const events = await readEvents();
  return events.find((event) => event.id === id) ?? null;
}

function applyAnswer(next: ActivityEvent[]) {
  lastEvents = next;
  return next;
}

/** The answer to "was this you", written with the moment it was given. Both
    halves of the question are an answer, so both are kept. */
export function answerEvent(id: string, review: Review): ActivityEvent[] {
  const overlay = readOverlay();
  overlay.reviews[id] = { review, reviewedAt: Date.now() };
  writeOverlay(overlay);
  return applyAnswer(
    lastEvents.map((event) => (event.id === id ? { ...event, review, reviewedAt: overlay.reviews[id].reviewedAt } : event)),
  );
}

/** Take the answer back — the record goes unsigned and the log asks again. */
export function clearAnswer(id: string): ActivityEvent[] {
  const overlay = readOverlay();
  delete overlay.reviews[id];
  overlay.local = overlay.local.map((e) => (e.id === id ? { ...e, review: null, reviewedAt: null } : e));
  writeOverlay(overlay);
  return applyAnswer(lastEvents.map((event) => (event.id === id ? { ...event, review: null, reviewedAt: null } : event)));
}

/** Add the sign-out-everywhere you just performed, so the log carries the
    thing you did here and not only the things that happened to the account. */
export function logSignOutEverywhere(devices: number): ActivityEvent[] {
  const now = Date.now();
  const current = lastEvents.find((e) => e.current) ?? lastEvents[0];
  const entry: ActivityEvent = {
    id: `${now.toString(36)}-signout`,
    at: now,
    kind: "signout",
    device: "This device",
    location: current?.location ?? "Unknown location",
    ip: current?.ip ?? "",
    coords: current?.coords ?? null,
    method: "Signed out from the login log",
    current: true,
    suspicious: false,
    review: "me",
    reviewedAt: now,
    note: `Ended ${devices} ${devices === 1 ? "session" : "sessions"} on every other machine.`,
  };
  const overlay = readOverlay();
  overlay.reviews[entry.id] = { review: "me", reviewedAt: now };
  overlay.local = [entry, ...overlay.local];
  writeOverlay(overlay);
  return applyAnswer([entry, ...lastEvents].sort((a, b) => b.at - a.at).slice(0, MAX_EVENTS));
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
