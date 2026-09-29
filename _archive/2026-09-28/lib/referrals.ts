"use client";

/* ── Tirbeo referral system (client-side, localStorage-backed) ────────
   Works across apps on the same origin. Future apps can import
   getReferralStats / captureReferral from here.                        */

export type ReferralStats = {
  code: string;
  link: string;
  invitesJoined: number;
  points: number;
};

const KEY = "tirbeo:referrals";
/** Exported so the invites page can quote what a join and a share are worth
    instead of restating numbers that would drift from these. */
export const POINTS_PER_SIGNUP = 100;
export const POINTS_PER_INVITE_SENT = 10;

/** When a record happened, as an instant. The pages that list these render
    it in the reader's own locale and time zone, so a text date written here
    would freeze it in whoever filed it. */
type ReferralData = {
  code: string;
  joined: number;
  points: number;
  history: { type: string; points: number; at: number }[];
};

function read(): ReferralData {
  if (typeof window === "undefined") {
    return { code: "you", joined: 0, points: 0, history: [] };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReferralData>;
      return {
        code: parsed.code ?? "you",
        joined: parsed.joined ?? 0,
        points: parsed.points ?? 0,
        history: parsed.history ?? [],
      };
    }
  } catch {
    // corrupted — reset
  }
  return { code: "you", joined: 0, points: 0, history: [] };
}

function write(data: ReferralData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/** Origin-aware signup link: localhost:3000 in dev, tirbeo.app in prod. */
export function getReferralStats(): ReferralStats {
  const data = read();
  const origin =
    typeof window !== "undefined"
      ? window.location.origin // e.g. http://localhost:3000
      : "https://tirbeo.app";
  return {
    code: data.code,
    link: `${origin}/settings?ref=${data.code}`,
    invitesJoined: data.joined,
    points: data.points,
  };
}

export function getReferralHistory(): ReferralData["history"] {
  return read().history;
}

/** Call when someone signs up through ?ref=CODE (from login/signup page). */
export function captureReferral(code: string) {
  if (!code || typeof window === "undefined") return;
  try {
    sessionStorage.setItem("tirbeo:ref", code);
  } catch {
    // ignore
  }
}

/** Called after successful signup — awards points to the referrer. */
export function completeSignup() {
  if (typeof window === "undefined") return;
  let ref: string | null = null;
  try {
    ref = sessionStorage.getItem("tirbeo:ref");
    sessionStorage.removeItem("tirbeo:ref");
  } catch {
    return;
  }
  if (!ref) return;
  const data = read();
  data.joined += 1;
  data.points += POINTS_PER_SIGNUP;
  data.history.unshift({
    type: `Someone joined with your invite (${ref})`,
    points: POINTS_PER_SIGNUP,
    at: Date.now(),
  });
  write(data);
}

/** Points for sharing the invite link. */
export function awardInviteShare() {
  const data = read();
  data.points += POINTS_PER_INVITE_SENT;
  data.history.unshift({
    type: "Shared your invite link",
    points: POINTS_PER_INVITE_SENT,
    at: Date.now(),
  });
  write(data);
}
