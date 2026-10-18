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
     /login is *not* redirected — the app's own sign-in landing lives there
     (the proxy sends signed-out visitors straight to the accounts app). */
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
