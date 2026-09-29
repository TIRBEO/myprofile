"use client";

/* ═══════════════════════════════════════════════════════════════════
   Client session.

   There's no auth backend here, so the "session" is a real browser
   cookie the app issues on its own. That's enough to make the
   "Saved login info" switch actually do something:

   • stay signed in  → cookie carries a 30-day max-age and survives a
                       browser restart, and no inactivity timer runs.
   • don't stay      → cookie is a *session* cookie (browser clears it
                       on close) and an inactivity watchdog signs the
                       user out after an hour with no interaction.
   ═══════════════════════════════════════════════════════════════════ */

const SESSION_COOKIE = "tirbeo_session";
const PREF_KEY = "tirbeo:security";
const LAST_ACTIVE_KEY = "tirbeo:last-active";

const STAY_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
const CHECK_MS = 15_000;

function newToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(";")) {
    const kv = part.trim();
    if (kv.startsWith(target)) return decodeURIComponent(kv.slice(target.length));
  }
  return null;
}

/** `maxAgeSeconds` omitted → a session cookie that dies with the browser. */
function writeCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === "undefined") return;
  let s = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; samesite=lax`;
  if (typeof maxAgeSeconds === "number") s += `; max-age=${maxAgeSeconds}`;
  document.cookie = s;
}

export function isLoggedIn(): boolean {
  return readCookie(SESSION_COOKIE) !== null;
}

export function getStaySignedIn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return true;
    const v = JSON.parse(raw) as { savedLogin?: unknown };
    return typeof v.savedLogin === "boolean" ? v.savedLogin : true;
  } catch {
    return true;
  }
}

function persistPref(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ savedLogin: on }));
  } catch {
    /* private mode — the cookie still reflects this session's choice */
  }
}

function issueCookie(stay: boolean) {
  const token = readCookie(SESSION_COOKIE) ?? newToken();
  writeCookie(SESSION_COOKIE, token, stay ? STAY_MAX_AGE : undefined);
}

/** Called on the login screen: create a session honoring the saved preference. */
export function startSession() {
  const stay = getStaySignedIn();
  issueCookie(stay);
  if (!stay) window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

/** Keep the app browsable even if it's opened straight at /settings. */
export function ensureSession() {
  if (!isLoggedIn()) startSession();
}

/** Flip the switch: persist it, then re-issue the cookie with the right lifetime. */
export function setStaySignedIn(on: boolean) {
  persistPref(on);
  issueCookie(on);
  if (!on) window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

export function endSession() {
  writeCookie(SESSION_COOKIE, "", -1);
  if (typeof window !== "undefined") window.localStorage.removeItem(LAST_ACTIVE_KEY);
}

/**
 * Runs the whole time the account shell is mounted. When "stay signed in"
 * is off, activity keeps a timestamp fresh and a slow timer signs the user
 * out once an hour has passed without any. Returns a cleanup function.
 */
export function watchInactivity(onTimeout: () => void) {
  if (typeof window === "undefined") return () => {};

  let lastWrite = 0;
  const bump = () => {
    if (getStaySignedIn()) return;
    const now = Date.now();
    if (now - lastWrite < 1000) return; // throttle writes to ~1/sec
    lastWrite = now;
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  };

  const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"];
  for (const e of events) window.addEventListener(e, bump, { passive: true });

  const id = window.setInterval(() => {
    if (getStaySignedIn()) return;
    const last = Number(window.localStorage.getItem(LAST_ACTIVE_KEY) ?? Date.now());
    if (Date.now() - last >= INACTIVITY_MS) {
      endSession();
      onTimeout();
    }
  }, CHECK_MS);

  return () => {
    window.clearInterval(id);
    for (const e of events) window.removeEventListener(e, bump);
  };
}
