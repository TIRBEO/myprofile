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
    and this app forwards (`api/config.ts`). */
const SESSION_COOKIE = "__session";

function secretKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

/** Where a signed-out reader goes: the accounts app owns login. The path they
    asked for rides along, so signing in puts them back where they were. */
function toLogin(request: NextRequest): NextResponse {
  const base = process.env.NEXT_PUBLIC_ACCOUNTS_URL?.replace(/\/+$/, "");
  const target = base ? new URL(`${base}/login`) : new URL("/settings", request.nextUrl);
  if (base) target.searchParams.set("redirect_to", request.nextUrl.href);
  const response = NextResponse.redirect(target);
  // A redirect for a person who isn't signed in is theirs alone; shared caches
  // must not hold it, or the next visitor inherits the wrong answer.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function proxy(request: NextRequest) {
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
