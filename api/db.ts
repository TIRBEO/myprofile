/**
 * The other vein: a narrow, read-mostly line to the account row itself.
 *
 * The main API stays the brain — every write goes through it, because a write
 * carries side effects (audit events, notifications, cache busts) that only
 * the brain may produce. But a *read* is just a SELECT of twelve columns, and
 * paying one HTTP hop plus the main server's dispatcher for it on every page
 * load is the cost this service exists to remove. So when Redis has no warm
 * copy, the read falls to the database directly — the same database, the same
 * rows, one pooled connection.
 *
 * The rules that keep this safe:
 *
 *   - Read-only. There is no UPDATE here. Not because Prisma couldn't, but
 *     because a write that skips the main server skips its audit trail.
 *   - One narrow select, the same columns `internalProfileHandlers.ts` picks.
 *   - A pooled `pg` client under Prisma's driver adapter, sized small: this
 *     process sits beside the main one, and the database's connection budget
 *     is shared between them.
 *   - Every failure degrades to the HTTP path. The main server remains the
 *     answer of record when the direct line is down.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type Client = any;

const g = globalThis as unknown as { __myprofilePrisma?: PrismaClient; __myprofilePool?: Pool };

/** The columns a profile is. Reads the same tables the main API's internal
    handler reads — users (handle) + user_profile (everything else) — and
    projects both into the same flat wire shape. */
export const PROFILE_SELECT = {
  id: true,
  username: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      name: true, bio: true, gender: true, birthday: true,
      photoUrl: true, bannerUrl: true, pronouns: true, location: true,
      website: true, jobRole: true, jobCompany: true, jobPlace: true,
      jobStarted: true, skills: true, followers: true, following: true,
    },
  },
  emails: { select: { address: true, kind: true, isDefault: true }, where: { kind: 'primary' }, take: 1 },
  phone: { select: { number: true, verifiedAt: true } },
} as const;

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

export function getDb(): PrismaClient {
  if (g.__myprofilePrisma && g.__myprofilePool) return g.__myprofilePrisma;
  const pool = createPool();
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) as any, log: ["error"] });
  g.__myprofilePrisma = prisma;
  g.__myprofilePool = pool;
  return prisma;
}

export type DirectReadResult =
  | { kind: "row"; row: ProfileRow }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/** Projects the account row + its profile into the flat wire shape the
    contract maps from — identical to the main API's toWire(). */
function toWire(u: any): Record<string, unknown> {
  const p = u.profile ?? {};
  return {
    id: u.id,
    username: u.username,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    name: p.name ?? null,
    bio: p.bio ?? null,
    gender: p.gender ?? null,
    birthday: p.birthday ?? null,
    photoUrl: p.photoUrl ?? null,
    bannerUrl: p.bannerUrl ?? null,
    pronouns: p.pronouns ?? null,
    location: p.location ?? null,
    website: p.website ?? null,
    companyRole: p.jobRole ?? null,
    companyName: p.jobCompany ?? null,
    jobPlace: p.jobPlace ?? null,
    jobStarted: p.jobStarted ?? null,
    skills: p.skills ?? [],
    followers: p.followers ?? 0,
    following: p.following ?? 0,
    email: u.emails?.[0]?.address ?? null,
    phoneNumber: u.phone?.number ?? null,
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
    try {
      const row = await getDb().user.findUnique({
        where: { id: userId },
        select: PROFILE_SELECT,
      });
      if (!row) return { kind: "not_found" };
      return { kind: "row", row: toWire(row) };
    } catch (error) {
      lastError = error;
      const message = String((error as any)?.message ?? "").toLowerCase();
      const retryable =
        /connection|timeout|pool|terminated|starting up|too many|column|table/.test(message) ||
        ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes((error as any)?.code);
      if (!retryable) break;
      // Backoff with room for a sleeping database to wake: 0.5s, 2s.
      await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 2_000));
    }
  }
  console.error("[PROFILE-DB] Direct read failed:", (lastError as any)?.message ?? lastError);
  return { kind: "unavailable" };
}

/** True when this service is allowed the direct line at all. */
export function isDirectReadConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL);
}

export type { Client };
