"use client";

/* ═══════════════════════════════════════════════════════════════════
   Login activity

   The account's real sign-in ledger: every successful and blocked attempt
   from `security.login-history`, plus the notable security changes from
   `security.events` (password changed, two-factor on, passkey added, signed
   out). All three are read from the brain over this app's own origin, and a
   read that fails is said out loud — an empty list only ever means the
   account answered and had nothing to show.

   Your answer to "was this you" goes to the account, which dates it and keeps
   it on every device you sign in from. A change row (`security.events` hands
   back the ledger's own id) and a sign-in row (`security.login-history` hands
   back the sign-in ledger's own id) are both answered with
   `POST /api/user/changes/:id/answer`, which writes a record of its own; the
   row is only marked answered once that call has accepted it. A sign-in row
   used to be the exception — the sign-in ledger has no review column, so the
   answer was kept on the phone that gave it and went nowhere else. The answer
   store is keyed by the row it is about, so the ledger reads the answer back
   and the sign-in ledger's missing column no longer decides anything.
   ═══════════════════════════════════════════════════════════════════ */

import { appLocale } from "@/lib/language";
import { dayLabel, formatShortDate } from "@/lib/dates";
import { describeUserAgent } from "@/lib/device";
import { coordsOf } from "@/lib/coords";
import { apiJson, apiSend } from "@/lib/api";
import { adoptLegacy, getStored, persistNow, setStored } from "@/lib/remote-store";

const OVERLAY = "tirbeo:login-activity:answers";
export const MAX_EVENTS = 40;

export type EventKind = "signin" | "signout" | "failed" | "password" | "two-factor" | "passkey";

export type ActivityEvent = {
  id: string;
  /** The short event reference (xxxx-xxxx-xxxx) — the code quoted to support
      and pasted into admin. The server stamps one on every row; absent only
      on rows read from an endpoint that predates it, where the id is used. */
  ref?: string | null;
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
  /** Whether the account can hold an answer on this row at all. True for a
      change (the ledger's own id, and `user/changes/:id/answer` takes it) and
      for a sign-in (the sign-in ledger's own id — the answer store is keyed by
      the row it is about, so the missing review column decides nothing). */
  answerable: boolean;
  /** Your answer to "was this you". Absent means never answered, which is
      what the log's "Review" marker is for. */
  review?: Review | null;
  /** When you answered — so the page can say "you confirmed this 2 min ago". */
  reviewedAt?: number | null;
  /** Which record the answer is: the account's, or this device's only. */
  reviewKept?: "account" | "device" | null;
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
  ref?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  coords?: [number, number] | null;
  success: boolean;
  method: string;
  createdAt: string;
  /** The owner's answer to "was this you", when the account holds one about
      this sign-in. The sign-in ledger has no review column of its own — the
      answer lives in the account's answer store and comes back with the row. */
  said?: { answer: string; at: string } | null;
};

