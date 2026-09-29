"use client";

/* ═══════════════════════════════════════════════════════════════════
   Your activity — what the account did, and what it deleted

   There's no insights endpoint yet, so these figures are the account's
   own: minutes per day, and the tray of things waiting out the clock.
   The seed below stands in until the API returns them, in the shape it
   will use, and every seeded value is invented for display.

   Only time and dates are kept in localStorage; nothing is measured here.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:your-activity";
const DELETED_STORE = "tirbeo:your-activity:deleted";

/** How long deleted content stays recoverable. */
export const KEEP_DAYS = 30;
export const MAX_DELETED = 12;

export type DayMinutes = { at: number; minutes: number };

export type Figures = {
  /** Last 30 days, oldest first. */
  timeByDay: DayMinutes[];
};

export type DeletedItem = {
  id: string;
  kind: string;
  label: string;
  deletedAt: number;
};

const DAY = 24 * 60 * 60_000;

/** How many days the trend chart draws, and how many the weekly figures use. */
export const TREND_DAYS = 30;
export const WEEK_DAYS = 7;

/** Oldest first. Weekends run long and midweek short, which is the whole
    point of drawing it — a flat line would say nothing. */
const MINUTES = [
  22, 35, 41, 28, 60, 74, 33,
  19, 44, 52, 31, 68, 82, 40,
  26, 39, 47, 33, 71, 90, 45,
  24, 37, 43, 29, 55, 66, 34,
  28, 41,
];

function seedFigures(): Figures {
  const midnightToday = new Date().setHours(0, 0, 0, 0);
  const last = MINUTES.length - 1;
  return {
    timeByDay: MINUTES.map((m, i) => ({ at: midnightToday - (last - i) * DAY, minutes: m })),
  };
}

function seedDeleted(): DeletedItem[] {
  const now = Date.now();
  const rows: [offset: number, kind: string, label: string][] = [
    [2 * DAY, "Note", "Upper Mustang trip plan"],
    [5 * DAY, "Bookmark", "Himalayan Frontiers trail guide"],
    [9 * DAY, "Search", "best time to visit Phoksundo"],
    [13 * DAY, "File", "photostreet-roll-frame-6.jpg"],
    [22 * DAY, "Album", "Boudha, 12 photos"],
    [28 * DAY, "Draft", "Reading list, second pass"],
  ];
  return rows.map(([offset, kind, label]) => ({
    id: `${(now - offset).toString(36)}-${kind.toLowerCase()}`,
    kind,
    label,
    deletedAt: now - offset,
  }));
}

function isDayMinutes(value: unknown): value is DayMinutes {
  const row = value as Partial<DayMinutes>;
  return typeof row?.at === "number" && typeof row?.minutes === "number";
}

/** Stored figures that don't match today's shape — including the older set
    that carried social counts beside the days — are replaced by the seed. */
function isFigures(value: unknown): value is Figures {
  const days = (value as Partial<Figures>)?.timeByDay;
  return Array.isArray(days) && days.length >= TREND_DAYS && days.every(isDayMinutes);
}

export function readFigures(): Figures {
  if (typeof window === "undefined") return seedFigures();
  try {
    const raw = localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (isFigures(parsed)) return parsed;
  } catch {
    /* empty or corrupt — start over below */
  }
  const seeded = seedFigures();
  writeFigures(seeded);
  return seeded;
}

function writeFigures(figures: Figures) {
  try {
    localStorage.setItem(STORE, JSON.stringify(figures));
  } catch {
    /* private mode — the figures simply aren't kept between visits */
  }
}

export function readDeleted(): DeletedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_STORE);
    if (!raw) {
      const seeded = seedDeleted();
      writeDeleted(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<DeletedItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is DeletedItem =>
          typeof item?.label === "string" && typeof item?.deletedAt === "number",
      )
      .sort((a, b) => b.deletedAt - a.deletedAt)
      .slice(0, MAX_DELETED);
  } catch {
    return [];
  }
}

