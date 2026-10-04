"use client";

/* ═══════════════════════════════════════════════════════════════════
   Server-backed settings bag

   One round trip pulls every persisted choice for the signed-in user, keyed
   the same way the localStorage stores were keyed ("tirbeo:language", …). A
   write updates the in-memory bag at once (so the UI never waits on the
   network), mirrors it into localStorage for the first-paint boot scripts and
   for offline, and best-effort PATCHes the single key to the server.

   The server wins on load; the local mirror is a cache, not the truth. That
   ordering is what lets a phone and a laptop converge on the same choices
   instead of each keeping its own — the reason these screens were localStorage
   bound at all was only that the account API did not have somewhere to put
   them. Now it does (preferences.user_preferences.misc.settings).
   ═══════════════════════════════════════════════════════════════════ */

import { apiSend } from "@/lib/api";

type Bag = Record<string, unknown>;

/** Aggregate mirror of the server bag — read for the very first paint, before
    the fetch lands, so a reload shows the last known choices instantly. */
const MIRROR_KEY = "tirbeo:settings-bag";

const listeners = new Set<() => void>();
let bag: Bag | null = null;
let loading: Promise<Bag> | null = null;
let loaded = false;

function readMirror(): Bag {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    return raw ? (JSON.parse(raw) as Bag) : {};
  } catch {
    return {};
  }
}

function writeMirror(next: Bag) {
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the in-memory bag still holds for this session */
  }
}

/** A store also keeps its own localStorage slot so the inline <head> boot
    scripts (theme, language) and any pre-hydration read still find a value. */
function mirrorPerStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function emit() {
  for (const listener of [...listeners]) listener();
}

/** Pull the server bag once per session. Concurrent callers share one fetch. */
export function ensureSettings(): Promise<Bag> {
  if (loaded && bag) return Promise.resolve(bag);
  if (loading) return loading;

  bag = readMirror();
  loading = fetch("/api/settings", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((json: any) => {
      const server: Bag =
        json && typeof json.settings === "object" && json.settings ? json.settings : {};
      bag = { ...(bag as Bag), ...server }; // server wins where it has a value
      loaded = true;
      writeMirror(bag as Bag);
      emit();
      return bag as Bag;
    })
    .catch(() => {
      // Offline: the mirror stands. Don't mark loaded, so the next mount retries.
      loading = null;
      return bag as Bag;
    });

  return loading;
}

/** Pull the server bag again, discarding the once-per-session share — this is
    what a pull-to-refresh on a settings page asks for. */
export function reloadSettings(): Promise<Bag> {
  loaded = false;
  loading = null;
  return ensureSettings();
}

/** The current value for a store — server bag, then the legacy per-store slot
    (for pre-sync data / first paint), then the caller's default. */
export function getStored<T>(key: string, fallback: T): T {
  const source = bag ?? readMirror();
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key] as T;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      /* not valid JSON under this key — fall through to the default */
    }
  }
  return fallback;
}

/** Optimistic write: update bag + mirrors now, persist to the server behind
    the scenes. Returns nothing; a failed persist leaves the local value and
    the next load reconciles. */
export function setStored<T>(key: string, value: T): void {
  bag = { ...(bag ?? readMirror()), [key]: value };
  writeMirror(bag);
  mirrorPerStore(key, value);
  emit();
  persist(key, value);
}

/** Like setStored, but leaves the store's own localStorage slot untouched.
    For values whose boot script reads a raw (non-JSON) value from that slot —
    the theme, which <head> compares against the literal strings "light"/
    "dark". The caller keeps writing that slot itself; this only syncs the bag
    and the server. */
export function pushSetting<T>(key: string, value: T): void {
  bag = { ...(bag ?? readMirror()), [key]: value };
  writeMirror(bag);
  emit();
  persist(key, value);
}

function persist(key: string, value: unknown): void {
  /* Through lib/api, not a raw fetch: the brain gates every cookie-authed
     write on a double-submit token, and a hand-rolled request here would be
     answered 403 — quietly, since nothing reads this reply. */
  void apiSend("/api/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  }).catch(() => {
    /* the write lives in the mirror; it will be re-sent on the next change
       that succeeds, or a reload that comes back online */
  });
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isSettingsLoaded(): boolean {
  return loaded;
}
