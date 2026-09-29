"use client";

import { QRCodeSVG } from "qrcode.react";

/* ═══════════════════════════════════════════════════════════════════
   The setup QR.

   A real QR of the otpauth:// provisioning URI — issuer, account and
   secret — so any authenticator app lands on the same key the page
   prints underneath. Level "H" error correction buys the room for the
   Tirbeo badge in the middle.
   ═══════════════════════════════════════════════════════════════════ */

const LOGO = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#0a84ff"/>
  <path d="M32 12l16 5.8v11.4c0 10.4-6.5 17.5-16 21.4-9.5-3.9-16-11-16-21.4V17.8z" fill="#fff"/>
  <path d="M25 32l5 5.2 10-10.6" fill="none" stroke="#0a84ff" stroke-width="4.4"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`)}`;

export function TotpQr({ value, size = 200 }: { value: string; size?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.55)]">
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        marginSize={0}
        imageSettings={{ src: LOGO, width: 40, height: 40, excavate: true }}
      />
    </div>
  );
}
