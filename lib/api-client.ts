"use client";

/* ═══════════════════════════════════════════════════════════════════
   Talking to the profile service

   The screens used to keep the profile in this browser only, which meant a
   phone and a laptop each had their own version of the same name. This is the
   single way in and out: one origin, one response shape, and the two answers
   the pages actually act on — what changed, and which fields could not be
   saved because the account row has nowhere to put them.

   Nothing here rewires a screen yet. It is the seam the pages move onto.
   ═══════════════════════════════════════════════════════════════════ */

import type { ProfileResponse } from "../bridge/contract";
import { announceServiceDown, answered } from "@/lib/service-events";

export type ProfilePatchResult =
  | { ok: true; data: ProfileResponse }
  | { ok: false; kind: "invalid"; errors: Record<string, string> }
  | { ok: false; kind: "unauthorized"; loginUrl: string }
  | { ok: false; kind: "unconfirmed"; message: string }
  | { ok: false; kind: "unavailable"; message: string };

const BASE = "/api/profile";

async function request(init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(BASE, { credentials: "same-origin", ...init });
  } catch (error) {
    // The request never reached the service; the shell says so for the page.
    announceServiceDown();
    throw error;
  }
  if (!answered(response.status)) announceServiceDown();
  return response;
}

export async function fetchProfile(): Promise<ProfilePatchResult> {
  let response: Response;
  try {
    response = await request({ method: "GET", headers: { accept: "application/json" } });
  } catch {
    return { ok: false, kind: "unavailable", message: "You appear to be offline, so the profile could not be loaded." };
  }
  return toResult(response);
}

export async function saveProfile(patch: Record<string, unknown>): Promise<ProfilePatchResult> {
  let response: Response;
  try {
    response = await request({
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    /* A write that never left the device is safe to retry. One that left and
       came back like this may have landed — the server says which, and a
       `write_unconfirmed` code is the one the screen must not silently replay. */
    return { ok: false, kind: "unavailable", message: "The change could not be sent." };
  }
  return toResult(response);
}

async function toResult(response: Response): Promise<ProfilePatchResult> {
  if (response.status === 304 || response.ok) {
    if (response.status === 304) return { ok: false, kind: "unavailable", message: "Profile unchanged." };
    const data = (await response.json().catch(() => null)) as ProfileResponse | null;
    if (data?.profile) return { ok: true, data };
    return { ok: false, kind: "unavailable", message: "The profile service returned an unreadable response." };
  }

  const body = (await response.json().catch(() => null)) as
    | { error?: string; code?: string; fields?: Record<string, string>; loginUrl?: string }
    | null;

  if (response.status === 401) return { ok: false, kind: "unauthorized", loginUrl: body?.loginUrl ?? "/settings" };
  if (response.status === 400 && body?.fields) return { ok: false, kind: "invalid", errors: body.fields };
  if (body?.code === "write_unconfirmed") {
    return { ok: false, kind: "unconfirmed", message: body.error ?? "We could not confirm whether that change was saved." };
  }
  return { ok: false, kind: "unavailable", message: body?.error ?? "The profile service is not answering right now." };
}
