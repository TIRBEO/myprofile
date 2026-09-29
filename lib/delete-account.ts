"use client";

import { closeRequest, openRequest } from "@/lib/account-history";

/* ═══════════════════════════════════════════════════════════════════
   Account deletion

   There's no server here, so "deleting" is recorded as a scheduled
   close: the moment you asked, and the date it becomes final once the
   grace window runs out. That pair is the only thing written to
   storage — enough for the page to reload into the same state and for
   the countdown to keep running. The agreement tick and the one-time
   code are checked in the sheet and never stored.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:account-deletion";

/** About a month, which is what the page tells the user to expect. */
export const GRACE_DAYS = 30;

const DAY = 86_400_000;

export type DeletionPlan = {
  /** When the close was requested. */
  scheduledAt: number;
  /** When the account becomes permanently gone. */
  finalAt: number;
};

export function readPlan(): DeletionPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeletionPlan>;
    if (typeof parsed?.scheduledAt !== "number" || typeof parsed?.finalAt !== "number") {
      return null;
    }
    return { scheduledAt: parsed.scheduledAt, finalAt: parsed.finalAt };
  } catch {
    return null;
  }
}

/** When a close requested at `from` becomes final. */
export function finalAt(from = Date.now()): number {
  return from + GRACE_DAYS * DAY;
}

/** Records the request and returns the resulting plan. */
export function schedule(): DeletionPlan {
  const now = Date.now();
  const plan: DeletionPlan = { scheduledAt: now, finalAt: finalAt(now) };
  try {
    localStorage.setItem(STORE, JSON.stringify(plan));
  } catch {
    /* private mode — the schedule still holds for this session */
  }
  openRequest("deletion", "deletion");
  return plan;
}

/** Clears a scheduled close and returns the account to normal. */
export function cancel(): null {
  try {
    localStorage.removeItem(STORE);
  } catch {
    /* private mode — nothing to clear */
  }
  closeRequest("deletion", "reversed");
  return null;
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
