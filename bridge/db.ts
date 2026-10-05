/**
 * The other vein: a narrow, read-mostly line to the account row itself.
 *
 * The main API stays the brain — every write goes through it, because a write
 * carries side effects (audit events, notifications, cache busts) that only
 * the brain may produce. But a *read* is just a SELECT over four tables, and
 * paying one HTTP hop plus the main server's dispatcher for it on every page
 * load is the cost this service exists to remove. So when Redis has no warm
 * copy, the read falls to the database directly — the same database, the same
 * rows, one pooled connection.
 *
 * The rules that keep this safe:
 *
 *   - Read-only. There is no UPDATE here. Not because pg couldn't, but
 *     because a write that skips the main server skips its audit trail.
 *   - One narrow SELECT, the same columns `internalProfileHandlers.ts` picks.
 *   - A pooled `pg` client, sized small: this process sits beside the main
 *     one, and the database's connection budget is shared between them.
 *   - Every failure degrades to the HTTP path. The main server remains the
 *     answer of record when the direct line is down.
 *
 * Plain SQL, deliberately: this deployable has no Prisma schema of its own,
 * so the generated client was never present on Vercel — the old
 * `@prisma/client` import compiled to a stub that threw `Cannot find module
 * '.prisma/client/default'` on every cold start, silently disabling the
 * direct read in production. The account row is four tables and a projection;
 * that does not need an ORM, let alone one that cannot be generated here.
 */

import { Pool, type PoolClient } from "pg";

const g = globalThis as unknown as { __myprofilePool?: Pool };

export type ProfileRow = Record<string, unknown>;

function createPool(): Pool {
  const base = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || "";
  if (!base) throw new Error("DATABASE_URL is not set — the direct read path is unavailable.");
  const sep = base.includes("?") ? "&" : "?";
  // Same pooler-friendly parameters the main API appends: transaction-mode
  // PgBouncer on :6543 needs pgbouncer=true, and Supabase's certificates are
  // self-signed, so sslmode=require is read with libpq semantics.
  const portMatch = base.match(/pooler\.supabase\.com:(\d+)/);
  const pgbouncer = portMatch && portMatch[1] === "6543" ? "&pgbouncer=true" : "";
  const connectionString = `${base}${sep}uselibpqcompat=true&sslmode=require${pgbouncer}`;

  return new Pool({
    connectionString,
    // Deliberately smaller than the main server's pool: this process's share
    // of the database's connection budget is the read path only.
    max: Number.parseInt(process.env.PROFILE_DB_POOL_MAX || "", 10) || 3,
    min: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    query_timeout: 8_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
    ssl: process.env.NODE_ENV !== "production" ? { rejectUnauthorized: false } : undefined,
  });
}

export async function getPool(): Promise<Pool> {
  if (g.__myprofilePool) return g.__myprofilePool;
  g.__myprofilePool = createPool();
  return g.__myprofilePool;
}

export type DirectReadResult =
  | { kind: "row"; row: ProfileRow }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/* The tables live in Postgres schemas (the main API's Prisma multi-schema
   layout): users + user_profile + user_phone under "user", emails under
   "email". Correlated subqueries keep the row cardinality at one, the way
   Prisma's includes did. */
const READ_SQL = `
SELECT
  u.id, u.username, u.status,
  u.created_at AS "createdAt", u.updated_at AS "updatedAt",
  p.name, p.bio, p.gender, p.birthday,
  p.photo_url AS "photoUrl", p.banner_url AS "bannerUrl",
  p.pronouns, p.location, p.website,
  p.job_role AS "jobRole", p.job_company AS "jobCompany",
  p.job_place AS "jobPlace", p.job_started AS "jobStarted",
  p.skills, COALESCE(p.followers, 0) AS followers, COALESCE(p.following, 0) AS following,
  (SELECT e.address FROM "email".user_email e
    WHERE e.user_id = u.id AND e.kind = 'primary' LIMIT 1) AS email,
  ph.number AS "phoneNumber"
FROM "user".users u
LEFT JOIN "user".user_profile p ON p.user_id = u.id
LEFT JOIN "user".user_phone ph ON ph.user_id = u.id
WHERE u.id = $1
LIMIT 1`;

/** Projects the account row into the flat wire shape the contract maps
    from — identical to the main API's toWire(). */
function toWire(r: any): Record<string, unknown> {
  return {
    id: r.id,
    username: r.username,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    name: r.name ?? null,
    bio: r.bio ?? null,
    gender: r.gender ?? null,
    birthday: r.birthday ?? null,
    photoUrl: r.photoUrl ?? null,
    bannerUrl: r.bannerUrl ?? null,
    pronouns: r.pronouns ?? null,
    location: r.location ?? null,
    website: r.website ?? null,
    companyRole: r.jobRole ?? null,
    companyName: r.jobCompany ?? null,
    jobPlace: r.jobPlace ?? null,
    jobStarted: r.jobStarted ?? null,
    skills: r.skills ?? [],
    followers: r.followers ?? 0,
    following: r.following ?? 0,
    email: r.email ?? null,
    phoneNumber: r.phoneNumber ?? null,
  };
}

/**
 * The one read this module serves. Retry budget is small and cold-start
 * aware — the database this sits beside is Supabase, which sleeps, and the
 * first read after a sleep has to be allowed to wake it.
 */
export async function readProfileRow(userId: string): Promise<DirectReadResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let client: PoolClient | null = null;
    try {
      client = await (await getPool()).connect();
      const { rows } = await client.query(READ_SQL, [userId]);
      if (rows.length === 0) return { kind: "not_found" };
      return { kind: "row", row: toWire(rows[0]) };
    } catch (error) {
      lastError = error;
      const message = String((error as any)?.message ?? "").toLowerCase();
      const retryable =
        /connection|timeout|pool|terminated|starting up|too many|column|table/.test(message) ||
        ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes((error as any)?.code);
      if (!retryable) break;
      // Backoff with room for a sleeping database to wake: 0.5s, 2s.
      await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 2_000));
    } finally {
      client?.release();
    }
  }
  console.error("[PROFILE-DB] Direct read failed:", (lastError as any)?.message ?? lastError);
  return { kind: "unavailable" };
}

/** True when this service is allowed the direct line at all. */
export function isDirectReadConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL);
}
