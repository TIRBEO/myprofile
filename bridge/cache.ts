/**
 * Caching and request coalescing for profile reads.
 *
 * This is where the main server actually gets relief. A settings page does not
 * make one request — the hub, the rail header, the avatar beside it and the
 * edit sheet all want the same record, and without help each of them becomes a
 * hop. Two things fix that:
 *
 *   - **single-flight**: concurrent requests for the same account share one
 *     upstream call. Four callers, one fetch.
 *   - **a short TTL**: what the four calls do not share, the next page load
 *     within the window does.
 *
 * The window is deliberately small. A profile is the thing a user just edited,
 * so a long cache would show them their own change as not having happened —
 * which is why a write invalidates this account's entry outright.
 */

import { createHash } from "node:crypto";

type Entry<T> = { value: T; expiresAt: number };

const MAX_ENTRIES = 2_000;

export class ProfileCache<T> {
  private store = new Map<string, Entry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(private ttlMs: number) {}

  async read(key: string, load: () => Promise<T>): Promise<{ value: T; fresh: boolean }> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) return { value: hit.value, fresh: true };

    /* The in-flight promise is reused rather than awaited-and-retried, so a
       burst that arrives during a miss collapses to one load. It is removed in
       `finally` whether it resolved or failed — a failed load must not be
       replayed from a cached rejection. */
    const pending = this.inflight.get(key);
    if (pending) return { value: await pending, fresh: false };

    const started = load().then(
      (value) => {
        this.inflight.delete(key);
        this.insert(key, value);
        return value;
      },
      (error) => {
        this.inflight.delete(key);
        throw error;
      },
    );
    this.inflight.set(key, started);
    return { value: await started, fresh: false };
  }

  private insert(key: string, value: T) {
    this.evictIfNeeded();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private evictIfNeeded() {
    if (this.store.size < MAX_ENTRIES) return;
    const now = Date.now();
    for (const [k, v] of this.store) if (v.expiresAt <= now) this.store.delete(k);
    while (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /** Called after a write. A user's own edit must be visible on the next read,
      never served from the copy taken before it. */
  invalidate(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

/** Order-independent digest of the payload, so an ETag only changes when the
    profile does — not when a key happens to serialise in a different order. */
export function etagOf(payload: unknown): string {
  const stable = stabilise(payload);
  const hash = createHash("sha256").update(stable).digest("base64url");
  return `"${hash.slice(0, 32)}"`;
}

function stabilise(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stabilise).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stabilise((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

/** `If-None-Match` can list several candidates; any match is a 304. */
export function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  return ifNoneMatch
    .split(",")
    .map((part) => part.trim().replace(/^W\//, ""))
    .includes(etag);
}
