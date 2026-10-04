"use client";

/* ═══════════════════════════════════════════════════════════════════
   Client session.

   This app doesn't issue its own sessions any more. The credential that
   matters is the real `__session` cookie the accounts API sets on login
   (httpOnly, so it can't be read from here — only *asked about*), and
   the profile endpoint answers 401 the moment it stops being live.

   What this module still owns is the browser-side half:

   • an auth probe (`probeSessionState`) that asks the profile endpoint
     whether the cookie is live — and distinguishes "no" from "no answer",
     because only the first of those is a signed-out reader;
   • the inactivity watchdog, driven by the same "stay signed in"
     preference the accounts app keeps (a session cookie dies with the
     browser; a persistent one is honoured for its server-set lifetime);
   • the sign-out hand-off, which ends on the accounts login rather
     than minting a local token.
   ═══════════════════════════════════════════════════════════════════ */

import { fetchProfile } from "@/lib/api-client";
import { clearAccountTraces } from "@/lib/account-cache";

const PREF_KEY = "tirbeo:security";
const LAST_ACTIVE_KEY = "tirbeo:last-active";

/** Cached answer of the auth probe, so the shell doesn't refetch per page. */
const PROBE_TTL_MS = 30_000;

/**
 * What the last probe found.
 *
 * `unavailable` is deliberately its own answer. Asking the profile endpoint
 * is the only honest way to know whether the cookie is live, and a service
 * that cannot answer is not the same thing as a session that has ended — so
 * only `unauthorized` is allowed to end a signed-in reader's session. A
 * gateway timeout must never look like a logout.
 */
export type SessionProbe = "ok" | "unauthorized" | "unavailable";

/**
 * Where the probe keeps its answer.
 *
 * On `globalThis`, not in this module. Next can put this module into more than
 * one chunk, and each copy would then carry its own cache and its own request
 * in the air — which is how the shell ended up asking twice on a single mount.
 * One mount, one question: every copy has to find the same state. The key is
 * exported so tests can clear it between cases.
 */
export const PROBE_STORE_KEY = "__tirbeoSessionProbe";

type ProbeStore = {
  /** The last answer, and the moment it stops being worth trusting. */
  cache: { state: SessionProbe; expiresAt: number } | null;
  /** A probe already in the air, shared instead of duplicated. */
  inFlight: Promise<SessionProbe> | null;
  /** Bumped whenever the answer is known without asking (a sign-out). A probe
      already in the air must not write its stale "ok" over it. */
  generation: number;
};

const probe: ProbeStore = (() => {
  const shared = globalThis as unknown as Record<string, ProbeStore | undefined>;
  return (shared[PROBE_STORE_KEY] ??= { cache: null, inFlight: null, generation: 0 });
})();

export const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
const CHECK_MS = 15_000;

/** Where a signed-out reader goes. The accounts app owns login; its
    address is the one deployment fact this client needs, so it arrives
    as an env var and falls back to the local route in development. */
export function loginUrl(): string {
  const base = process.env.NEXT_PUBLIC_ACCOUNTS_URL;
  return base ? `${base.replace(/\/+$/, "")}/login` : "/login";
}

/** The accounts API origin — the app that owns the session cookies. */
function apiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://api.tirbeo.app";
}

/**
 * Ends the session everywhere:
 * 1. Asks the accounts API to revoke the session row and expire the
 *    `__session` / `__refresh` / `__csrf` cookies on the shared parent
 *    domain (keepalive:true so the request survives the redirect).
 * 2. Clears every browser-side trace (tokens, cached probes, prefs).
 * 3. Notifies other open tabs so they drop their signed-in state too.
 */
export function endSession() {
  if (typeof window === "undefined") return;
  try {
    void fetch(`${apiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* offline — the cookie still dies server-side with the session TTL */
  }
  try {
    for (const key of [
      "tirbeo:security",
      "tirbeo:last-active",
      "tirbeo_session",
    ]) {
      window.localStorage.removeItem(key);
      // Re-write then drop the sync key so same-origin tabs see a storage event.
      window.localStorage.setItem(key, "");
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(
      "tirbeo_session",
      JSON.stringify({ type: "logout", ts: Date.now() }),
    );
  } catch {
    /* private mode */
  }
  // Everything that describes the account rather than the device goes with it:
  // the cached profile, the settings bag, the device log, the answers ticked on
  // activity rows. Left behind, they paint the person who just signed out over
  // whoever signs in next — and a screen that trusts a stale email mails a
  // deletion code to one address while promising you another.
  clearAccountTraces();
  try {
    const bc = new BroadcastChannel("tirbeo:session");
    bc.postMessage({ type: "logout", ts: Date.now() });
    bc.close();
  } catch {
    /* no BroadcastChannel */
  }
  // The session was ended on purpose, so the answer is settled, not unknown.
  probe.generation++;
  probe.cache = { state: "unauthorized", expiresAt: Date.now() + PROBE_TTL_MS };
}

/**
 * Asks the profile endpoint whether the account's session cookie is
 * live, and says which kind of "no" it got back. The cookie itself is
 * httpOnly — this is the only honest way to know. Cached briefly, so one
 * shell load costs at most one probe; `fresh` bypasses that cache when
 * the reader has asked to try again.
 */
export async function probeSessionState(options?: { fresh?: boolean }): Promise<SessionProbe> {
  if (!options?.fresh && probe.cache && probe.cache.expiresAt > Date.now()) return probe.cache.state;
  // Two copies of the shell mounting at once ask once between them.
  if (probe.inFlight) return probe.inFlight;

  const generation = probe.generation;
  probe.inFlight = fetchProfile()
    .then((result): SessionProbe =>
      result.ok
        ? "ok"
        : result.kind === "unauthorized"
          ? "unauthorized"
          : "unavailable",
    )
    .then((state) => {
      // A sign-out landed while this was in the air: its answer is the newer one.
      if (generation === probe.generation) {
        probe.cache = { state, expiresAt: Date.now() + PROBE_TTL_MS };
      }
      return state;
    })
    .finally(() => {
      probe.inFlight = null;
    });

  return probe.inFlight;
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

export function setStaySignedIn(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ savedLogin: on }));
  } catch {
    /* private mode — the server cookie still reflects the account's choice */
  }
  if (!on) window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

/**
 * Signs out: endSession() revokes the server session + cookies, then the
 * browser is handed to the accounts login page (the cookie owner's app).
 */
export function endSessionAndLeave() {
  endSession();
  if (typeof window === "undefined") return;
  window.location.href = loginUrl();
}

/** Called by the shell when the server says the credential is dead. */
export function redirectToLogin() {
  if (typeof window === "undefined") return;
  // Standing on the landing already: navigating to it again is a loop.
  if (window.location.pathname === "/login") return;
  endSession();
  window.location.href = loginUrl();
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
