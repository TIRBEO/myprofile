"use client";

/* ═══════════════════════════════════════════════════════════════════
   Your activity — counted from what the account actually recorded

   Tirbeo doesn't meter how long you spend. What it does keep, and keeps
   on the server rather than in this browser, is a row for everything that
   happened: a sign-in in the login ledger, a change in the activity feed.
   So this page counts those, and says so — a bar is the number of things
   recorded on a day, not minutes nobody measured.

   `GET /api/user/activity/daily` hands back raw counts per day per kind,
   in *this device's* timezone, because a day is the day on the clock the
   reader is looking at. Sorting those kinds into the groups below is
   display, and lives here rather than on the server. A day with no rows is
   drawn as a zero: no record means the account has no record, not a guess.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";

/** How many days the trend draws, and how many the weekly figures use. */
export const TREND_DAYS = 30;
export const WEEK_DAYS = 7;

export type GroupKey = "signin" | "security" | "account" | "content" | "other";

export type ActivityGroup = {
  key: GroupKey;
  label: string;
  /** The colour this group is drawn in, so a filtered chart reads by colour alone. */
  color: string;
};

export const GROUPS: ActivityGroup[] = [
  { key: "signin", label: "Sign-ins", color: "var(--chart-1)" },
  { key: "security", label: "Security", color: "var(--chart-2)" },
  { key: "account", label: "Account", color: "var(--chart-3)" },
  { key: "content", label: "Content", color: "var(--chart-4)" },
  { key: "other", label: "Other", color: "var(--chart-5)" },
];

export type DayRow = {
  /** Local midnight at the start of the day. */
  at: number;
  counts: Record<GroupKey, number>;
  total: number;
};

export type ActivitySummary = {
  /** Every day in the window, oldest first, zeros included. */
  days: DayRow[];
  totals: Record<GroupKey, number>;
  total: number;
};

type DayCountRow = { day: string; kind: string; count: number };

type DailyReply = {
  days: number;
  tz: string;
  since: string;
  events: DayCountRow[];
  signIns: DayCountRow[];
};

const EMPTY_COUNTS = (): Record<GroupKey, number> => ({
  signin: 0,
  security: 0,
  account: 0,
  content: 0,
  other: 0,
});

/**
 * Which group a recorded row belongs to. The feed's `kind` is a dotted name the
 * server writes (security.2fa_enabled, profile.updated, form.submitted…), and
 * the ledger's is a sign-in method — both matched on content rather than a
 * fixed list, so a kind the server starts writing tomorrow still lands
 * somewhere sensible instead of vanishing from the counts.
 */
/** The ledger names a row for the method used; the feed names it for the change. */
const SIGN_IN_METHODS = new Set(["password", "google", "github", "discord", "magic", "otp", "passkey"]);

export function groupFor(kind: string): GroupKey {
  const k = kind.toLowerCase();
  if (SIGN_IN_METHODS.has(k)) return "signin";
  if (k.includes("login") || k.includes("logout") || k.includes("sign")) return "signin";
  if (
    k.startsWith("security.") ||
    k.includes("password") ||
    k.includes("2fa") ||
    k.includes("totp") ||
    k.includes("passkey") ||
    k.includes("backup_code") ||
    k.includes("recovery") ||
    k.includes("merge")
  ) {
    return "security";
  }
  if (k.startsWith("form.") || k.startsWith("content.") || k.startsWith("application.") || k.startsWith("ai.")) {
    return "content";
  }
  if (
    k.startsWith("profile.") ||
    k.startsWith("user.") ||
    k.startsWith("settings") ||
    k.startsWith("preference") ||
    k.startsWith("notification") ||
    k.startsWith("consent") ||
    k.startsWith("theme") ||
    k.startsWith("language")
  ) {
    return "account";
  }
  return "other";
}

/** Local midnight for a `YYYY-MM-DD` the server grouped in this zone. */
function midnight(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).setHours(0, 0, 0, 0);
}

/**
 * The window, oldest first. The server returns only the days that have rows,
 * so the days are filled in here — a chart that skipped empty days would make
 * a quiet week look like no time passed at all.
 */
export async function readSummary(days = TREND_DAYS): Promise<ActivitySummary> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const reply = await apiJson<DailyReply>(
    `/api/user/activity/daily?days=${days}&tz=${encodeURIComponent(tz)}`,
  );

  const last = new Date().setHours(0, 0, 0, 0);
  const byDay = new Map<number, Record<GroupKey, number>>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(last - i * 86_400_000, EMPTY_COUNTS());
  }

  const totals = EMPTY_COUNTS();
  const add = (row: DayCountRow) => {
    const bucket = byDay.get(midnight(row.day));
    if (!bucket) return;
    const group = groupFor(row.kind);
    bucket[group] += row.count;
    totals[group] += row.count;
  };
  for (const row of reply.events) add(row);
  for (const row of reply.signIns) add(row);

  const out: DayRow[] = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, counts]) => ({
      at,
      counts,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    }));

  return {
    days: out,
    totals,
    total: Object.values(totals).reduce((sum, value) => sum + value, 0),
  };
}

/** The newest `n` days, oldest first. */
export function lastDays(summary: ActivitySummary, n = WEEK_DAYS): DayRow[] {
  return summary.days.slice(-n);
}

export function weekTotal(summary: ActivitySummary): number {
  return lastDays(summary).reduce((sum, day) => sum + day.total, 0);
}

/** Busiest of the last seven days. */
export function busiestDay(summary: ActivitySummary): DayRow | null {
  return lastDays(summary).reduce<DayRow | null>(
    (best, day) => (!best || day.total > best.total ? day : best),
    null,
  );
}

/** One group's counts across the same days as the trend. */
export function byDayForGroup(summary: ActivitySummary, group: GroupKey): number[] {
  return summary.days.map((day) => day.counts[group]);
}

export function groupTotal(summary: ActivitySummary, group: GroupKey): number {
  return summary.totals[group] ?? 0;
}

/** "12 things" | "1 thing" — the unit the whole page counts in. */
export function formatCount(value: number): string {
  return `${value} ${value === 1 ? "thing" : "things"}`;
}
