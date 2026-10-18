/* ═══════════════════════════════════════════════════════════════════
   The sign-in landing is a door, not a room.

   Login itself lives in the accounts app, so this page renders nothing
   at all: a signed-out visitor who reaches /login is redirected straight
   to the accounts sign-in, with `redirect_to` set to this origin so the
   session lands back here. The old interstitial ("Welcome to Tirbeo" +
   a big button) is gone — one screen fewer between arriving and signing
   in.

   This is a server component because the redirect target must be built
   from the *request's* host (x-forwarded-host/host), which is exactly
   what `window.location` got wrong when it was read on the client.

   The URL mirrors the accounts-origin logic in `proxy.ts`: a
   tirbeo.com / tirbeo.app host resolves to accounts.<parent> on the same
   protocol, an explicit NEXT_PUBLIC_ACCOUNTS_URL wins off those domains
   (never a loopback one baked into a prod build), localhost falls to the
   dev accounts port, and anything else in production goes to the
   canonical accounts app. Extra query params (`?signup=1` and friends)
   ride along so deep links keep their context; a `redirect_to` already
   on the request is replaced by this origin — the accounts app owns
   that parameter and it must say *here*.
   ═══════════════════════════════════════════════════════════════════ */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Params = Record<string, string | string[] | undefined>;

/** The accounts app's origin for this request — see the header comment. */
function accountsBase(host: string, proto: string): string {
  const parent = host.match(/(?:^|\.)(tirbeo\.(?:com|app))$/i);
  if (parent) return `${proto}://accounts.${parent[1].toLowerCase()}`;
  const explicit = process.env.NEXT_PUBLIC_ACCOUNTS_URL?.replace(/\/+$/, "");
  if (explicit) {
    // A dirty .env.local baked into a prod build must not put a localhost
    // link on the sign-in path.
    const loopback = /localhost|127\.0\.0\.1/.test(explicit);
    if (!(loopback && process.env.NODE_ENV === "production")) return explicit;
  }
  if (host === "localhost" || host.startsWith("127.")) return "http://localhost:3002";
  return "https://accounts.tirbeo.com";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().toLowerCase().split(":")[0];
  const hostWithPort = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const fwdProto = h.get("x-forwarded-proto")?.split(",")[0].trim() || "";
  const proto =
    fwdProto === "http" || fwdProto === "https"
      ? fwdProto
      : host === "localhost" || host.startsWith("127.")
        ? "http"
        : "https";

  const target = new URL(`${accountsBase(host, proto)}/login`);
  // Where the accounts app sends them back to: this origin, the same value
  // the old shell put in its button's href.
  if (hostWithPort) target.searchParams.set("redirect_to", `${proto}://${hostWithPort}`);

  // Preserve any other incoming params (e.g. ?signup=1) so deep links do not
  // lose context. `redirect_to` is ours to set, never the caller's.
  const params = await searchParams;
  for (const [key, value] of Object.entries(params)) {
    if (key === "redirect_to" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) target.searchParams.append(key, v);
  }

  redirect(target.toString());
}
