"use client";

import { QRCodeSVG } from "qrcode.react";

/* ═══════════════════════════════════════════════════════════════════
   The setup QR.

   A plain QR of the otpauth:// provisioning URI — issuer, account and
   secret — so any authenticator app lands on the same key the page
   prints underneath. No badge in the middle: an overlaid logo costs
   error-correction headroom and reads as decoration on what is otherwise a
   scannable code. The white plate is deliberate — a QR needs light-on-dark
   to scan, and the app's own surface is dark.
   ═══════════════════════════════════════════════════════════════════ */

export function TotpQr({ value, size = 200 }: { value: string; size?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.55)]">
      <QRCodeSVG value={value} size={size} level="M" marginSize={0} />
    </div>
  );
}
