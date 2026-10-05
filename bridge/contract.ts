/**
 * The field map between what these screens hold and what the account row has
 * columns for.
 *
 * Two names for the same thing is how a profile silently loses an edit: the
 * screen says `location`, the row says `country`, and nothing complains when
 * one of them is dropped. So every field is declared once here, and
 * `UNSUPPORTED_FIELDS` makes the gaps loud instead of quiet.
 */

export type WireField = {
  /** The key this app's own form state uses. */
  local: string;
  /** The key on the main API's account row. */
  wire: string;
  /** Sent on create as well as edit. */
  writable: boolean;
  /** Coerced on the way in and out. A `date` is `YYYY-MM-DD` here and a full
      timestamp on the row — passing one through unchanged puts a time into the
      form and a bare date into a `DateTime` column. */
  kind?: "date";
  note?: string;
};

/** Kept in the same order the edit-profile screen lays them out. */
export const PROFILE_FIELDS: WireField[] = [
  /* The account's own id. Not a form field — but it has to travel, because a
     browser cache is only safe when it knows whose data it holds. Without
     this, a screen painting from the cache can't tell account B from the
     account A it replaced. */
  { local: "id", wire: "id", writable: false, note: "the row's primary key — read-only here, and the only honest owner of the local cache" },
  { local: "name", wire: "name", writable: true },
  { local: "username", wire: "username", writable: true },
  { local: "bio", wire: "bio", writable: true },
  { local: "gender", wire: "gender", writable: true },
  { local: "dob", wire: "birthday", writable: true, kind: "date", note: "the row holds a date, the screen holds a plain calendar date" },
  { local: "photo", wire: "photoUrl", writable: true },
  { local: "banner", wire: "bannerUrl", writable: true },
  { local: "pronouns", wire: "pronouns", writable: true },
  { local: "location", wire: "location", writable: true },
  { local: "website", wire: "website", writable: true },
  { local: "email", wire: "email", writable: false, note: "login identity — changed through the auth flow, never here" },
  { local: "phone", wire: "phoneNumber", writable: false, note: "recovery number — owned by /api/security/phones" },
  { local: "jobRole", wire: "companyRole", writable: true },
  { local: "jobCompany", wire: "companyName", writable: true },
  { local: "jobPlace", wire: "jobPlace", writable: true },
  { local: "jobStartedOn", wire: "jobStarted", writable: true },
  { local: "skills", wire: "skills", writable: true, note: "a JSON list on the row, a string list on the screen — it must travel in the map or a skills edit saves nothing and still reports success" },
];

/**
 * Fields the screens edit that no table holds yet. The clean rebuild moved
 * almost everything onto real columns; these are what remain — follower
 * counts live on the row but belong to a social graph, not a form.
 */
export const UNSUPPORTED_FIELDS = [
  { local: "followers", reason: "counted from the social graph, not editable" },
  { local: "following", reason: "counted from the social graph, not editable" },
];

/** A row timestamp and a form date are the same fact in two shapes; neither
    side should have to know about the other's format. */
function toLocalDate(value: unknown): unknown {
  if (value === null || value === "" || value === undefined) return value ?? null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? match[0] : text;
}

function toWireDate(value: unknown): unknown {
  if (value === null || value === "" || value === undefined) return value ?? null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00.000Z` : text;
}

export function toWire(local: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of PROFILE_FIELDS) {
    if (!f.writable) continue;
    if (local[f.local] === undefined) continue;
    out[f.wire] = f.kind === "date" ? toWireDate(local[f.local]) : local[f.local];
  }
  return out;
}

export function fromWire(wire: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of PROFILE_FIELDS) {
    if (wire[f.wire] === undefined) continue;
    out[f.local] = f.kind === "date" ? toLocalDate(wire[f.wire]) : wire[f.wire];
  }
  return out;
}

/** Which unsupported fields the caller actually tried to change, with their
    reasons — only those get reported, so a plain name edit doesn't come back
    with eight warnings. */
export function unsupportedDetails(payload: Record<string, unknown>) {
  const attempted = new Set(Object.keys(payload));
  return UNSUPPORTED_FIELDS.filter((f) => attempted.has(f.local)).map(({ local, reason }) => ({
    field: local,
    reason,
  }));
}

/**
 * The response shape. `unsupported` is the honest half: the fields a client
 * sent that the row cannot hold, with the reason, so the screen can say which
 * edits did not land instead of showing a green tick over a partial write.
 */
export type ProfileResponse = {
  profile: Record<string, unknown>;
  unsupported: { field: string; reason: string }[];
  revision: string;
};
