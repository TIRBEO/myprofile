/* ═══════════════════════════════════════════════════════════════════
   The two date labels every security list is remembered by: the exact
   stamp a row is titled with, and how long ago that was.

   Both are asked of Intl in the language the account is set to, which is
   what makes that setting reach every screen: month names, the order the
   parts go in and the digits all come from there rather than from a table
   of strings someone has to keep up to date.
   ═══════════════════════════════════════════════════════════════════ */

import { appLocale } from "@/lib/language";

/** "27 Sept 2026, 3:31 am" */
export function formatStamp(ts: number): string {
  return new Intl.DateTimeFormat(appLocale(), { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(ts),
  );
}

/** "27 Sept 2026" — for rows where the time adds nothing. */
export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(appLocale(), { dateStyle: "medium" }).format(new Date(ts));
}

/** "9:14 am" — the short label a list row is timed with. */
export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat(appLocale(), { timeStyle: "short" }).format(new Date(ts));
}

/** "22 Sept" — the date a row shows once it's older than yesterday. */
export function formatShortDate(ts: number): string {
  return new Intl.DateTimeFormat(appLocale(), { day: "numeric", month: "short" }).format(new Date(ts));
}

/** "just now" | "12 minutes ago" | "yesterday" — said in the set language. */
function since(units: number, step: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(appLocale(), { numeric: "auto" }).format(-units, step);
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Thu" — the axis label under a week of bars. */
export function weekdayShort(ts: number): string {
  return new Intl.DateTimeFormat(appLocale(), { weekday: "short" }).format(new Date(ts));
}

/** "Thu 24 Sept" — the same day said fully, for the line above a chart. */
export function longDay(ts: number): string {
  return new Intl.DateTimeFormat(appLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(ts));
}

/** "Today" — for the last column of any chart that ends today. */
export function todayWord(): string {
  return cap(since(0, "day"));
}

/* A date picker can't ask Intl for one label at a time — it needs the whole
   run of months and weekdays to draw its headings. Built once per language
   and kept, because the answer never changes while the page is open. */

const LISTS = new Map<string, { months: string[]; weekdays: string[] }>();

function languageLists(locale = appLocale()) {
  const cached = LISTS.get(locale);
  if (cached) return cached;
  // 16 August 2026 is a Sunday, so the week runs Sun→Sat like the grid does.
  const lists = {
    months: Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, i, 1)),
    ),
    weekdays: Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 7, 16 + i)),
    ),
  };
  LISTS.set(locale, lists);
  return lists;
}

/** The twelve months, long form, in the set language. */
export function monthNames(): string[] {
  return languageLists().months;
}

/** The seven days, short form, starting Sunday. */
export function weekdayNames(): string[] {
  return languageLists().weekdays;
}

/** "Today" | "Yesterday" | "22 Sept 2026" — how a log groups its rows.
    Capitalised because it heads a block, in whatever the language's own
    word for the day is. */
export function dayLabel(ts: number): string {
  const day = new Date(ts).toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const text =
    day === new Date().toDateString() ? since(0, "day")
    : day === yesterday ? since(1, "day")
    : new Intl.DateTimeFormat(appLocale(), { dateStyle: "medium" }).format(new Date(ts));
  return cap(text);
}

/** "just now" | "12 minutes ago" | "3 hours ago" | "yesterday" | "4 days ago" */
export function ago(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return since(0, "second");
  if (mins < 60) return since(mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return since(hours, "hour");
  const days = Math.round(hours / 24);
  return since(days, "day");
}
