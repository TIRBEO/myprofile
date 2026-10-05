"use client";

/* ═══════════════════════════════════════════════════════════════════
   Who this account is — the client store.

   This used to be a localStorage-only record: a phone and a laptop each
   had their own version of the same name, and "Sign out" couldn't take
   the profile with it. Now the record is served by this app's own
   profile endpoint (`/api/profile` → the main API's account row), and
   localStorage is a cache, not the store:

     • the endpoint is the truth — a save goes up, a load comes down;
     • the cache holds the last good copy, so the rail, the chat rows
       and the statement pages have something to paint on the first
       render instead of an empty name;
     • a field the account row cannot hold (the follower counts) still
       lives in the cache only, and is marked in the save result so the
       screen can say which edits stayed local.

   The handle is still what the profile page is filed under, so it's
   kept lowercase and filesystem-safe in one place rather than tidied
   up by every caller.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { fetchProfile, saveProfile } from "@/lib/api-client";
import { bindAccount } from "@/lib/account-cache";

const STORE = "tirbeo:edit-profile";

export type Profile = {
  /** The account row's own id. Read from the server, never editable here —
      and the only thing that says which person the local cache belongs to. */
  id: string;
  name: string;
  username: string;
  bio: string;
  pronouns: string;
  location: string;
  dob: string;
  gender: string;
  photo: string | null;
  banner: string | null;
  website: string;
  jobRole: string;
  jobCompany: string;
  jobPlace: string;
  jobStartedOn: string;
  skills: string[];
  /** Login identity — read from the server, never editable here. */
  email: string;
  /** Recovery number — read from the server, never editable here. */
  phone: string;
  following: number;
  followers: number;
};

/** What an empty account looks like. Deliberately blank now: the
    demo person ("Soham Dhitle") is gone — a signed-out visitor sees
    their real account once signed in, and nothing before that. */
export const DEFAULT_PROFILE: Profile = {
  id: "",
  name: "",
  username: "",
  bio: "",
  pronouns: "",
  location: "",
  dob: "",
  gender: "",
  photo: null,
  banner: null,
  website: "",
  jobRole: "",
  jobCompany: "",
  jobPlace: "",
  jobStartedOn: "",
  skills: [],
  email: "",
  phone: "",
  following: 0,
  followers: 0,
};

/** The name as it should be read. Honorifics and qualifications were retired
    from the edit screen, so this is just the trimmed name — kept as a function
    because callers read through it and a bare `profile.name` invites re-adding
    the old title/qualifications pair. */
export function displayName(profile: Profile): string {
  return (profile.name ?? "").trim();
}

/** What a typed-in handle becomes: no @, nothing a path can't hold. */
export function slugOf(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
}

/* ── The local cache ─────────────────────────────────────────────── */

