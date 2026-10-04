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
     stuck behind a cached redirect in every browser that visited before. */
  async redirects() {
    return [
      { source: "/", destination: "/settings", permanent: false },
      { source: "/login", destination: "/settings", permanent: false },
      { source: "/messages", destination: "/settings", permanent: false },
      { source: "/messages/:path*", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
