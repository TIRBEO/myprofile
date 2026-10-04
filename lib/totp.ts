"use client";

/* ═══════════════════════════════════════════════════════════════════
   The setup key, for display

   The secret is generated and checked on the account service — it is the
   thing that decides whether the code you typed is right, and a browser
   copy of it would only ever disagree. What the page still needs locally
   is to show the server's provisioning URI a second way: the same secret
   spaced out so it can be typed into an app by hand.
   ═══════════════════════════════════════════════════════════════════ */

/** The same secret, however many spaces or dashes the app added around it. */
export function normalizeKey(key: string): string {
  return key.toUpperCase().replace(/[\s=-]/g, "");
}

/** "JBSWY3DP…" → "JBSW Y3DP …" — the spacing every app shows. */
export function formatKey(secret: string): string {
  return normalizeKey(secret).replace(/(.{4})/g, "$1 ").trim();
}

/** The secret an otpauth:// URI carries — the QR and this are one value. */
export function secretFromUri(uri: string): string {
  try {
    return normalizeKey(new URL(uri).searchParams.get("secret") ?? "");
  } catch {
    /* not a URI we recognise — the QR still scans, the key line just stays empty */
    return "";
  }
}
