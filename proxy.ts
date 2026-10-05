/**
 * The door, not the lock.
 *
 * Every screen under /settings belongs to one signed-in person, and none of
 * them used to be guarded before the browser got them: the shell (rail,
 * search, nav groups, log-out button) was rendered in the very first HTML, and
 * the check for a session only ran after hydration. A logged-out visitor — or
 * a cache that had never seen one — therefore saw the dashboard's structure,
 * and a page rendered for one person could be served to the next.
 *
 * This runs before a single byte of page HTML is produced, so there is no
 * frame to see and nothing to cache.
 *
 * What it proves, and what it deliberately doesn't: the cookie is a 15-minute
 * HS256 JWT that the account service signs, so a signature and expiry check
 * here is enough to tell "someone who logged in" from "anyone". It is not
 * enough to tell a session that was revoked two minutes ago — that answer is
 * in the brain's Redis registry, which this edge runtime cannot reach without
 * a network hop per request. So revoked-but-unexpired cookies still get their
 * data bounced: every read here goes through the bridge, which forwards the
 * cookie to the brain and answers 401, and the shell's own probe redirects on
 * that. The trade is one fast, cache-proof gate at the edge plus a second
 * authoritative check on every data path — not a slower gate that is also the
 * only one.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const config = {
  /** Pages only. `/api/*` is the bridge: forwarding an absent or stale cookie
      and letting the brain answer 401 is its job, and turning that into a
      redirect would hand an HTML login page to a fetch expecting JSON.
      `_next` and anything with a file extension are assets. */
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};

/** Mirrors the cookie name the account service sets (`features/auth/jwt.ts`)
    and this app forwards (`bridge/config.ts`). */
const SESSION_COOKIE = "__session";

/**
 * Pages that exist *before* a session does, so the gate must not touch them.
 *
 * `/oauth-complete` is the crux: a first social sign-in lands here with no
 * `__session` cookie yet — the account row is only written when the form is
 * submitted. Guarding it bounced the visitor to the accounts login with
 * `redirect_to` pointing straight back here, and back again forever. `/login`
 * is the signed-out fallback, so it is public by definition.
 */
const PUBLIC_PATHS = ["/login", "/oauth-complete"];

function secretKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

/** Where a signed-out reader goes: the accounts app owns login. The path they
    asked for rides along, so signing in puts them back where they were. */
function toLogin(request: NextRequest): NextResponse {
  const base = accountsOrigin(request);
  const target = base ? new URL(`${base}/login`) : new URL("/settings", request.nextUrl);
  if (base) {
    // Send them back to the host they actually arrived on, not the container's
    // bind address — so a production login returns to *.tirbeo.com.
    const { origin } = requestOrigin(request);
    const here = origin
      ? `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`
      : request.nextUrl.href;
    target.searchParams.set("redirect_to", here);
  }
  const response = NextResponse.redirect(target);
  // A redirect for a person who isn't signed in is theirs alone; shared caches
  // must not hold it, or the next visitor inherits the wrong answer.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * The origin the visitor actually arrived on. Behind Vercel (and any proxy) the
 * forwarded/host headers are authoritative; `nextUrl.host` can be the runtime's
 * own bind address, so it is only a last resort. `origin` is null when no host
 * can be determined, in which case callers fall back to `nextUrl.href`.
 */
function requestOrigin(request: NextRequest): { origin: string | null; hostname: string } {
  const raw =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host ||
    "";
  const host = raw.split(",")[0].trim().toLowerCase();
  const hostname = host.split(":")[0];
  const fwdProto = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto =
    fwdProto === "http" || fwdProto === "https"
      ? fwdProto
      : hostname === "localhost" || hostname === "127.0.0.1" || hostname === ""
        ? "http"
        : "https";
  return { origin: host ? `${proto}://${host}` : null, hostname };
}

/**
 * The accounts app's origin, chosen so a visit is always sent to the login
 * page on the *same* deployment it came from — never a hardcoded localhost.
 *
 * On a tirbeo.com / tirbeo.app host the request's own host is authoritative and
 * resolves to accounts.<parent> (same protocol), so a production visitor is
 * never bounced to a localhost address even if one is configured. Off those
 * domains it falls back to an explicit NEXT_PUBLIC_ACCOUNTS_URL, then the local
 * accounts port on localhost, then a same-origin hop for an unrecognised host.
 */
function accountsOrigin(request: NextRequest): string | null {
  const { hostname } = requestOrigin(request);
  const parent = hostname.match(/(?:^|\.)(tirbeo\.(?:com|app))$/i);
  if (parent) {
    const { origin } = requestOrigin(request);
    const proto = origin ? `${origin.split("//")[0]}//` : "https://";
    return `${proto}accounts.${parent[1].toLowerCase()}`;
  }
  const explicit = process.env.NEXT_PUBLIC_ACCOUNTS_URL?.replace(/\/+$/, "");
  // A stale loopback NEXT_PUBLIC_ACCOUNTS_URL (from a dev .env.local) must never
  // send a production visitor to localhost.
  if (explicit && !(process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(explicit))) {
    return explicit;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:3002";
  // Unknown host in production (preview/alias domain): the canonical accounts
  // app — returning null here would send toLogin to same-origin /settings,
  // which is itself gated, and the redirect would loop.
  if (process.env.NODE_ENV === "production") return "https://accounts.tirbeo.com";
  return null;
}

export async function proxy(request: NextRequest) {
  // Pre-auth pages are never gated — see PUBLIC_PATHS.
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const pass = NextResponse.next();
    pass.headers.set("Cache-Control", "no-store");
    return pass;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return toLogin(request);

  const key = secretKey();
  // Fail closed: a settings app that can't check its own session cookie has no
  // business guessing that the visitor belongs to someone.
  if (!key) return toLogin(request);

  try {
    /* No `iss`/`aud` check — the account service signs `{sub, sid}` with HS256,
       issued-at and expiry only, so requiring either here would reject every
       token it legitimately mints. `sub` and `sid` are checked because a
       signature over a token that names no user and no session is not a
       session. */
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return toLogin(request);
    }
  } catch {
    return toLogin(request);
  }

  const response = NextResponse.next();
  // The page behind this gate is per-person and freshly checked, so it must
  // never be stored — not by a browser, not by a CDN in front of one.
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  return response;
}
