/**
 * The profile service.
 *
 * Read and write of the one record these screens are about. The transport,
 * cache and validation modules each do a single job; this is where they are
 * ordered, and where the two decisions that affect the main server get made:
 *
 *   - A patch that only touches fields the account row cannot hold makes **no
 *     upstream call at all**. Sending it would be a write that cannot land, and
 *     the user would get a success message for nothing.
 *   - A write drops this account's cached read immediately. Otherwise the
 *     screen reloads from the copy taken before the save and the edit appears
 *     to have been ignored.
 */

import { getCache } from "./instance";
import {
  fromWire,
  toWire,
  unsupportedDetails,
  UNSUPPORTED_FIELDS,
  type ProfileResponse,
} from "./contract";
import { validateProfilePatch } from "./validation";
import { readProfileHttp, readProfileDirect, writeProfile, type OriginFacts, UpstreamFailure } from "./transport";
import type { Identity } from "./session";

export type ProfileResult =
  | { ok: true; data: ProfileResponse }
  | { ok: false; kind: "invalid"; errors: Record<string, string> }
  | { ok: false; kind: "unauthorized" }
  /** This service is not configured — no secret, so it cannot prove who it is
      to the account service. Distinct from "the account service is down": the
      fix is on this side, and an operator reading the log needs to know which. */
  | { ok: false; kind: "not_configured"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; ambiguous: boolean };

/** Fields with no column, always reported — a client needs to know which
    of its rows are backed by the server and which are still only its own.
    Everything the edit-profile screen holds is a real column now, so this is
    the social-graph counts and nothing else; listing a stored field here would
    tell the owner a saved edit had been dropped. */
const READ_GAPS = UNSUPPORTED_FIELDS.map(({ local, reason }) => ({ field: local, reason }));

/**
 * A read tries the veins before the artery: the process cache (checked
 * inside `store.cache.read`), then Redis, then the database — and only when
 * all three miss does it cross the HTTP line to the main server.
 */
async function loadProfile(
  userId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const direct = await readProfileDirect(userId);
  if (direct) return direct;
  if (direct === null) {
    // Asked directly and told "no such account" — the main server would only
    // confirm it, so don't pay the hop.
    throw new UpstreamFailure({ kind: "unavailable", message: "No such account." });
  }
  return readProfileHttp(userId, signal);
}

export async function getProfile(
  identity: Identity,
  signal?: AbortSignal,
): Promise<ProfileResult> {
  const store = openCache();
  if (!store.ok) return store.result;

  try {
    const { value } = await store.cache.read(identity.userId, () => loadProfile(identity.userId, signal));
    return {
      ok: true,
      data: {
        profile: fromWire(value),
        unsupported: READ_GAPS,
        revision: String(value.updatedAt ?? value.createdAt ?? ""),
      },
    };
  } catch (error) {
    return upstreamResult(error);
  }
}

export async function patchProfile(
  identity: Identity,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
  origin?: OriginFacts,
): Promise<ProfileResult> {
  const errors = validateProfilePatch(payload);
  if (Object.keys(errors).length > 0) return { ok: false, kind: "invalid", errors };

  const dropped = unsupportedDetails(payload);
  const wirePatch = toWire(payload);

  const store = openCache();
  if (!store.ok) return store.result;

  /* Nothing the row can hold changed, so there is nothing to send. The edit
     still has to be kept where it lives today — in this browser — and the
     response says plainly which parts did not go up. */
  if (Object.keys(wirePatch).length === 0) {
    const { value } = await store.cache.read(identity.userId, () => loadProfile(identity.userId, signal));
    return {
      ok: true,
      data: {
        profile: fromWire(value),
        unsupported: dropped.length > 0 ? dropped : READ_GAPS,
        revision: String(value.updatedAt ?? value.createdAt ?? ""),
      },
    };
  }

  try {
    const updated = await writeProfile(identity.userId, wirePatch, signal, origin);
    store.cache.invalidate(identity.userId);
    return {
      ok: true,
      data: {
        profile: fromWire(updated),
        unsupported: dropped,
        revision: String(updated.updatedAt ?? updated.createdAt ?? ""),
      },
    };
  } catch (error) {
    return upstreamResult(error);
  }
}

/** `getCache` is where the configuration is read, and it is allowed to throw:
    without a service token this endpoint cannot prove anything to the account
    service, so it must say so instead of half-serving a profile. */
function openCache(): { ok: true; cache: ReturnType<typeof getCache> } | { ok: false; result: ProfileResult } {
  try {
    return { ok: true, cache: getCache() };
  } catch (error: any) {
    return {
      ok: false,
      result: {
        ok: false,
        kind: "not_configured",
        message: error?.message || "The profile service is not configured.",
      },
    };
  }
}

function upstreamResult(error: unknown): ProfileResult {
  if (error instanceof UpstreamFailure) {
    const { kind, status, message } = error.upstream;
    if (kind === "rejected") return { ok: false, kind: "unauthorized" };
    /* The account service rejected the values themselves — a field error, not
       an outage, so the screen shows the note the same way it shows a local
       validation failure. */
    if (kind === "invalid") return { ok: false, kind: "invalid", errors: error.upstream.fields ?? {} };
    /* 502, not 500: the profile service is fine, the thing behind it is not.
       The distinction is what makes the error useful in a log. */
    return {
      ok: false,
      kind: "upstream",
      message,
      status: kind === "ambiguous" ? 504 : 502,
      ambiguous: kind === "ambiguous",
    };
  }
  return { ok: false, kind: "upstream", message: "The profile service could not complete the request.", status: 502, ambiguous: false };
}
