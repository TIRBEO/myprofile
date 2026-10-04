"use client";

/* ═══════════════════════════════════════════════════════════════════
   Passkeys

   A passkey is created and kept by the device or password manager the
   owner picks; the account stores the public half of it, the name the
   owner gave it, and when it was added. So this file is only the
   conversation around that ceremony: ask the account for a challenge,
   hand it to the browser, send the answer back, and read the list the
   account kept.

   Nothing here stores a key or a secret. If the browser can't do
   WebAuthn at all, `passkeysSupported` says so before a sheet opens —
   the alternative is a button that appears to work and never does.
   ═══════════════════════════════════════════════════════════════════ */

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { apiJson, apiSend } from "@/lib/api";
import { withProof, type ReauthProof } from "@/lib/reauth";

/** Mirrors the cap the account enforces when a key is added. */
export const MAX_PASSKEYS = 5;

export type Passkey = {
  id: string;
  /** The owner's name for the key — what the row leads with. */
  name: string;
  /** How the authenticator says it can be reached: internal, usb, nfc, hybrid. */
  transports: string[];
  createdAt: number;
};

type PasskeyRow = {
  id: string;
  deviceName: string | null;
  transports: string | null;
  createdAt: string;
};

const TRANSPORT = new Map([
  ["internal", "This device"],
  ["hybrid", "Another device"],
  ["usb", "A security key"],
  ["nfc", "A tapped key"],
]);

function toPasskey(row: PasskeyRow): Passkey {
  return {
    id: row.id,
    name: row.deviceName?.trim() || "Untitled passkey",
    transports: (row.transports || "")
      .split(",")
      .map((kind) => kind.trim())
      .filter(Boolean),
    createdAt: Date.parse(row.createdAt),
  };
}

/** Whether this browser can hold a passkey at all. */
export function passkeysSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

export async function readKeys(): Promise<Passkey[]> {
  const res = await apiJson<{ passkeys: PasskeyRow[] }>("/api/user/passkeys");
  return (res.passkeys || []).map(toPasskey).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Add a passkey: the account's challenge, the browser's signature, the
 * account's yes. The name goes with it, because the account stores the label
 * and nothing else about what the key is called.
 *
 * Throws whatever the browser or the account said — a cancelled prompt is not
 * a failed one, so the page checks `wasCancelled` before reporting.
 */
export async function addPasskey(name: string): Promise<Passkey> {
  const options = await apiJson<{ publicKey: any; challengeNonce: string }>("/api/user/passkeys", {
    method: "POST",
  });

  const credential = await startRegistration({
    optionsJSON: options.publicKey,
  });

  await apiJson("/api/user/passkeys/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "register",
      credential,
      deviceName: name.trim() || undefined,
      challengeNonce: options.challengeNonce,
    }),
  });

  // The account assigns the id and the instant, so the list is re-read rather
  // than guessed at from what the browser handed back.
  const keys = await readKeys();
  const added = keys.find((key) => key.name === (name.trim() || "Untitled passkey"));
  return added ?? keys[0];
}

/** A cancelled or timed-out authenticator prompt, which the page should not
    report as a fault. */
export function wasCancelled(err: unknown): boolean {
  const message = err instanceof Error ? err.message : "";
  return /not allowed|abort|cancelled|timed out/i.test(message);
}

/**
 * Remove one. Revoking a credential is a sensitive action on the account, so
 * the request has to carry a fresh identity proof — a password, an
 * authenticator code or the emailed one, whichever this account can produce.
 * The caller gets that from the shared "Confirm it's you" dialog; with no
 * proof the account refuses and says which ones it would accept.
 */
export async function removePasskey(id: string, proof: ReauthProof): Promise<void> {
  await apiSend("/api/user/passkeys", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withProof({ passkeyId: id }, proof)),
  });
}