function writeDeleted(items: DeletedItem[]) {
  try {
    localStorage.setItem(DELETED_STORE, JSON.stringify(items.slice(0, MAX_DELETED)));
  } catch {
    /* private mode — the tray simply isn't kept between visits */
  }
}

/* ── Activities ──────────────────────────────────────────────────
   A day's minutes are one number; an activity says what they went to.
   Nothing measures that per day yet, so each day is split on a fixed
   share with a small deterministic swing — the shape the API will
   replace wholesale when it starts reporting activities separately. */

export type ActivityKey = "browsing" | "reading" | "searching" | "writing" | "account";

export type Activity = {
  key: ActivityKey;
  label: string;
  /** The colour this activity is drawn in, so a filtered chart reads by colour alone. */
  color: string;
  /** Its share of an ordinary day, and how far that swings either way. */
  share: number;
  swing: number;
};

export const ACTIVITIES: Activity[] = [
  { key: "browsing", label: "Browsing", color: "var(--chart-1)", share: 0.4, swing: 0.3 },
  { key: "reading", label: "Reading", color: "var(--chart-2)", share: 0.24, swing: 0.4 },
  { key: "searching", label: "Searching", color: "var(--chart-3)", share: 0.16, swing: 0.6 },
  { key: "writing", label: "Writing", color: "var(--chart-4)", share: 0.12, swing: 0.8 },
  { key: "account", label: "Account", color: "var(--chart-5)", share: 0.08, swing: 0.5 },
];

/** 0..1, different for every day and every activity, but the same every
    time you ask — a chart that jumped between renders says nothing. */
function wave(day: number, seed: number): number {
  return (Math.sin(day * 1.7 + seed * 2.4) + 1) / 2;
}

function shares(day: number): number[] {
  const raw = ACTIVITIES.map((activity, n) => {
    const half = activity.swing / 2;
    return activity.share * (1 - half + wave(day, n + 1) * activity.swing);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

/** One activity's minutes across the same days as `timeByDay`, oldest first. */
export function activityByDay(figures: Figures, activity: Activity): number[] {
  const at = ACTIVITIES.findIndex((row) => row.key === activity.key);
  return figures.timeByDay.map((day, i) => Math.round(day.minutes * shares(i)[at]));
}

/** What one activity took over the days shown — the number under the chart. */
export function activityTotal(figures: Figures, activity: Activity): number {
  return activityByDay(figures, activity).reduce((sum, minutes) => sum + minutes, 0);
}

/* ── Derived numbers ───────────────────────────────────────────── */

/** The newest `n` days, oldest first. */
export function lastDays(figures: Figures, n = WEEK_DAYS): DayMinutes[] {
  return figures.timeByDay.slice(-n);
}

export function weekMinutes(figures: Figures): number {
  return lastDays(figures).reduce((sum, day) => sum + day.minutes, 0);
}

/** Busiest of the last seven days, for the line under the chart. */
export function busiestDay(figures: Figures): DayMinutes | null {
  return lastDays(figures).reduce<DayMinutes | null>(
    (best, day) => (!best || day.minutes > best.minutes ? day : best),
    null,
  );
}

/** Whole days before an item leaves the tray for good, never below zero. */
export function daysLeft(item: DeletedItem): number {
  const purgeAt = item.deletedAt + KEEP_DAYS * DAY;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / DAY));
}

/** "5h 32m" | "41m" — durations, which no date helper covers. */
export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (!hrs) return `${mins}m`;
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`;
}

/* ── The tray ──────────────────────────────────────────────────── */

function saveDeleted(items: DeletedItem[]): DeletedItem[] {
  const next = items.sort((a, b) => b.deletedAt - a.deletedAt);
  writeDeleted(next);
  return next;
}

/** One tray item by its id, for the page that shows nothing but it. */
export function findDeleted(id: string | undefined): DeletedItem | null {
  if (!id) return null;
  return readDeleted().find((item) => item.id === id) ?? null;
}

/** Takes one item out of the tray. Restoring puts it back where it was;
    deleting it here ends it without waiting out the clock. */
export function removeFromTray(id: string): DeletedItem[] {
  return saveDeleted(readDeleted().filter((item) => item.id !== id));
}
