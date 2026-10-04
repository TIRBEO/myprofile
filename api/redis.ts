/**
 * The vein that carries reads straight from Redis.
 *
 * The main API is the brain — it owns every write, every session grant and
 * every revocation. But its session registry (`auth:session:<sid>`) and its
 * session-identity cache (`session:cache:<sid>`) live in Redis, and the same
 * REDIS_URL reaches them from here. Reading those keys directly answers
 * "is this session live, and whose is it" in one round trip instead of one
 * HTTP hop to the main server per request — which is the whole point of this
 * service existing.
 *
 * Nothing here writes. A writer that wasn't the main server would be a second
 * brain, and two brains disagree.
 *
 * Every read degrades quietly: Redis being down costs a hop to the main
 * server, not an outage.
 */

import { SESSION_CACHE_TTL_MS } from "./config";

type Client = any; // ioredis, lazy-required so the app builds without it

let RedisClass: Client | null = null;
function redisClass(): Client {
  if (!RedisClass) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RedisClass = require("ioredis").default || require("ioredis");
  }
  return RedisClass;
}

const g = globalThis as unknown as { __myprofileRedis?: Client | null };

export function getRedis(): Client | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (g.__myprofileRedis) return g.__myprofileRedis;

  const Redis = redisClass();
  const client = new Redis(url, {
    // Upstash (and similar) close idle connections after ~30–60s; these four
    // lines are the difference between a cache and a reconnect storm.
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 10_000,
    retryStrategy: (times: number) => (times > 10 ? null : Math.min(times * 200, 10_000)),
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
  });
  client.on("error", () => {
    /* ioredis emits an error event on every dropped socket; the retry
       strategy handles recovery and callers handle the null answer. */
  });
  client.connect().catch(() => {});
  g.__myprofileRedis = client;
  return client;
}

/** A keep-alive ping, so an idle process doesn't hand its socket back. */
const g2 = globalThis as unknown as { __myprofileRedisPing?: NodeJS.Timeout };
if (!g2.__myprofileRedisPing && typeof process !== "undefined" && !process.env.VERCEL) {
  g2.__myprofileRedisPing = setInterval(() => {
    const client = getRedis();
    if (client?.status === "ready") client.ping().catch(() => {});
  }, 25_000);
  g2.__myprofileRedisPing.unref?.();
}

/** How long a negative (missing-key) answer is trusted before asking again. */
export const NEGATIVE_TTL_MS = 15_000;

/** The main API's own key names — read, never written. */
export const SESSION_STATE_KEY = (sid: string) => `auth:session:${sid}`;
export const SESSION_IDENTITY_KEY = (sid: string) => `session:cache:${sid}`;

export type SessionIdentity = {
  userId: string;
  email: string;
  sessionId: string;
  adminRole: string | null;
};

export type SessionState = {
  userId: string;
  revoked: boolean;
  createdAt: number;
};

async function getJson(key: string): Promise<unknown> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return undefined; // "no redis" — distinct from a miss
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return undefined;
  }
}

/**
 * The session-identity cache the main API keeps warm for its own reads.
 * `undefined` means Redis could not be asked; the caller falls back to the
 * main server. `null` means it was asked and the key is not there.
 */
export async function readSessionIdentity(sid: string): Promise<SessionIdentity | null | undefined> {
  const value = await getJson(SESSION_IDENTITY_KEY(sid));
  if (value === undefined || value === null) return value;
  const row = value as Partial<SessionIdentity>;
  return typeof row.userId === "string" ? (row as SessionIdentity) : null;
}

/**
 * The session registry itself — the durable answer. A revoked session is
 * either absent or flagged, and both mean "no".
 */
export async function readSessionState(sid: string): Promise<SessionState | null | undefined> {
  const value = await getJson(SESSION_STATE_KEY(sid));
  if (value === undefined || value === null) return value;
  const row = value as Partial<SessionState>;
  if (typeof row.userId !== "string") return null;
  if (row.revoked) return null;
  return row as SessionState;
}

/**
 * A profile read served from Redis. The main API keeps a short-lived copy of
 * the account row under `profile:cache:<userId>` when it serves its own
 * public profile reads; when the key is there, this service answers without
 * touching the main server at all. Always stale-by-TTL, never by guesswork.
 */
export const PROFILE_CACHE_KEY = (userId: string) => `profile:cache:${userId}`;

export async function readCachedProfile(userId: string): Promise<Record<string, unknown> | null | undefined> {
  return getJson(PROFILE_CACHE_KEY(userId)) as Promise<Record<string, unknown> | null | undefined>;
}

/** Publishes an invalidation the main server can subscribe to. Fire-and-
    forget: the write already went through the main server, so this only
    shortens the window its own caches stay warm. */
export async function publishProfileChanged(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return;
  try {
    await redis.publish("profile:changed", userId);
  } catch {
    /* the write is already durable; this is a courtesy */
  }
}

export { SESSION_CACHE_TTL_MS };