type SecurityEventRow = {
  id: string;
  ref?: string | null;
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

/* ── Your answers ─────────────────────────────────────────────────── */

/** A device-side copy of an answer: a cache of what the account already holds
    (and, for the answers given before the account could hold one, the only
    copy there is — those say so). */
type CachedAnswer = { review: Review; at: number; kept: "account" | "device" };

type Overlay = { answers: Record<string, CachedAnswer> };

function readOverlay(): Overlay {
  if (typeof window === "undefined") return { answers: {} };
  adoptLegacy(OVERLAY);
  const parsed = getStored<Partial<Overlay>>(OVERLAY, { answers: {} });
  const answers: Record<string, CachedAnswer> = {};
  // The bag's shape changed once: an older `reviews` map is read as answers
  // kept on this device, so a mark given before this page could send anything
  // still shows — and nothing written by the account is second-guessed.
  const legacy = (parsed as unknown as { reviews?: Record<string, { review: Review; reviewedAt: number }> })?.reviews;
  for (const [id, row] of Object.entries(legacy || {})) {
    if (row?.review === "me" || row?.review === "not-me")
      answers[id] = { review: row.review, at: Number(row.reviewedAt) || Date.now(), kept: "device" };
  }
  for (const [id, row] of Object.entries(parsed?.answers || {})) {
    if (row?.review === "me" || row?.review === "not-me")
      answers[id] = { review: row.review, at: Number(row.at) || Date.now(), kept: row.kept === "account" ? "account" : "device" };
  }
  return { answers };
}

/** The answers the account itself holds, folded from `user/changes`. */
type ChangeAnswerRow = { id: string; said: { answer: string; at: string } | null };

async function readAccountAnswers(): Promise<Map<string, { review: Review; at: number }>> {
  const reply = await apiJson<{ changes: ChangeAnswerRow[] }>("/api/user/changes?limit=200");
  const out = new Map<string, { review: Review; at: number }>();
  for (const row of reply.changes || []) {
    const answer = row?.said?.answer;
    if (answer !== "recognised" && answer !== "not-me") continue;
    const at = Date.parse(row.said?.at || "");
    out.set(row.id, { review: answer === "not-me" ? "not-me" : "me", at: Number.isNaN(at) ? Date.now() : at });
  }
  return out;
}

/** One answer, written where it belongs and never before it is true:
    the account first for a row it can hold, then the device cache. */
async function writeAnswer(id: string, review: Review | null, answerable: boolean): Promise<void> {
  if (answerable) {
    /* The brain's own words for the two halves of the question, and `null`
       for taking it back — which it records rather than erasing. */
    await apiSend(`/api/user/changes/${id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: review === null ? null : review === "not-me" ? "not-me" : "recognised" }),
    });
  }

  const overlay = readOverlay();
  const before = overlay.answers[id];
  const at = Date.now();
  if (review === null) delete overlay.answers[id];
  else overlay.answers[id] = { review, at, kept: answerable ? "account" : "device" };

  if (answerable) {
    /* A cache of an answer the account already holds: if this write is
       refused the answer is still true, it just won't show on this device
       until the next read. The account's copy is the one that counts. */
    setStored(OVERLAY, overlay);
    return;
  }

  // A device-only mark is the only copy there is, so it is awaited — a
  // refusal means the answer was not kept, and the page has to say so.
  setStored(OVERLAY, overlay);
  try {
    await persistNow(OVERLAY, overlay);
  } catch (err) {
    const back = readOverlay();
    if (before) back.answers[id] = before;
    else delete back.answers[id];
    setStored(OVERLAY, back);
    throw err;
  }
}

// The list as last read, so the synchronous helpers can return a merged view
// without re-fetching (an answer never needs fresh server data).
let lastEvents: ActivityEvent[] = [];

/**
 * The merged log: sign-ins and blocked attempts from login-history, security
 * changes from the events feed, and every answer the account holds folded onto
 * the row it was given about. Newest first, capped. Marks the newest sign-in on
 * this machine's address as current. Throws when the account won't answer — a
 * blank list here means "nothing recorded", never "the read failed".
 */
export async function readEvents(): Promise<ActivityEvent[]> {
  const [history, security, sessions, answered] = await Promise.all([
    apiJson<{ logs: LoginRow[] }>("/api/security/login-history?limit=40"),
    apiJson<{ events: SecurityEventRow[] }>("/api/security/events?limit=40"),
    apiJson<{ ipAddress: string | null; isCurrent: boolean }[]>("/api/security/sessions"),
    readAccountAnswers(),
  ]);

  const currentIp = sessions.find((s) => s.isCurrent)?.ipAddress || null;
  const cached = readOverlay().answers;

  /* Every answer the account holds, in one map: the ones about change rows
     (read from the changes feed) and the ones about sign-in rows (read with
     the sign-in ledger, which has no review column of its own). The account
     wins over the device copy below — it is dated by the server and the same
     on every device. */
  const accountAnswers = new Map<string, { review: Review; at: number }>();
  for (const row of history.logs) {
    const said = row.said;
    if (!said) continue;
    const review: Review | null = said.answer === "not-me" ? "not-me" : said.answer === "recognised" ? "me" : null;
    if (!review) continue;
    const at = Date.parse(said.at || "");
    accountAnswers.set(row.id, { review, at: Number.isNaN(at) ? Date.now() : at });
  }
  for (const [id, answer] of answered) accountAnswers.set(id, answer);

  const signinEvents: ActivityEvent[] = history.logs.map((row) => ({
    id: row.id,
    ref: row.ref ?? null,
    at: ts(row.createdAt),
    kind: row.success ? "signin" : "failed",
    device: machine(row.userAgent),
    location: row.location || "Unknown location",
    ip: row.ipAddress || "",
    coords: coordsOf(row.coords),
    method: methodLabel(row.method),
    current: false,
    // A sign-in row is answered on the account now: the answer store is keyed
    // by the row it is about, so the sign-in ledger's missing review column
    // no longer means the answer has nowhere to go.
    answerable: true,
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
      ref: e.ref ?? null,
      at: ts(e.date),
      kind: SECURITY_KIND[e.type],
      device: machine(e.userAgent),
      location: e.location || "Unknown location",
      ip: e.ip || "",
      coords: coordsOf(e.coords),
      method: "This device",
      current: false,
      answerable: true,
    }));

  const merged = [...signinEvents, ...securityEvents]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_EVENTS)
    .map((event) => {
      // The account wins: it is dated by the server and the same on any device.
      const server = accountAnswers.get(event.id);
      if (server) return { ...event, review: server.review, reviewedAt: server.at, reviewKept: "account" as const };
      const local = cached[event.id];
      if (local) return { ...event, review: local.review, reviewedAt: local.at, reviewKept: local.kept };
      return event;
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

/** The answer to "was this you". The row is marked only after the account has
    accepted it (or, on a sign-in row, after the device has kept it), so a
    refusal leaves the log asking and the page free to try again. */
export async function answerEvent(id: string, review: Review): Promise<ActivityEvent[]> {
  const event = lastEvents.find((row) => row.id === id);
  await writeAnswer(id, review, !!event?.answerable);
  const at = Date.now();
  const kept = event?.answerable ? "account" : "device";
  return applyAnswer(
    lastEvents.map((row) => (row.id === id ? { ...row, review, reviewedAt: at, reviewKept: kept } : row)),
  );
}

/** Take the answer back — the record goes unsigned and the log asks again. */
export async function clearAnswer(id: string): Promise<ActivityEvent[]> {
  const event = lastEvents.find((row) => row.id === id);
  await writeAnswer(id, null, !!event?.answerable);
  return applyAnswer(
    lastEvents.map((row) =>
      row.id === id ? { ...row, review: null, reviewedAt: null, reviewKept: null } : row,
    ),
  );
}

/** The sign-out-everywhere you just performed is a real ledger row
    (`sessions.revoked_all`), so this only re-reads: nothing is written down
    here that the account did not record itself. */
export async function logSignOutEverywhere(): Promise<ActivityEvent[]> {
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