function readCache(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Profile>;
    if (!saved || typeof saved !== "object") return null;
    return normalise({
      ...saved,
      username: slugOf(saved.username ?? ""),
    });
  } catch {
    return null;
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** The only two fields where "nothing" is a real answer rather than a blank. */
const NULLABLE_FIELDS = new Set<keyof Profile>(["photo", "banner"]);

/**
 * Forces a bag of wire or cached values into the shape `Profile` promises.
 *
 * The endpoint answers `null` for every field nobody has filled in — that is
 * the honest reading of an empty column — but `Profile` types those fields as
 * `string`. Merging the wire value straight through is how a `null` reached a
 * `.trim()`: an account with no bio took the whole edit-profile page down with
 * `can't access property "trim", bio is null`, and the type said it could not
 * happen. Every path into a `Profile` goes through here, so the gap is closed
 * once rather than at each call site.
 */
function normalise(raw: Partial<Profile>): Profile {
  const out: Profile = { ...DEFAULT_PROFILE, ...raw };
  for (const key of Object.keys(out) as (keyof Profile)[]) {
    if (NULLABLE_FIELDS.has(key)) {
      const v = out[key];
      out[key] = (typeof v === "string" && v ? v : null) as never;
    } else if (key === "skills") {
      out.skills = Array.isArray(out.skills)
        ? out.skills.filter((s): s is string => typeof s === "string")
        : [];
    } else if (key === "following" || key === "followers") {
      out[key] = numberOr(out[key], 0) as never;
    } else {
      out[key] = (out[key] == null ? "" : String(out[key])) as never;
      /* Dates arrive as ISO timestamps from JSON; the forms want bare dates. */
      if (key === "dob" && out.dob.length > 10) out.dob = out.dob.slice(0, 10);
    }
  }
  return out;
}

function writeCache(profile: Profile) {
  try {
    localStorage.setItem(STORE, JSON.stringify(profile));
  } catch {
    /* private mode — it still holds for this session */
  }
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

/** Kept for callers that only want to read what's on this device right
    now (the data-export). Never written to directly by a screen. */
export function readProfile(): Profile {
  return readCache() ?? DEFAULT_PROFILE;
}

/** One save path, used by the edit sheet. Fields the account row can't
    hold are merged into the cache after the server answer comes back, so
    they survive the round trip that overwrites the cache. */
export function writeProfile(next: Profile): Profile {
  /* Optimistic: the cache and every subscriber see the edit at once. The
     server answer reconciles it below via `applyServerProfile`. */
  writeCache(next);
  return next;
}

/** Wire field → local field. The server speaks in column names
    (photoUrl, birthday, companyRole); the screens speak in form names
    (photo, dob, jobRole). One map, so the two never drift apart. */
const WIRE_TO_LOCAL: Record<string, keyof Profile> = {
  name: "name",
  username: "username",
  bio: "bio",
  gender: "gender",
  birthday: "dob",
  photoUrl: "photo",
  bannerUrl: "banner",
  pronouns: "pronouns",
  location: "location",
  website: "website",
  companyRole: "jobRole",
  companyName: "jobCompany",
  jobPlace: "jobPlace",
  jobStarted: "jobStartedOn",
  skills: "skills",
  email: "email",
  phoneNumber: "phone",
  followers: "followers",
  following: "following",
};

/**
 * Reads a field name from a server payload and says which key of `Profile`
 * it belongs to.
 *
 * `/api/profile` answers in the keys the screens use — it maps the account
 * row's column names (`companyRole`, `birthday`, `photoUrl`) on the way out,
 * in `bridge/contract.ts`. `WIRE_TO_LOCAL` is kept so a payload that still
 * speaks in column names (an older cache entry, a direct read) lands in the
 * same place instead of being silently dropped: reading `companyRole` only
 * here is how the Work sheet showed a blank job title for a row that had one.
 */
function resolveKey(key: string): keyof Profile | null {
  if (key in WIRE_TO_LOCAL) return WIRE_TO_LOCAL[key];
  if (key in DEFAULT_PROFILE) return key as keyof Profile;
  return null;
}

/** Merges what the server returned into a local copy — server fields win,
    local-only fields (unsupported on the row) are kept. */
function mergeWithServer(local: Profile, server: Record<string, unknown>): Profile {
  const out: Profile = { ...local };
  for (const [key, value] of Object.entries(server)) {
    const target = resolveKey(key);
    // `null` is a real answer from the wire — "nobody has filled this in" —
    // so it is merged like any other value. `normalise` is what turns it into
    // the empty string `Profile` promises.
    if (!target || value === undefined) continue;
    (out[target] as unknown) = value;
  }
  return normalise(out);
}

/** Fields with no editable column — mirrored from bridge/contract.ts
    UNSUPPORTED_FIELDS. The clean rebuild moved pronouns, location, banner,
    job place and skills onto real columns; what remains is the follower
    counts. */
const LOCAL_ONLY = new Set<keyof Profile>([
  "following",
  "followers",
]);

/** The result of a real save: which fields went up, which stayed here. */
export type SaveOutcome = {
  profile: Profile;
  /** Fields the account row has nowhere for — they were kept locally. */
  unsupported: string[];
  /** True when nothing reached the server (offline / unconfigured). */
  localOnly: boolean;
};

/** Builds the change record from a full local profile, skipping serverless
    fields and everything unchanged since `baseline` — so a save that touches
    nothing sends nothing.

    Keyed in the screen's own field names on purpose: `/api/profile` validates
    and maps by those names (`bridge/validation.ts`, `bridge/contract.ts`
    PROFILE_FIELDS) and converts to the account row's wire names itself.
    Sending the wire names here got them mapped a second time — nothing matched,
    so the endpoint found an empty change record and reported a successful save
    that wrote nothing. */
export function patchAgainst(baseline: Profile, next: Profile): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const EDITABLE: { field: keyof Profile; clearEmpty?: boolean }[] = [
    { field: "name" },
    { field: "username" },
    { field: "bio", clearEmpty: true },
    { field: "gender", clearEmpty: true },
    { field: "dob", clearEmpty: true },
    { field: "photo", clearEmpty: true },
    { field: "banner", clearEmpty: true },
    { field: "pronouns", clearEmpty: true },
    { field: "location", clearEmpty: true },
    { field: "website", clearEmpty: true },
    { field: "jobRole", clearEmpty: true },
    { field: "jobCompany", clearEmpty: true },
    { field: "jobPlace", clearEmpty: true },
    { field: "jobStartedOn", clearEmpty: true },
  ];
  for (const { field, clearEmpty } of EDITABLE) {
    if (next[field] === baseline[field]) continue;
    if (next[field] === undefined) continue;
    let value: unknown = next[field];
    if (clearEmpty && value === "") value = null;
    patch[field] = value;
  }
  if (JSON.stringify(next.skills) !== JSON.stringify(baseline.skills)) {
    patch.skills = next.skills;
  }
  return patch;
}

/* ── Talking to the endpoint ─────────────────────────────────────── */

/**
 * Lay a server answer over the cache — after asking whose answer it is.
 *
 * `bindAccount` is the reason this exists as one function instead of a line
 * at each call site: the cache is keyed by browser, not by person, so the
 * only safe moment to trust it is once the account row has said which id it
 * belongs to. A different id means the traces on this device describe someone
 * else, and they are wiped before anything is merged over them — which is why
 * the read below happens after the bind, not before.
 */
function applyServerProfile(server: Record<string, unknown>): Profile {
  const id = typeof server?.id === "string" ? server.id : "";
  bindAccount(id);
  const merged = mergeWithServer(readCache() ?? DEFAULT_PROFILE, server);
  merged.username = slugOf(merged.username);
  writeCache(merged);
  return merged;
}

/** Pulls the account row and lays it over the cache. Returns the merged
    profile, or null when the server said no (401 → sign in again) or
    nothing could be reached. */
export async function syncProfile(): Promise<Profile | null> {
  const result = await fetchProfile();
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return null;
  }
  return applyServerProfile(result.data.profile as Record<string, unknown>);
}

