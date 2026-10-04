/**
 * Long-lived objects for the profile service.
 *
 * Module scope, not request scope: a cache rebuilt for every request caches
 * nothing, and Next reuses the module across requests in one server process.
 *
 * Built lazily rather than at import. A missing `INTERNAL_API_SECRET` has to
 * stop the profile endpoint from answering, and it does — but if this ran at
 * module scope it would also fail the app build and take every settings page
 * down with it, for an endpoint none of them touch. The throw belongs on the
 * request that needs the secret, which is where `profile.ts` catches it and
 * answers 501.
 */

import { ProfileCache } from "./cache";
import { loadConfig, type ApiConfig } from "./config";
import { createIdentityResolver } from "./session";
import { lookupSessionCookie } from "./transport";

let profileCache: ProfileCache<Record<string, unknown>> | null = null;

export function getCache(): ProfileCache<Record<string, unknown>> {
  if (!profileCache) profileCache = new ProfileCache(loadConfig().readCacheTtlMs);
  return profileCache;
}

/** No config needed to exist — only to answer, which happens inside the
    transport. So this one is safe to build eagerly. */
export const resolveIdentity = createIdentityResolver(lookupSessionCookie);

export function getConfig(): ApiConfig {
  return loadConfig();
}
