/**
 * Who is making this request.
 *
 * This app must never take a user id from a header the browser set — that
 * would let anyone read or write someone else's profile by typing an id. So
 * identity comes from a credential, and only two kinds are accepted:
 *
 *   1. `Authorization: Bearer <jwt>` — verified here, locally, with the shared
 *      HS256 secret. No network call at all, which is the whole point of the
 *      split: the main server does not see these requests.
 *   2. The `__session` cookie — opaque, and only the main server can say
 *      whether it is live. Resolved once and cached for a short window, so a
 *      page that makes four profile calls costs one hop to the main server
 *      instead of four.
 *
 * Anything else the browser may have sent in `x-user-id` is dropped on the
 * floor; the transport sets that header itself, after this has run.
 */

import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "./config";

export type Identity = { userId: string; via: "jwt" | "cookie" };

const COOKIE_NAME = SESSION_COOKIE_NAME;
/** How long a cookie-backed identity is reused. Short, because revocation has
    to land reasonably soon; long enough that one page load is one hop. */
const COOKIE_IDENTITY_TTL_MS = 30_000;
const COOKIE_CACHE_MAX = 500;

const cookieCache = new Map<string, { userId: string; expiresAt: number }>();

async function verifyBearer(token: string): Promise<string | null> {
  const claims = await verifySessionJwt(token);
  return claims?.sub ?? null;
}

/**
 * Proof that a `__session` cookie was signed by the account service.
 *
 * A session id on its own is an identifier, not a secret — it is a row's
 * primary key, and it appears in the device list. So nothing may treat a
 * cookie as live because its `sid` claim is known to Redis; the signature is
 * the only part of it a browser cannot mint for somebody else.
 *
 * `null` on a missing secret too: an app that cannot check a credential has
 * no business guessing that it is valid.
 */
export async function verifySessionJwt(
  token: string,
): Promise<{ sub: string; sid: string } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    /* No `iss`/`aud` check: the account service signs `{sub, sid}` with HS256,
       issued-at and expiry only, so requiring either would reject every token
       it legitimately mints. */
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

/** A cookie is a bearer of privilege, so it is never stored in plain: the cache
    key is a digest of it, which dies with the process. */
async function digest(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** `resolveIdentity` needs the main server for a cookie, and the main server's
    address and service token live with the transport. Taken as a callback so
    this module does not import it — transport imports config, config must not
    import this. */
export type CookieLookup = (cookieValue: string) => Promise<string | null>;

export function createIdentityResolver(lookupCookie: CookieLookup) {
  return async function resolveIdentity(headers: Headers): Promise<Identity | null> {
    const header = headers.get("authorization");
    if (header?.startsWith("Bearer ")) {
      const userId = await verifyBearer(header.slice(7).trim());
      /* A token that verifies but is not issued for this app is still a
         verified identity — the signature is the proof. No fallback to the
         cookie, or a bad bearer header silently escalates to a second subject. */
      return userId ? { userId, via: "jwt" } : null;
    }

    const cookie = readCookie(headers.get("cookie"), COOKIE_NAME);
    if (!cookie) return null;

    const key = await digest(cookie);
    const hit = cookieCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return { userId: hit.userId, via: "cookie" };

    const userId = await lookupCookie(cookie);
    if (!userId) {
      cookieCache.delete(key);
      return null;
    }

    if (cookieCache.size >= COOKIE_CACHE_MAX) {
      /* Bounded so a flood of distinct cookies cannot grow this without
         limit; the oldest entries go first. */
      for (const [k, v] of cookieCache) {
        if (v.expiresAt <= Date.now()) cookieCache.delete(k);
      }
      while (cookieCache.size >= COOKIE_CACHE_MAX) {
        const oldest = cookieCache.keys().next().value;
        if (oldest === undefined) break;
        cookieCache.delete(oldest);
      }
    }
    cookieCache.set(key, { userId, expiresAt: Date.now() + COOKIE_IDENTITY_TTL_MS });
    return { userId, via: "cookie" };
  };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value ? decodeURIComponent(value) : null;
  }
  return null;
}

/** Headers a browser is not allowed to set for itself. Stripped before the
    remaining headers are read, so a request cannot name its own subject. */
export const FORBIDDEN_INBOUND_HEADERS = ["x-user-id", "x-internal-token"] as const;

export function stripPrivilegedHeaders(headers: Headers): Headers {
  const out = new Headers(headers);
  for (const h of FORBIDDEN_INBOUND_HEADERS) out.delete(h);
  return out;
}
