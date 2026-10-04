/**
 * Configuration for the profile service, read once at boot rather than
 * scattered through the handlers — a missing secret should fail loudly at
 * startup, not on the first write a user makes.
 *
 * The read path has three layers, cheapest first:
 *
 *   1. this process's own memory (cache.ts);
 *   2. the main API's Redis (`REDIS_URL` — its session registry and any
 *      warm profile copy, read directly, never written);
 *   3. the account row in Postgres (`DATABASE_URL` — the same database,
 *      read-only from here).
 *
 * Only a miss on all three — and every write — crosses the HTTP line to the
 * main server. The main server is the brain; these are veins.
 */

/** The account service's session cookie. Named once — this app reads it and
    forwards it, and the two must not disagree. */
export const SESSION_COOKIE_NAME = "__session";

/** How long the main API's own session-identity cache entry is trusted when
    it is read directly from Redis. Matches the TTL the main server writes
    the key with — a shorter trust here would only re-fetch what the brain
    already refreshed. */
export const SESSION_CACHE_TTL_MS = 60_000;

export type ApiConfig = {
  /** The main API's origin, as reachable from *this* server. Loopback is
      normal here: in development this is `http://localhost:3000`. */
  mainApiBaseUrl: string;
  /** Shared secret proving this call came from the profile service and not
      from a browser impersonating it. */
  internalToken: string;
  /** How long a profile read stays valid in this process's memory. */
  readCacheTtlMs: number;
  /** Upstream call budget. */
  timeoutMs: number;
  /** The main API's Redis, when the direct vein is wired. */
  redisUrl: string | null;
  /** The account database, when the direct vein is wired. */
  databaseUrl: string | null;
};

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): ApiConfig {
  const internalToken = process.env.INTERNAL_API_SECRET || "";
  if (!internalToken) {
    throw new Error(
      "INTERNAL_API_SECRET is not set. Without it the main API cannot tell a profile-service " +
        "call from a browser one, and every internal read would have to fall back to per-request " +
        "session lookups.",
    );
  }
  return {
    mainApiBaseUrl: (process.env.API_INTERNAL_BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
    internalToken,
    readCacheTtlMs: int("PROFILE_CACHE_TTL_MS", 15_000),
    timeoutMs: int("PROFILE_TIMEOUT_MS", 10_000),
    redisUrl: process.env.REDIS_URL || null,
    databaseUrl: process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || null,
  };
}
