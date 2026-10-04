/**
 * The one hop this service is allowed to make — and the two shortcuts that
 * usually mean the hop never happens.
 *
 * Profile *reads* try, cheapest first: this process's cache (cache.ts, via
 * profile.ts), then the main API's Redis (`auth:session:*`, any warm profile
 * copy), then the account row in the shared Postgres. Only a miss on all
 * three crosses the HTTP line to `internal/profile`. Writes always cross it:
 * the main server is the brain, and a write carries the audit event, the
 * notification and the cache bust that only it may produce.
 *
 * Writes are never retried. A timed-out PATCH may or may not have landed;
 * replaying it turns "we don't know" into two competing writes, so the caller
 * gets an ambiguous error and the UI says so.
 */

import { loadConfig, SESSION_COOKIE_NAME } from "./config";
import { verifySessionJwt } from "./session";
import {
  readSessionIdentity,
  readSessionState,
  readCachedProfile,
  publishProfileChanged,
  type SessionIdentity,
} from "./redis";
import { readProfileRow, isDirectReadConfigured } from "./db";

export type UpstreamError = {
  kind: "unavailable" | "timeout" | "rejected" | "ambiguous" | "invalid";
  status?: number;
  message: string;
  /** Present when the account service agreed with us about the request and
      named the offending fields (400/409), so the screen can put the note
      under the right input instead of calling the whole service unavailable. */
  fields?: Record<string, string>;
};

export class UpstreamFailure extends Error {
  readonly upstream: UpstreamError;
  constructor(upstream: UpstreamError) {
    super(upstream.message);
    this.name = "UpstreamFailure";
    this.upstream = upstream;
  }
}

type CallOptions = {
  method: "GET" | "PATCH";
  userId: string;
  body?: unknown;
  /** Forwarded only for the session lookup, which the main server can answer
      and nothing else can. Never attached to a profile call. */
  cookie?: string;
  signal?: AbortSignal;
  /** Attached to a write as the `x-origin-*` set — see `originFacts`. */
  origin?: OriginFacts;
};

/**
 * What the browser told *this* service about the request.
 *
 * The account service owns the write, but it is reached from inside the
 * network: read the headers off that hop and the change record blames the
 * datacentre for every edit. So the facts are collected here, where the
 * browser's request actually lands, and carried across.
 */
export type OriginFacts = {
  ip: string | null;
  userAgent: string | null;
  city: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
};

const JUNK = new Set(["", "undefined", "null", "unknown"]);

function clean(value: string | null): string | null {
  const trimmed = (value || "").trim();
  return JUNK.has(trimmed.toLowerCase()) ? null : trimmed;
}

/** The client at the head of a proxy chain — the rest of the list is hops. */
function firstInList(value: string | null): string | null {
  return clean((value || "").split(",")[0]);
}

export function originFacts(headers: Headers): OriginFacts {
  return {
    ip: firstInList(headers.get("x-forwarded-for")) ?? clean(headers.get("x-real-ip")),
    userAgent: clean(headers.get("user-agent")),
    // Whichever edge is in front; the account service ignores a code it does
    // not recognise rather than storing "XX" as if it were a country.
    city: clean(headers.get("x-vercel-ip-city")) ?? clean(headers.get("cf-city")),
    country: clean(headers.get("x-vercel-ip-country")) ?? clean(headers.get("cf-ipcountry")),
    // Only Vercel resolves an address to a point; the account service checks
    // the numbers before anything is pinned from them.
    lat: clean(headers.get("x-vercel-ip-latitude")),
    lng: clean(headers.get("x-vercel-ip-longitude")),
  };
}

const ORIGIN_HEADERS: Record<keyof OriginFacts, string> = {
  ip: "x-origin-ip",
  userAgent: "x-origin-user-agent",
  city: "x-origin-city",
  country: "x-origin-country",
  lat: "x-origin-lat",
  lng: "x-origin-lng",
};

/**
 * These values came from a browser, and they are about to be put on another
 * request. A CR or LF in one would be header injection, and any other control
 * character makes fetch throw — so they are stripped, and the length is capped
 * at what a real user agent, city or address is.
 */
function safeHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const printable = value.replace(/[^\x20-\x7e]/g, "").trim();
  if (!printable) return null;
  return printable.length > 300 ? printable.slice(0, 300) : printable;
}

