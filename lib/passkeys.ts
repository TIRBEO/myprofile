"use client";

/* ═══════════════════════════════════════════════════════════════════
   Passkeys

   A passkey is a credential the browser or password manager holds — the
   account only ever keeps its name and when it was added, in the shape
   the API will hand back later. There is no WebAuthn call here yet:
   `createPasskey` is the one place the registration request will go, and
   nothing else on the page has to change when it's wired up.
   ═══════════════════════════════════════════════════════════════════ */

import { guessDevice } from "@/lib/device";

const STORE = "tirbeo:passkeys";

export const MAX_PASSKEYS = 5;

export type Passkey = {
  id: string;
  name: string;
  /** Where the key lives, e.g. "Chrome on Mac" — the API will report this. */
  device: string;
  createdAt: number;
};

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readKeys(): Passkey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<Passkey>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((key): key is Passkey => typeof key?.id === "string" && typeof key?.name === "string")
      .map((key) => ({ ...key, device: key.device ?? "" }));
  } catch {
    return [];
  }
}

function writeKeys(keys: Passkey[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(keys));
  } catch {
    /* private mode — the change still holds for this session */
  }
}

/**
 * Adding a passkey. Takes the name the account gives the key and returns
 * the record that lands in the list. The cap is the page's business — its
 * Add button is disabled once `MAX_PASSKEYS` keys exist — so the API error
 * for a rejected registration is what will come back through here later.
 */
export async function createPasskey(name: string): Promise<Passkey> {
  // TODO: call the passkey API here — not wired up yet.
  // Real registration needs a server challenge, so the key is fabricated
  // locally for now; the record below is the shape the API will return.
  const device = guessDevice();
  const key: Passkey = {
    id: newId(),
    name: name.trim() || device.name,
    device: device.browser ? `${device.browser} on ${device.name}` : device.name,
    createdAt: Date.now(),
  };
  writeKeys([key, ...readKeys()]);
  return key;
}

/** The name is captured by the page before the key is gone. */
export function removePasskey(id: string) {
  // TODO: revoke the key with the passkey API here — not wired up yet.
  writeKeys(readKeys().filter((key) => key.id !== id));
  return readKeys();
}
