/**
 * The profile endpoint, served by this app instead of the main API.
 *
 * Two rules the handler exists to enforce:
 *
 *   - The caller's identity comes from a credential, never from a header.
 *     `x-user-id` is deleted from anything the browser sent before it is used,
 *     and the transport sets its own copy after verification.
 *   - A read that has not changed costs no database work. The `ETag` is a
 *     digest of the record this service is already holding, so a reload within
 *     the cache window answers 304 without touching the account service.
 *
 * Lives as a module rather than a route file so /api/[...path] can delegate
 * to it — one serverless function for the whole API surface instead of two.
 */

import { NextResponse } from "next/server";
import { etagOf, matchesEtag } from "./cache";
import { getProfile, patchProfile, type ProfileResult } from "./profile";
import { originFacts } from "./transport";
import { resolveIdentity } from "./instance";
import { stripPrivilegedHeaders } from "./session";

export async function profileGET(request: Request) {
  const identity = await resolveIdentity(stripPrivilegedHeaders(request.headers));
  if (!identity) return unauthorized();

  const result = await getProfile(identity, request.signal);
  if (!result.ok) return fromResult(result);

  const etag = etagOf(result.data);
  if (matchesEtag(request.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers: { etag } });
  }
  return json(result.data, 200, { etag, "cache-control": "private, max-age=0, must-revalidate" });
}

export async function profilePATCH(request: Request) {
  const identity = await resolveIdentity(stripPrivilegedHeaders(request.headers));
  if (!identity) return unauthorized();

  const body = await readJson(request);
  if (!body) {
    return json({ error: "Send a JSON body describing the fields to change.", code: "invalid_json" }, 400);
  }

  /* The change record is written by the account service but happened in this
     browser, so its machine and address are collected here, where the request
     still carries them. */
  const result = await patchProfile(identity, body, request.signal, originFacts(request.headers));
  if (!result.ok) return fromResult(result);

  const etag = etagOf(result.data);
  return json(result.data, 200, { etag });
}

/** A full replace, from this service's point of view: every field the client
    sends is validated and written, and any field it omits is left alone rather
    than cleared. Clearing on omission would turn a partial client into a
    data-loss event. */
export const profilePUT = profilePATCH;

function readJson(request: Request): Promise<Record<string, unknown> | null> {
  return request
    .json()
    .then((value) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null))
    .catch(() => null);
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers });
}

function unauthorized() {
  return json(
    {
      error: "Sign in to read or change a profile.",
      code: "unauthorized",
      /* Where to go is part of the answer: the accounts app owns login,
         and the settings screens move the reader there without guessing. */
      loginUrl: "/login",
    },
    401,
  );
}

function fromResult(result: Exclude<ProfileResult, { ok: true }>) {
  if (result.kind === "unauthorized") return unauthorized();
  if (result.kind === "invalid") {
    return json({ error: "Some fields need attention before this can be saved.", code: "invalid_fields", fields: result.errors }, 400);
  }
  /* 501, not 502: nothing is wrong with the account service — this one has not
     been given the secret it needs to talk to it. Told apart because the fix is
     an environment variable here, not an outage over there. */
  if (result.kind === "not_configured") {
    return json({ error: result.message, code: "not_configured" }, 501);
  }
  return json(
    {
      error: result.message,
      code: result.ambiguous ? "write_unconfirmed" : "upstream_unavailable",
      /* The difference matters to the person reading it: "we don't know" is not
         "it failed", and a screen that says the wrong one is the bug the user
         will actually report. */
      retrySafe: !result.ambiguous,
    },
    result.status,
  );
}
