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

A write the account refuses is not dropped: the switch goes back to where the
account says it is, and the failure is reported to anyone listening
(subscribePersistFailures) — which is what the settings shell turns into a
toast with a way to try again beside it.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";

type Bag = Record<string, unknown>;

/** Aggregate mirror of the server bag — read for the very first paint, before
    the fetch lands, so a reload shows the last known choices instantly. */
const MIRROR_KEY = "tirbeo:settings-bag";

const listeners = new Set<() => void>();
let bag: Bag | null = null;
let loading: Promise<Bag> | null = null;
let loaded = false;

/* ── Write failures ───────────────────────────────────────────────
   A switch moves the moment it is tapped, and the write to the account
   happens behind it. When that write is refused the screen has to say so —
   so every failure is remembered, reported to whoever is listening, and
   kept for a retry. `confirmed` is the bag as the account last answered,
   which is what a refused optimistic value rolls back to. */

export type PersistFailure = { key: string; value: unknown; error: unknown };

const failListeners = new Set<(failure: PersistFailure) => void>();
const failed = new Map<string, unknown>();
const pending = new Set<string>();
let confirmed: Bag | null = null;

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
      confirmed = { ...server };
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
    the scenes. Returns nothing; a persist that the account refuses rolls this
    key back to the account's answer and reports the failure. */
export function setStored<T>(key: string, value: T): void {
  bag = { ...(bag ?? readMirror()), [key]: value };
  writeMirror(bag);
  mirrorPerStore(key, value);
  emit();
  persist(key, value);
}

/** Optimistic write with NO auto-persist — for a caller that is about to
    `await persistNow` itself. Using `setStored` there would fire a second,
    duplicate PATCH for the same key (one fire-and-forget, one awaited), which
    is what made the extra-security switches feel slow. */
export function setStoredLocal<T>(key: string, value: T): void {
  bag = { ...(bag ?? readMirror()), [key]: value };
  writeMirror(bag);
  mirrorPerStore(key, value);
  emit();
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

const adopted = new Set<string>();

/** One-time adoption of a value a store kept in a raw localStorage slot before
    it moved onto the account bag. Once the bag has landed, if it holds nothing
    for `key` but the legacy slot does, carry that value over — the account wins
    where it already has one — and drop the raw slot, so an existing user keeps
    their data on every device. Idempotent and cheap: safe to call on every
    read, it runs at most once per key per session. */
export function adoptLegacy(key: string): void {
  if (typeof window === "undefined" || adopted.has(key)) return;
  adopted.add(key);
  void ensureSettings().then((source) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return;
      pushSetting(key, JSON.parse(raw) as unknown);
      window.localStorage.removeItem(key);
    } catch {
      /* not JSON we recognise — leave the slot; the store's default stands */
    }
  });
}

function persist(key: string, value: unknown): void {
  /* Through lib/api, not a raw fetch: the brain gates every cookie-authed
     write on a double-submit token, and a hand-rolled request here would be
     answered 403 — quietly, which is the thing this whole block exists to
     stop. The reply is the account's merged bag, so a write that succeeded
     settles on the account's answer rather than on what this device hoped;
     a write that was refused rolls the switch back and reports it. */
  pending.add(key);
  failed.delete(key);
  void apiJson<{ settings?: Bag }>("/api/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  })
    .then((reply) => {
      pending.delete(key);
      const server = reply?.settings;
      if (server && typeof server === "object") adopt(server);
    })
    .catch((error) => {
      pending.delete(key);
      failed.set(key, value);
      rollBack(key);
      for (const listener of [...failListeners]) listener({ key, value, error });
    });
}

/** The account's answer becomes the local truth, except for keys another
    write is still carrying — that one is newer than this reply. */
function adopt(server: Bag): void {
  confirmed = { ...(confirmed || {}), ...server };
  const current = bag ?? readMirror();
  const next: Bag = { ...current };
  for (const [key, value] of Object.entries(server)) {
    if (pending.has(key)) continue;
    next[key] = value;
  }
  bag = next;
  writeMirror(next);
  emit();
}

/** A refused write puts the switch back where the account says it is. With
    no account answer to go back to (a first load that never landed), the
    local value stands and the failure is only reported. */
function rollBack(key: string): void {
  if (!confirmed || !Object.prototype.hasOwnProperty.call(confirmed, key)) return;
  if (Object.prototype.hasOwnProperty.call(bag ?? {}, key) && bag![key] === confirmed[key]) return;
  bag = { ...(bag ?? {}), [key]: confirmed[key] };
  writeMirror(bag);
  mirrorPerStore(key, bag[key]);
  emit();
}

/** Every write this session could not land, newest values only. A page that
    offers "try again" reads this before it asks. */
export function failedWrites(): { key: string; value: unknown }[] {
  return [...failed.entries()].map(([key, value]) => ({ key, value }));
}

/** Sends the values the account refused. Resolves once every retry has been
    answered; a retry that fails again is reported the same way. */
export async function retryWrites(): Promise<void> {
  const queue = [...failed.entries()];
  failed.clear();
  await Promise.all(queue.map(([key, value]) => persistNow(key, value)));
}

/** One write, awaited — for callers that need to know the answer rather than
    watch a switch settle (a security toggle that shows a toast either way). */
export async function persistNow(key: string, value: unknown): Promise<void> {
  pending.add(key);
  try {
    const reply = await apiJson<{ settings?: Bag }>("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    pending.delete(key);
    failed.delete(key);
    if (reply?.settings && typeof reply.settings === "object") adopt(reply.settings);
  } catch (error) {
    pending.delete(key);
    failed.set(key, value);
    throw error;
  }
}

export function subscribePersistFailures(
  listener: (failure: PersistFailure) => void,
): () => void {
  failListeners.add(listener);
  return () => {
    failListeners.delete(listener);
  };
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