async function call<T>(opts: CallOptions): Promise<T> {
  const config = loadConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const url = `${config.mainApiBaseUrl}/api/internal/profile`;
  const headers: Record<string, string> = {
    "x-internal-token": config.internalToken,
    "x-user-id": opts.userId,
    accept: "application/json",
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin) {
    for (const [key, name] of Object.entries(ORIGIN_HEADERS) as [keyof OriginFacts, string][]) {
      const value = safeHeaderValue(opts.origin[key]);
      if (value) headers[name] = value;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error: any) {
    clearTimeout(timer);
    const timedOut = error?.name === "AbortError";
    /* A write that timed out is the ambiguous case the header comment is about.
       A read that timed out is just a miss. */
    if (timedOut && opts.method === "PATCH") {
      throw new UpstreamFailure({
        kind: "ambiguous",
        message: "The account service did not answer in time. The change may or may not have been saved.",
      });
    }
    throw new UpstreamFailure({
      kind: "timeout",
      message: "The account service took too long to answer.",
    });
  }
  clearTimeout(timer);

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    /* A 400/409 is the account service answering the request, not failing it:
       a value this side let through was rejected on the row's own terms. The
       field errors travel back unchanged so the caller sees a validation
       message and not "the service is unavailable". */
    if (response.status === 400 || response.status === 409) {
      throw new UpstreamFailure({
        kind: "invalid",
        status: response.status,
        message: parsed?.error || "Some fields need attention before this can be saved.",
        fields:
          parsed?.fields && typeof parsed.fields === "object" ? (parsed.fields as Record<string, string>) : {},
      });
    }
    throw new UpstreamFailure({
      kind: response.status === 401 || response.status === 403 ? "rejected" : "unavailable",
      status: response.status,
      message: parsed?.error || `The account service responded ${response.status}.`,
    });
  }

  if (!parsed) {
    throw new UpstreamFailure({ kind: "unavailable", message: "The account service returned an unreadable response." });
  }
  return parsed as T;
}

/* ── The HTTP path — writes, and the read of last resort ────────── */

export async function readProfileHttp(userId: string, signal?: AbortSignal) {
  return call<Record<string, unknown>>({ method: "GET", userId, signal });
}

export async function writeProfile(
  userId: string,
  patch: Record<string, unknown>,
  signal?: AbortSignal,
  origin?: OriginFacts,
) {
  const updated = await call<Record<string, unknown>>({ method: "PATCH", userId, body: patch, signal, origin });
  // A courtesy to the rest of the fleet: any other process holding a warm
  // copy of this row hears about the change immediately instead of at TTL.
  void publishProfileChanged(userId);
  return updated;
}

/* ── The direct read chain: Redis, then the database ─────────────── */

/** A miss everywhere below costs one HTTP hop, so the chain is only worth
    its own round trips when it can actually answer. Redis first (~1ms),
    then Postgres (~2–15ms), then the brain. */
export async function readProfileDirect(userId: string): Promise<Record<string, unknown> | null> {
  // 1. A warm copy in the main API's own Redis.
  const warm = await readCachedProfile(userId);
  if (warm) return normaliseRow(warm);

  // 2. The account row itself. Read-only; a not-found is a real answer.
  if (isDirectReadConfigured()) {
    const result = await readProfileRow(userId);
    if (result.kind === "row") return normaliseRow(rowToWire(result.row));
    if (result.kind === "not_found") return null;
    // unavailable → fall through to the main server, which may still answer.
  }

  return undefined as unknown as null; // "nothing direct worked" — caller decides
}

/** The database row already carries the wire field names; a Redis copy
    does too, but its dates may be strings from JSON round-trips. */
function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const key of ["birthday", "createdAt", "updatedAt"]) {
    if (typeof out[key] === "string") {
      const parsed = new Date(out[key] as string);
      out[key] = Number.isNaN(parsed.getTime()) ? out[key] : parsed;
    }
  }
  return out;
}

function rowToWire(row: Record<string, unknown>): Record<string, unknown> {
  return row;
}

/**
 * The one hop this service is still allowed for a session question: the main
 * server's `/api/auth/session`. Before it is paid, Redis is asked directly —
 * the identity cache first (the same answer the brain would give, warm), then
 * the session registry (the durable answer). A revoked session is absent or
 * flagged in both, and neither is trusted past the brain's own TTL.
 */
export async function lookupSessionCookie(cookieValue: string): Promise<string | null> {
  // The cookie is a signed JWT: its `sid` is only worth asking Redis about
  // once the account service's own signature on it has been checked.
  const sid = (await verifySessionJwt(cookieValue))?.sid ?? null;
  if (sid) {
    const identity = await readSessionIdentity(sid);
    if (identity) return identity.userId;

    const state = await readSessionState(sid);
    if (state) return state.userId;

    // `null` (asked, key absent) on BOTH keys means the session is not in
    // Redis at all — an unknown or fully-expired session. `undefined` (Redis
    // unreachable) means we don't know. Only the unknown case falls through.
  }

  const config = loadConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.mainApiBaseUrl}/api/auth/session`, {
      method: "GET",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: { id?: unknown } };
    return typeof body?.user?.id === "string" ? body.user.id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type { SessionIdentity };


