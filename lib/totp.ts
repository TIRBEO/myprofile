"use client";

/* ═══════════════════════════════════════════════════════════════════
   Authenticator wiring — RFC 6238 TOTP on the browser's own Web Crypto.

   The secret is generated here and stays here: it goes into the QR
   code, into the setup key you can type by hand, and into the check
   that decides whether the 6 digits you typed match what your app is
   printing right now. QR and key are two views of the same secret.
   ═══════════════════════════════════════════════════════════════════ */

const SECRET_STORE = "tirbeo:two-factor-secret";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const ISSUER = "Tirbeo";
export const PERIOD_SECONDS = 30;

/** 20 random bytes → 32 Base32 characters, the width every app accepts. */
export function randomSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return toBase32(bytes);
}

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(key: string): Uint8Array | null {
  const clean = key.toUpperCase().replace(/[\s=-]/g, "");
  if (clean.length < 16) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** "JBSWY3DP…" → "JBSW Y3DP …" — the spacing every app shows. */
export function formatKey(secret: string): string {
  return normalizeKey(secret).replace(/(.{4})/g, "$1 ").trim();
}

/** The same secret, however many spaces or dashes the app added around it. */
export function normalizeKey(key: string): string {
  return key.toUpperCase().replace(/[\s=-]/g, "");
}

function step(nowMs: number): number {
  return Math.floor(nowMs / 1000 / PERIOD_SECONDS);
}

async function hotp(secret: string, counter: number): Promise<string | null> {
  const raw = fromBase32(secret);
  if (!raw) return null;
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey(
    "raw",
    raw as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new Uint8Array(buf)));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * True when `code` matches this secret now, one step ago, or one step
 * ahead — the clock on the phone and the browser rarely agree exactly.
 */
export async function verifyCode(secret: string, code: string, nowMs = Date.now()): Promise<boolean> {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 6) return false;
  const now = step(nowMs);
  for (const counter of [now, now - 1, now + 1]) {
    if ((await hotp(secret, counter)) === digits) return true;
  }
  return false;
}

/**
 * The provisioning URI a scanner reads: issuer, account and secret in
 * one line. The QR and the setup key below it carry the same secret.
 */
export function provisioningUri(secret: string, account: string): string {
  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({
    secret: normalizeKey(secret),
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: "6",
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Reuses the key from an earlier attempt on this device, or starts a new one. */
export function loadOrCreateSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    const saved = window.localStorage.getItem(SECRET_STORE);
    if (saved && /^[A-Z2-7]{16,}$/i.test(saved)) return saved.toUpperCase();
  } catch {
    /* unreadable — fall through to a fresh key */
  }
  const secret = randomSecret();
  saveSecret(secret);
  return secret;
}

export function saveSecret(secret: string) {
  try {
    window.localStorage.setItem(SECRET_STORE, secret);
  } catch {
    /* private mode — the key still holds for this session */
  }
}

/** Dropping 2FA retires the key, so turning it back on issues a new one. */
export function clearSecret() {
  try {
    window.localStorage.removeItem(SECRET_STORE);
  } catch {
    /* nothing to clean up */
  }
}
