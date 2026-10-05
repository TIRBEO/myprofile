/**
 * The same-origin bridge to the account service (the "brain").
 *
 * The settings screens run on this app's origin, but the data behind them
 * lives on the brain, which owns every write (audit events, notifications,
 * cache busts). Rather than hand-write a route per domain, one catch-all
 * forwards the browser's own session cookie to the matching brain endpoint
 * and relays the answer back. Because it only ever carries *this caller's*
 * cookie to *their own* account, it grants no privilege the browser didn't
 * already have — it just avoids a cross-origin hop (and its CORS + cookie
 * scoping) between two services the user is signed into as one session.
 *
 * Deliberately narrow: only the prefixes a settings screen needs are allowed,
 * so this can't be pointed at the brain's admin surface. `/api/profile` is the
 * one locally-served exception — the richer direct read (Redis/DB + ETag)
 * delegated to from here, so the API surface stays one function.
 */

import { NextResponse } from "next/server";
import { loadConfig } from "@/bridge/config";

export const dynamic = "force-dynamic";

/** Brain path prefixes this bridge will forward to. */
const ALLOWED = new Set([
  "settings",
  "preferences",
  "notifications",
  "security",
  "support",
  "user",
  "content",
  // The OAuth links on the account, and what the login ledger says about them.
  "integrations",
]);

/** `auth/*` as a prefix would open the brain's whole signing-in surface —
    login, signup, password reset — to this origin, which needs none of it.
    It needs exactly one thing: the identity proof a sensitive action asks for
    before it runs. So the two re-authentication endpoints are named, not the
    prefix. */
const ALLOWED_AUTH = new Set(["reauth/verify", "reauth/send-code"]);

function permitted(slug: string[]): boolean {
  if (slug[0] === "profile") {
    // /api/profile is served locally; /api/profile/check-username is the
    // brain's availability probe, forwarded so the edit-profile screen can
    // check a username without leaving this origin.
    return slug.length === 1 || (slug.length === 2 && slug[1] === "check-username");
  }
  if (slug[0] === "auth") return ALLOWED_AUTH.has(slug.slice(1).join("/"));
  return ALLOWED.has(slug[0]);
}

function notFound() {
  return NextResponse.json(
    { error: "No such settings endpoint.", code: "not_found" },
    { status: 404 },
  );
}

/** Values collected from a browser and about to be put on another request:
    CR/LF would be header injection and any other control character makes
    fetch throw, so they are stripped and the length capped — same rules the
    profile bridge applies to its own `x-origin-*` set. */
function safeHeaderOriginValue(value: string | null): string | null {
  if (!value) return null;
  const printable = value.replace(/[^\x20-\x7e]/g, "").trim();
  if (!printable) return null;
  return printable.length > 300 ? printable.slice(0, 300) : printable;
}

async function forward(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const slug = (path ?? []).filter(Boolean);
  if (slug.length === 0 || !permitted(slug)) return notFound();

  /* /api/profile is served locally (direct Redis/DB read + token write, ETag
     304s), not forwarded to the brain — it lives in this module so the whole
     API surface stays one serverless function (Hobby plan counts functions
     per region against a low cap). */
  if (slug.length === 1 && slug[0] === "profile") {
    const { profileGET, profilePATCH, profilePUT } = await import("../../../bridge/profile-route");
    switch (request.method) {
      case "GET":
      case "HEAD":
        return profileGET(request);
      case "PATCH":
        return profilePATCH(request);
      case "PUT":
        return profilePUT(request);
      default:
        return notFound();
    }
  }

  const config = loadConfig();
  const target = new URL(`${config.mainApiBaseUrl}/api/${slug.join("/")}`);
  // Carry the query string straight through (?key=…, ?limit=… etc).
  new URL(request.url).searchParams.forEach((value: string, key: string) =>
    target.searchParams.set(key, value),
  );

  const headers: Record<string, string> = { accept: "application/json" };
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  // The brain requires a double-submit CSRF token on every cookie-authed write
  // (POST/PATCH/PUT/DELETE): the X-CSRF-Token header must match the __csrf
  // cookie. Both ride the same origin here, so forward the header through too —
  // otherwise every settings write would 403 while reads work fine.
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) headers["x-csrf-token"] = csrf;
  // A WebAuthn ceremony verifies the origin *inside* the authenticator's
  // signed answer against the origin the account was told to expect. Without
  // this header the brain can only guess from its own host, and the guess is
  // wrong for every page served from this origin — so registration would fail
  // for reasons the owner can't act on.
  const origin = request.headers.get("origin");
  if (origin) headers.origin = origin;
  /* The brain writes a row for every change it accepts, and that row is
     supposed to say which machine made it and where that machine was. From
     its own side the brain only sees this service asking, so the two headers
     that carry the reader's answer have to come along — otherwise the history
     page records that something changed and nothing about who changed it. */
  const agent = request.headers.get("user-agent");
  if (agent) headers["user-agent"] = agent;
  const clientIp = request.headers.get("x-forwarded-for");
  if (clientIp) headers["x-forwarded-for"] = clientIp;
  /* But the GeoIP headers must NOT be forwarded as `x-vercel-ip-*`: Vercel's
     edge overwrites those on every hop, so by the time the brain reads them
     they name this service's datacentre, not the person's phone. The browser's
     real facts travel as the `x-origin-*` set beside the shared service token —
     the same contract the profile bridge already uses for its own writes — and
     the brain believes that set only from a caller holding the token. */
  if (config.internalToken) headers["x-internal-token"] = config.internalToken;
  const originFrom: [string, string][] = [
    ["x-vercel-ip-city", "x-origin-city"],
    ["x-vercel-ip-country", "x-origin-country"],
    ["x-vercel-ip-latitude", "x-origin-lat"],
    ["x-vercel-ip-longitude", "x-origin-lng"],
  ];
  for (const [from, to] of originFrom) {
    const value = safeHeaderOriginValue(request.headers.get(from));
    if (value) headers[to] = value;
  }
  // The client at the head of the chain — the rest of it is hops, including this one.
  const headIp = (clientIp || "").split(",")[0]?.trim();
  if (headIp) headers["x-origin-ip"] = headIp;
  if (agent) {
    const safeAgent = safeHeaderOriginValue(agent);
    if (safeAgent) headers["x-origin-user-agent"] = safeAgent;
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    // Timed out or unreachable: the brain may not have applied the write, so
    // say "unavailable", not "failed" — the client treats them differently.
    return NextResponse.json(
      { error: "The account service is not answering right now.", code: "upstream_unavailable", retrySafe: false },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
