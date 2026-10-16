/* ═══════════════════════════════════════════════════════════════════
   The sign-in landing.

   Login itself lives in the accounts app — this page is only the place
   a signed-out reader lands when the session probe comes back empty.
   It offers the real hand-off when one is configured, and in
   development (where the accounts app isn't running) it says plainly
   what happened instead of looping.

   This is a server component for one reason: the `redirect_to` the
   accounts app hands back has to be *this* origin, and reading it from
   `window.location` rendered an empty one on the server and the real
   one on the client — a hydration mismatch on the page's only button.
   The frame itself is the accounts AuthShell (see `login-shell.tsx`).
   ═══════════════════════════════════════════════════════════════════ */

import { headers } from "next/headers";

import LoginShell from "./login-shell";

export default async function LoginPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return <LoginShell origin={host ? `${proto}://${host}` : ""} />;
}