/** Saves through the endpoint. Optimistic local write first (so the UI
    moves at once), then the server answer is authoritative for server
    fields; serverless fields stay as the caller sent them. */
export async function persistProfile(
  baseline: Profile,
  next: Profile,
): Promise<{ ok: true; outcome: SaveOutcome } | { ok: false; errors?: Record<string, string>; message?: string; loginUrl?: string }> {
  const patch = patchAgainst(baseline, next);
  writeCache(next); // optimistic

  const result = await saveProfile(patch);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return { ok: false, message: "Sign in again to save.", loginUrl: result.loginUrl };
    }
    if (result.kind === "invalid") return { ok: false, errors: result.errors };
    return { ok: false, message: result.message };
  }

  const unsupported = (result.data.unsupported ?? []).map((row) => row.field);
  const merged = applyServerProfile(result.data.profile as Record<string, unknown>);

  return { ok: true, outcome: { profile: merged, unsupported, localOnly: false } };
}

/** A saved photo is a data URL in a several-hundred-kilobyte string, so the
    navigation and the chat rows shouldn't be re-reading it on every render.
    Anyone who changes the profile announces it here instead. */
export const PROFILE_EVENT = "tirbeo:profile";

/** Fired when the server says the credential is no good — the shell
    listens for this and moves the reader to the accounts login. */
export const SESSION_EXPIRED_EVENT = "tirbeo:session-expired";

/** "Soham Dhitle" → "Soham D." — what fits beside an avatar without
    pushing the rest of the row out. */
export function shortName(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/* One server reconciliation per page load, shared by every component that
    mounts `useProfile` — not one fetch each. The first caller starts it;
    the rest await the same promise. A second load is only paid after the
    cache window passes. */
let inflightSync: Promise<Profile | null> | null = null;
let lastSyncAt = 0;
const SYNC_MIN_INTERVAL_MS = 15_000;

function sharedSync(): Promise<Profile | null> {
  const now = Date.now();
  if (inflightSync) return inflightSync;
  if (now - lastSyncAt < SYNC_MIN_INTERVAL_MS) return Promise.resolve(readCache());
  lastSyncAt = now;
  inflightSync = syncProfile()
    .then((merged) => {
      if (merged && typeof window !== "undefined") {
        window.dispatchEvent(new Event(PROFILE_SYNCED_EVENT));
      }
      return merged;
    })
    .finally(() => {
      inflightSync = null;
    });
  return inflightSync;
}

/** Fired once per completed server reconciliation — pages that read the
    local cache directly (rather than via useProfile) listen for this to
    repaint when the server answer lands. */
export const PROFILE_SYNCED_EVENT = "tirbeo:profile-synced";

/** Named export for pages that paint from the cache and just need to know
    when the shared reconciliation has run (personal-details, the export). */
export function sharedSyncForDetails(): Promise<Profile | null> {
  return sharedSync();
}

/** `null` until the store has been read, so a page shows its skeleton rather
    than the default name and then correct itself mid-paint. Reads the cache
    first (instant), then reconciles with the server once per page load —
    shared across every component on the page. */
export function useProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;
    const look = () => setProfile(readCache());
    look();
    sharedSync().then((merged) => {
      if (alive && merged) setProfile(merged);
    });
    window.addEventListener(PROFILE_EVENT, look);
    window.addEventListener("storage", look);
    return () => {
      alive = false;
      window.removeEventListener(PROFILE_EVENT, look);
      window.removeEventListener("storage", look);
    };
  }, []);

  return profile;
}
