"use client";

/* ═══════════════════════════════════════════════════════════════════
   Devices and sessions

   The list is the account's own live sessions — what the brain records in
   `security.user_sessions` every time this account signs in somewhere. Each
   row carries the user-agent and network address that opened it, so a device
   is named and placed from what it reported, not typed in.

   Signing out is real: the account ends the session and the list is re-read, so
   the machine disappears everywhere, not just here. Ending one asks for an
   identity proof first — a signed-in browser is not, on its own, proof that the
   person who owns the account is the one holding it. The only thing kept in the
   browser is the short "Recent activity" note of sign-outs *you* performed on
   this device — a convenience, not a record of the session.
   ═══════════════════════════════════════════════════════════════════ */

import { describeUserAgent, type DeviceKind } from "@/lib/device";
import { coordsOf } from "@/lib/coords";
import { apiJson } from "@/lib/api";
import { withProof, type ReauthProof } from "@/lib/reauth";

const LOG_STORE = "tirbeo:devices:log";

export const MAX_LOG = 10;

/** One brain session row, as `/api/security/sessions` returns it. */
type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  location: string | null;
  coords?: [number, number] | null;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
};

/** One `/api/security/login-history` entry, only what the mapping needs. */
type LoginRow = { ipAddress: string | null; createdAt: string };

export type Device = {
  id: string;
  kind: DeviceKind;
  name: string;
  os: string;
  browser: string;
  location: string;
  ip: string;
  /** The point the edge resolved that address to, when it resolved one.
      Absent means no map, not a map somewhere else. */
  coords?: [number, number] | null;
  /** When this session started. */
  signedInAt: number;
  lastActiveAt: number;
  current: boolean;
  /** Every sign-in seen on this machine, newest first. */
  logins: number[];
};

export type SessionEvent = {
  id: string;
  at: number;
  kind: "signed-out" | "signed-out-all";
  label: string;
};

export const DEVICE_ICON_KINDS: DeviceKind[] = ["computer", "phone", "tablet"];

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** This machine's address, matched to line up its own sign-in history. */
function ts(iso: string | null | undefined, fallback = Date.now()): number {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? fallback : ms;
}

/**
 * The account's live sessions, enriched with the per-machine sign-in history
 * matched on network address. Current session leads, then most-recently-active.
 */
export async function readDevices(): Promise<Device[]> {
  const [sessions, history] = await Promise.all([
    apiJson<SessionRow[]>("/api/security/sessions"),
    apiJson<{ logs: LoginRow[] }>("/api/security/login-history?limit=50").catch(() => ({ logs: [] as LoginRow[] })),
  ]);

  const devices: Device[] = sessions.map((s) => {
    const hint = describeUserAgent(s.userAgent || "");
    return {
      id: s.id,
      kind: hint.kind,
      name: hint.name,
      os: hint.os,
      browser: hint.browser,
      location: s.location || "Unknown location",
      ip: s.ipAddress || "",
      coords: coordsOf(s.coords),
      signedInAt: ts(s.createdAt),
      lastActiveAt: ts(s.lastSeenAt, ts(s.expiresAt)),
      current: s.isCurrent,
      logins: history.logs
        .filter((l) => s.ipAddress && l.ipAddress === s.ipAddress)
        .map((l) => ts(l.createdAt))
        .sort((a, b) => b - a),
    };
  });

  return devices.sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt - a.lastActiveAt);
}

/** One machine by its id, for the page that shows nothing else. */
export async function findDevice(id: string | undefined): Promise<Device | null> {
  if (!id) return null;
  const devices = await readDevices();
  return devices.find((device) => device.id === id) ?? null;
}

/* ── Sign-out: one guarded call, then note it here ──────────────────── */

/**
 * End sessions on the account. Both shapes the screens offer go through the
 * same endpoint: named sessions, or "everything but this device" when `ids` is
 * null. It is one request because the identity proof that pays for it is
 * single-use — an emailed code spent on the first of three deletes would leave
 * the other two refused.
 */
async function revoke(ids: string[] | null, proof: ReauthProof): Promise<number> {
  const reply = await apiJson<{ revoked?: number }>("/api/security/sessions/revoke-all", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ids ? withProof({ sessionIds: ids }, proof) : proof),
  });
  // The account says how many it ended; it never counted more than it had.
  return typeof reply?.revoked === "number" ? reply.revoked : ids?.length ?? 0;
}

/** Ends one session. The device you're reading this on can't sign itself out. */
export async function signOut(id: string, proof: ReauthProof = {}): Promise<void> {
  const gone = (await readDevices().catch(() => [] as Device[])).find((d) => d.id === id);
  await revoke([id], proof);
  if (gone) logEvent("signed-out", `Signed out of ${gone.name} · ${gone.location}`);
}

/** Everything but this device, in one go. Returns how many sessions ended. */
export async function signOutOthers(proof: ReauthProof = {}): Promise<number> {
  const ended = await revoke(null, proof);
  logEvent(
    "signed-out-all",
    `Signed out of ${ended} ${ended === 1 ? "device" : "devices"} except this one`,
  );
  return ended;
}

/** End exactly the chosen sessions — the "log out on selected devices" flow. */
export async function signOutMany(ids: string[], proof: ReauthProof = {}): Promise<number> {
  if (!ids.length) return 0;
  const ended = await revoke(ids, proof);
  logEvent(
    "signed-out-all",
    `Signed out of ${ended} ${ended === 1 ? "device" : "devices"} except this one`,
  );
  return ended;
}

/* ── Local sign-out notes (a convenience, kept only in this browser) ── */

export function readLog(): SessionEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<SessionEvent>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event): event is SessionEvent => typeof event?.label === "string");
  } catch {
    return [];
  }
}

function logEvent(kind: SessionEvent["kind"], label: string) {
  const next = [{ id: newId(), at: Date.now(), kind, label }, ...readLog()].slice(0, MAX_LOG);
  try {
    localStorage.setItem(LOG_STORE, JSON.stringify(next));
  } catch {
    /* private mode — the note simply isn't kept between visits */
  }
  return next;
}
