"use client";

/* ═══════════════════════════════════════════════════════════════════
   Connected apps

   Nothing brokers these OAuth links server-side yet, so this is the
   account's own record of which third-party apps hold access and what
   each was granted — the shape the API will hand back later, with seed
   rows standing in. Disconnecting revokes the record and files it under
   recently disconnected; the catalog stays so the same app can be
   reconnected. Scopes are written as plain phrases, never raw strings.

   Only three providers are offered: Google, GitHub and Discord. What a
   record reads off the catalog (name, access, scopes) is filled in from
   there rather than trusted from storage, so an app that has since left
   the catalog drops out of the list instead of rendering half a row.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:connected-apps";
const HISTORY_STORE = "tirbeo:connected-apps:history";

export const MAX_LOG = 8;
export const MAX_CONNECTED = 8;

export type Provider = {
  id: string;
  name: string;
  /** Short phrase for what the app can see, used in the status card. */
  access: string;
  /** One line under the app's name in the "could connect" list. */
  tagline: string;
  /** The example account shown once connected. */
  account: string;
  /** What stops working if you disconnect — the confirm sheet's line. */
  loss: string;
  /** The permissions granted, in words a user reads. */
  scopes: string[];
};

export const PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google",
    access: "your name and email",
    tagline: "Sign in with Google and keep your profile in step.",
    account: "rina.shrestha@gmail.com",
    loss: "Signing in with Google stops, and Tirbeo can no longer read your profile from it.",
    scopes: ["See your name and photo", "See the email you sign in with"],
  },
  {
    id: "github",
    name: "GitHub",
    access: "your public profile",
    tagline: "Sign in with GitHub and show your pinned repositories.",
    account: "rinashrestha",
    loss: "Signing in with GitHub stops and your pinned repositories come off your profile.",
    scopes: ["See your username and avatar", "Read your public repositories"],
  },
  {
    id: "discord",
    name: "Discord",
    access: "your username and avatar",
    tagline: "Sign in with Discord and link your account.",
    account: "rina",
    loss: "Signing in with Discord stops and your linked account is removed.",
    scopes: ["See your username and avatar", "See which servers you're in"],
  },
];

export type ConnectedApp = {
  id: string;
  name: string;
  account: string;
  access: string;
  scopes: string[];
  connectedAt: number;
  lastUsedAt: number;
};

export type DisconnectEvent = {
  id: string;
  provider: string;
  name: string;
  at: number;
};

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function provider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** The catalog entry behind a connected app, for pages that show its loss line. */
export function providerFor(id: string | undefined): Provider | undefined {
  return id ? provider(id) : undefined;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toApp(p: Provider, connectedAt: number, lastUsedAt: number): ConnectedApp {
  return {
    id: p.id,
    name: p.name,
    account: p.account,
    access: p.access,
    scopes: p.scopes,
    connectedAt,
    lastUsedAt,
  };
}

function seed(): ConnectedApp[] {
  const now = Date.now();
  const plan: [string, number, number][] = [
    ["google", 40 * DAY, 3 * MIN],
  ];
  return plan
    .map(([id, connected, used]) => {
      const p = provider(id);
      return p ? toApp(p, now - connected, now - used) : null;
    })
    .filter((a): a is ConnectedApp => a !== null);
}

export function readConnected(): ConnectedApp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) {
      const seeded = seed();
      writeConnected(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<ConnectedApp>[];
    if (!Array.isArray(parsed)) return [];
    // A list saved before apps carried the fields today's pages read off
    // them can't fill those lines in, so it starts over from the seed.
    if (!parsed.every(isApp)) {
      const seeded = seed();
      writeConnected(seeded);
      return seeded;
    }
    const apps = parsed.filter(isApp).map(normalize).filter((a): a is ConnectedApp => a !== null);
    // Nothing left means the record predates the current catalog entirely, so
    // it's stale rather than an honest empty list — and a stored id that no
    // longer resolves never reaches a page.
    if (!apps.length && parsed.length) {
      const seeded = seed();
      writeConnected(seeded);
      return seeded;
    }
    return apps.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
}

/** Re-reads a stored row off the catalog, or drops it if no provider matches. */
function normalize(app: ConnectedApp): ConnectedApp | null {
  const p = provider(app.id);
  if (!p) return null;
  return {
    id: p.id,
    name: app.name || p.name,
    account: app.account || p.account,
    access: p.access,
    scopes: p.scopes,
    connectedAt: app.connectedAt,
    lastUsedAt: app.lastUsedAt,
  };
}

function isApp(value: Partial<ConnectedApp>): value is ConnectedApp {
  return (
    typeof value?.id === "string" &&
    typeof value?.name === "string" &&
    typeof value?.account === "string" &&
    typeof value?.access === "string" &&
    Array.isArray(value?.scopes) &&
    value.scopes.every((s) => typeof s === "string") &&
    typeof value?.connectedAt === "number" &&
    typeof value?.lastUsedAt === "number"
  );
}

/** One connected app by id, for the page that shows nothing but it. */
export function findConnected(id: string | undefined): ConnectedApp | null {
  if (!id) return null;
  return readConnected().find((app) => app.id === id) ?? null;
}

function writeConnected(apps: ConnectedApp[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(apps));
  } catch {
    /* private mode — the change still holds for this session */
  }
}

export function readHistory(): DisconnectEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<DisconnectEvent>[];
    if (!Array.isArray(parsed)) return [];
    // An event for an app no longer offered says nothing a reader can act on.
    return parsed.filter(
      (e): e is DisconnectEvent =>
        typeof e?.name === "string" && (!e.provider || !!provider(e.provider)),
    );
  } catch {
    return [];
  }
}

export type ActionResult = { connected: ConnectedApp[]; history: DisconnectEvent[] };

/** Revokes one app: it leaves the connected list and lands in history. */
export function disconnect(id: string): ActionResult {
  const apps = readConnected();
  const target = apps.find((app) => app.id === id);
  if (!target) return { connected: apps, history: readHistory() };
  writeConnected(apps.filter((app) => app.id !== id));
  const history = [
    { id: newId(), provider: target.id, name: target.name, at: Date.now() },
    ...readHistory(),
  ].slice(0, MAX_LOG);
  try {
    localStorage.setItem(HISTORY_STORE, JSON.stringify(history));
  } catch {
    /* private mode — history simply isn't kept between visits */
  }
  return { connected: readConnected(), history };
}

export type ConnectResult = { ok: true } | { ok: false; reason: "limit" | "unknown" };

/** Grants an app from the catalog its scopes again. */
export function connect(id: string): ConnectResult {
  const p = provider(id);
  if (!p) return { ok: false, reason: "unknown" };
  const apps = readConnected();
  if (apps.some((app) => app.id === id)) return { ok: true };
  if (apps.length >= MAX_CONNECTED) return { ok: false, reason: "limit" };
  const now = Date.now();
  writeConnected([toApp(p, now, now), ...apps]);
  return { ok: true };
}

/** Providers not currently connected — what the "could connect" list offers. */
export function available(): Provider[] {
  const connected = new Set(readConnected().map((app) => app.id));
  return PROVIDERS.filter((p) => !connected.has(p.id));
}
