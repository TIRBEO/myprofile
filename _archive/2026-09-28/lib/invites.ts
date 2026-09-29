"use client";

/* ═══════════════════════════════════════════════════════════════════
   Invite records

   The referral entries themselves are written by the sign-up flow in
   lib/referrals under one shared key, so an invite counted here is the
   same record the login page awarded points for. Nothing is fetched and
   nothing is queued: a point exists because a dated row exists.

   Earned is the sum of the awards, redeemed the sum of the spendings,
   and what's ready to redeem falls out of the two. Each reward quotes a
   limit another settings page really enforces, so the number in its
   description can't drift from the number that page applies — but there
   is no server to lift a limit, so a redemption is your own dated record
   of asking, and nothing more.
   ═══════════════════════════════════════════════════════════════════ */

import { awardInviteShare, getReferralStats } from "@/lib/referrals";
import { GRACE_DAYS } from "@/lib/delete-account";
import { RATE_MAX } from "@/lib/download-data";
import { MAX_PASSKEYS } from "@/lib/passkeys";
import { KEEP_DAYS } from "@/lib/your-activity";

const STORE = "tirbeo:referrals";

export type Reward = {
  id: string;
  label: string;
  sub: string;
  cost: number;
};

/** Costs run from a cheap ask to roughly four invites, so the choice is
    about what you'd want rather than about what's reachable. */
export const REWARDS: Reward[] = [
  {
    id: "archives",
    label: "Two more data archives",
    sub: `Raises the daily allowance on Download your data from ${RATE_MAX} to ${RATE_MAX + 2}.`,
    cost: 150,
  },
  {
    id: "trash",
    label: "A longer hold on deleted items",
    sub: `Keeps things in Recently deleted for ${KEEP_DAYS * 3} days instead of ${KEEP_DAYS}.`,
    cost: 300,
  },
  {
    id: "passkeys",
    label: "One more passkey",
    sub: `Raises the passkey limit from ${MAX_PASSKEYS} to ${MAX_PASSKEYS + 1}.`,
    cost: 400,
  },
  {
    id: "grace",
    label: "A wider deletion window",
    sub: `Lengthens the window to cancel a deletion request from ${GRACE_DAYS} to ${GRACE_DAYS * 2} days.`,
    cost: 600,
  },
];

export type InviteRecord = {
  label: string;
  /** When it happened. Old records were written as a text date, which is
      read back here rather than dropped. */
  at: number | null;
  points: number;
};

export type InviteSummary = {
  code: string;
  link: string;
  joined: number;
  earned: number;
  redeemed: number;
  available: number;
  /** Everything that paid in, newest first. */
  income: InviteRecord[];
  /** Everything that was spent, newest first. */
  redemptions: InviteRecord[];
};

type Entry = { type?: unknown; points?: unknown; at?: unknown };
type Stored = { code: string; joined: number; points: number; history: Entry[] };

const EMPTY: Stored = { code: "you", joined: 0, points: 0, history: [] };

function readStored(): Stored {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      code: typeof parsed.code === "string" && parsed.code ? parsed.code : EMPTY.code,
      joined: typeof parsed.joined === "number" ? parsed.joined : 0,
      points: typeof parsed.points === "number" ? parsed.points : 0,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeStored(stored: Stored) {
  try {
    localStorage.setItem(STORE, JSON.stringify(stored));
  } catch {
    /* private mode — the record simply isn't kept between visits */
  }
}

function stampOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function entryOf(entry: Entry): InviteRecord | null {
  if (typeof entry?.type !== "string") return null;
  const points = typeof entry.points === "number" ? entry.points : 0;
  return { label: entry.type, at: stampOf(entry.at), points };
}

export function readInvites(): InviteSummary {
  const stored = readStored();
  const { code, link } = getReferralStats();
  const records = stored.history.map(entryOf).filter((r): r is InviteRecord => r !== null);
  const earned = records.reduce((sum, r) => (r.points > 0 ? sum + r.points : sum), 0);
  const redeemed = records.reduce((sum, r) => (r.points < 0 ? sum - r.points : sum), 0);

  return {
    code,
    link,
    joined: stored.joined,
    earned,
    redeemed,
    available: earned - redeemed,
    income: records.filter((r) => r.points > 0),
    redemptions: records.filter((r) => r.points < 0),
  };
}

/** Copying the link counts as a share, which lib/referrals pays for. */
export function recordShare(): InviteSummary {
  try {
    awardInviteShare();
  } catch {
    /* private mode — the link still made it onto the clipboard */
  }
  return readInvites();
}

export type RedeemResult =
  | { ok: true; summary: InviteSummary }
  | { ok: false; reason: "short"; shortBy: number };

/** Takes the cost off the balance and dates the entry, in the same record
    list the awards live in, so the two always add up to what's shown. */
export function redeem(reward: Reward): RedeemResult {
  const summary = readInvites();
  if (summary.available < reward.cost) {
    return { ok: false, reason: "short", shortBy: reward.cost - summary.available };
  }

  const stored = readStored();
  stored.points -= reward.cost;
  stored.history.unshift({ type: reward.label, points: -reward.cost, at: Date.now() });
  writeStored(stored);
  return { ok: true, summary: readInvites() };
}
