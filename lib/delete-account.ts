"use client";

/* ═══════════════════════════════════════════════════════════════════
   Counting down a scheduled close

   The schedule itself is the account's: it is opened by the brain when a
   mailed code is spent, read back from `/api/user/account-state`, and the
   permanent-deletion job is what finally ends the account. What's left here
   is the arithmetic the screens share — the window they were told to expect,
   and a clock rendered from a date the server gave.
   ═══════════════════════════════════════════════════════════════════ */

/** About a month, which is what the page tells the user to expect. */
export const GRACE_DAYS = 30;

const DAY = 86_400_000;

/** When a close requested at `from` would become final. A promise the screen
    makes before the request exists, so it is only ever an estimate — the real
    date is the one the account hands back once the code is spent. */
export function finalAt(from = Date.now()): number {
  return from + GRACE_DAYS * DAY;
}

export type Remaining = {
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** Time left before a scheduled close becomes final. */
export function remaining(finalAt: number, now = Date.now()): Remaining {
  const ms = finalAt - now;
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const total = Math.floor(ms / 1000);
  return {
    done: false,
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

/** "29 days, 4 hours" — the short label the status card reports with. */
export function countdownLabel(finalAt: number, now = Date.now()): string {
  const r = remaining(finalAt, now);
  if (r.done) return "final now";
  if (r.days > 0) return `${r.days} ${r.days === 1 ? "day" : "days"}`;
  if (r.hours > 0) return `${r.hours} ${r.hours === 1 ? "hour" : "hours"}`;
  if (r.minutes > 0) return `${r.minutes} ${r.minutes === 1 ? "minute" : "minutes"}`;
  return "under a minute";
}
