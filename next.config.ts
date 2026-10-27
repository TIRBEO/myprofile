import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/binary and runtime-resolved packages must stay out of the bundle
  // and be shipped as real node_modules directories (Vercel tracer handles
  // these with the webpack build; Turbopack's hashed externals do not).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "ioredis", "pg", "prisma"],
  // Pin the monorepo workspace root so Turbopack always resolves the hoisted
  // root node_modules — never infer it from stray lockfiles.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  /* The account app is the site: /settings is what the root address is.
     Temporary rather than permanent so a page that comes back later isn't
     stuck behind a cached redirect in every browser that visited before.
     /login is *not* redirected here — the page itself is a server-side
     redirect straight to the accounts app's sign-in (see app/login/page.tsx);
     the old interstitial screen is gone. */
  async headers() {
    /* The account app is where a session cookie lives, so its documents get the
       header set. `script-src` keeps 'unsafe-inline' because the App Router
       streams its payload through inline `__next_f` scripts and a CSP without
       per-response nonces must allow them; the rest is written tight. `img-src`
       and `connect-src` are wide on purpose — this screen shows avatars from
       whoever the person connected their account to, and translates text
       through third-party APIs, and a guessed-narrow list breaks the page
       before it breaks the attack. */
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.tirbeo.com https://*.tirbeo.com wss://*.tirbeo.com https://*.pusher.com wss://*.pusher.com https://challenges.cloudflare.com https://api.mymemory.translated.net https://translate.googleapis.com",
      "frame-src https://www.openstreetmap.org https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://api.tirbeo.com https://accounts.tirbeo.com",
      "upgrade-insecure-requests",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=(), autoplay=(), display-capture=()',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/", destination: "/settings", permanent: false },
      { source: "/messages", destination: "/settings", permanent: false },
      { source: "/messages/:path*", destination: "/settings", permanent: false },
      /* The lock screens and the deletion-code step, kept alive as ways home.
         /settings/deactivated, /settings/deletion-pending and
         /settings/restricted were the three screens a locked account was kept
         on; a lock has no address of its own now, and the gate puts its screen
         up over whatever path you ask for. So these can't be a 404 — the state
         they named still exists — and /settings is where the account's state is
         read. /settings/confirm-deletion was the emailed-code step of a
         deletion, which is now a sheet on the page that starts one.
         Temporary, for the reason above: a page that comes back shouldn't be
         stuck behind a cached redirect. */
      { source: "/settings/deactivated", destination: "/settings", permanent: false },
      { source: "/settings/deletion-pending", destination: "/settings", permanent: false },
      { source: "/settings/restricted", destination: "/settings", permanent: false },
      {
        source: "/settings/confirm-deletion",
        destination: "/settings/delete-account",
        permanent: false,
      },
      /* The Recently deleted tray, and the activity screen that linked to it.
         Only the list page redirects: an address carrying an item id names a
         record that cannot exist, so that 404s rather than pretending the
         tray moved. */
      {
        source: "/settings/recently-deleted",
        destination: "/settings/your-activity",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
