"use client";

/* ═══════════════════════════════════════════════════════════════════
   Devices and sessions

   Nothing tracks sessions server-side yet, so this is the account's own
   list of the machines it is signed in on — the shape the API will hand
   back later, with seed rows standing in. This device is named from the
   browser rather than typed in, because you can't see your own machine
   from the outside but you do know which one you're holding.

   Signing out drops the device from the list and records it, which is
   what a real session revocation looks like from the client side.
   ═══════════════════════════════════════════════════════════════════ */

import { type DeviceKind, guessDevice } from "@/lib/device";

const STORE = "tirbeo:devices";
const LOG_STORE = "tirbeo:devices:log";

export const MAX_LOG = 10;

export type Device = {
  id: string;
  kind: DeviceKind;
  name: string;
  os: string;
  browser: string;
  location: string;
  ip: string;
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

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEVICE_ICON_KINDS: DeviceKind[] = ["computer", "phone", "tablet"];

/* One address per machine, written once: the seeds take it from here, and a
   list saved before the addresses were whole gets it back on read. The same
   machine reads the same way in the login history and the activity log. */
const CURRENT_IP = "202.79.160.14";
const SEEDED_IPS: Record<string, string> = {
  "iPhone 15 Pro": "103.181.81.44",
  "iPad Air": "182.93.183.7",
  "Surface Laptop": "116.212.101.8",
  "Pixel 9": "45.127.88.3",
};

const FULL_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** A list saved while the seeds still masked their addresses gets the real
    address back rather than losing the sessions it recorded. */
function fullIp(device: { id: string; name: string; ip?: string }): string {
  if (device.ip && FULL_IP.test(device.ip)) return device.ip;
  if (device.id === "current") return CURRENT_IP;
  return SEEDED_IPS[device.name] ?? device.ip ?? "";
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seed(): Device[] {
  const now = Date.now();
  const here = guessDevice();
  const others: [offset: number, active: number, kind: DeviceKind, name: string, os: string, browser: string, location: string, ip: string, logins: number[]][] = [
    [9 * HOUR, 40 * MIN, "phone", "iPhone 15 Pro", "iOS 19.1", "Tirbeo app", "Kathmandu, Nepal", SEEDED_IPS["iPhone 15 Pro"], [now - 9 * HOUR, now - 2 * DAY, now - 5 * DAY]],
    [3 * DAY, 2 * DAY, "tablet", "iPad Air", "iPadOS 19.1", "Safari", "Lalitpur, Nepal", SEEDED_IPS["iPad Air"], [now - 3 * DAY, now - 11 * DAY]],
    [12 * DAY, 6 * DAY, "computer", "Surface Laptop", "Windows 11", "Edge", "Pokhara, Nepal", SEEDED_IPS["Surface Laptop"], [now - 12 * DAY, now - 20 * DAY]],
    [26 * DAY, 19 * DAY, "phone", "Pixel 9", "Android 16", "Tirbeo app", "Bhaktapur, Nepal", SEEDED_IPS["Pixel 9"], [now - 26 * DAY]],
  ];
  return [
    {
      id: "current",
      kind: here.kind,
      name: here.name,
      os: here.os,
      browser: here.browser,
      location: "Kathmandu, Nepal",
      ip: CURRENT_IP,
      signedInAt: now - 2 * DAY,
      lastActiveAt: now,
      current: true,
      logins: [now, now - 2 * DAY, now - 8 * DAY, now - 15 * DAY],
    },
    ...others.map(([offset, active, kind, name, os, browser, location, ip, logins]) => ({
      id: `${(now - offset).toString(36)}-${kind}`,
      kind,
      name,
      os,
      browser,
      location,
      ip,
      signedInAt: now - offset - DAY,
      lastActiveAt: now - active,
      current: false,
      logins,
    })),
  ];
}

export function readDevices(): Device[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) {
      const seeded = seed();
      writeDevices(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<Device>[];
    if (!Array.isArray(parsed)) return [];
    const devices = parsed.filter(
      (device): device is Device =>
        typeof device?.id === "string" && typeof device?.name === "string" && !!device?.kind,
    ).map((device) => ({
      ...device,
      ip: fullIp(device),
      logins: Array.isArray(device.logins) ? device.logins.filter((n) => typeof n === "number") : [],
    }));
    // Most recent session first; the one you're on always leads the list.
    return devices.sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt - a.lastActiveAt);
  } catch {
    return [];
  }
}

function writeDevices(devices: Device[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(devices));
  } catch {
    /* private mode — the change still holds for this session */
  }
}

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
    /* private mode — the log simply isn't kept between visits */
  }
  return next;
}

export type SignOutResult = { devices: Device[]; events: SessionEvent[] };

/** One machine by its id, for the page that shows nothing else. */
export function findDevice(id: string | undefined): Device | null {
  if (!id) return null;
  return readDevices().find((device) => device.id === id) ?? null;
}

/** Ends one session. The device you're reading this on can't sign itself out. */
export function signOut(id: string): SignOutResult {
  const devices = readDevices();
  const target = devices.find((device) => device.id === id);
  if (!target || target.current) return { devices, events: readLog() };
  writeDevices(devices.filter((device) => device.id !== id));
  return {
    devices: readDevices(),
    events: logEvent("signed-out", `Signed out of ${target.name} · ${target.location}`),
  };
}

/** Everything but this device, in one go. Returns how many sessions ended. */
export function signOutOthers(): SignOutResult {
  const devices = readDevices();
  const others = devices.filter((device) => !device.current);
  if (!others.length) return { devices, events: readLog() };
  writeDevices(devices.filter((device) => device.current));
  return {
    devices: readDevices(),
    events: logEvent(
      "signed-out-all",
      `Signed out of ${others.length} ${others.length === 1 ? "device" : "devices"} except this one`,
    ),
  };
}

/** End exactly the chosen sessions — the "log out on selected devices" flow. */
export function signOutMany(ids: string[]): SignOutResult {
  const devices = readDevices();
  const wanted = new Set(ids);
  const targets = devices.filter((d) => wanted.has(d.id) && !d.current);
  if (!targets.length) return { devices, events: readLog() };
  writeDevices(devices.filter((d) => !wanted.has(d.id)));
  return {
    devices: readDevices(),
    events: logEvent(
      "signed-out-all",
      `Signed out of ${targets.length} ${targets.length === 1 ? "device" : "devices"}`,
    ),
  };
}
