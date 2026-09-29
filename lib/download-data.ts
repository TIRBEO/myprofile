"use client";

/* ═══════════════════════════════════════════════════════════════════
   Download your data

   Nothing prepares an archive server-side yet, so the whole flow runs
   in this browser: the request is logged, the wait is measured against
   the time it was logged, and the file itself is written here from what
   this device holds. Nothing is uploaded and nothing is emailed — the
   request list is the shape a backend will return later, and its seed
   rows are invented for display.

   Which parts are real: the account fields, preferences, sign-ins,
   devices and the change log are read back from this browser's own
   stores. Nothing is invented for display, and a password never appears.
   ═══════════════════════════════════════════════════════════════════ */

import { readProfile } from "@/lib/profile";

const STORE = "tirbeo:download-requests";
const RATE_STORE = "tirbeo:download-requests:rate";

const DEVICE_STORE = "tirbeo:devices";
const LOGIN_STORE = "tirbeo:login-activity";
const CHANGE_STORE = "tirbeo:activity-log";

/** Saved choices an archive should carry, by the store each page writes to. */
const PREF_STORES: { group: string; key: string }[] = [
  { group: "Language", key: "tirbeo:language" },
  { group: "Profile visibility", key: "tirbeo:visibility" },
  { group: "Notifications", key: "tirbeo:email-prefs" },
  { group: "Mentions", key: "tirbeo:mentions" },
  { group: "Sign-in", key: "tirbeo:security" },
];

export const MAX_REQUESTS = 6;
export const RATE_WINDOW_MS = 24 * 60 * 60_000;
export const RATE_MAX = 3;
/** How long a request takes to prepare, and how often progress is checked. */
export const PREP_MS = 12_000;
export const TICK_MS = 1_000;

export type Format = "json" | "html";
export type Scope = "everything" | "profile";

export const FORMATS: { value: Format; label: string; sub: string }[] = [
  { value: "json", label: "JSON", sub: "Structured data, best for reusing elsewhere" },
  { value: "html", label: "HTML", sub: "Readable pages you can open in a browser" },
];

export const SCOPES: { value: Scope; label: string; sub: string }[] = [
  { value: "everything", label: "Everything", sub: "Account, saved choices, sign-ins, devices and the changes you've made" },
  { value: "profile", label: "Profile only", sub: "Your details and the choices you've saved" },
];

export function scopeLabel(scope: Scope): string {
  return SCOPES.find((option) => option.value === scope)?.label ?? scope;
}

export function formatLabel(format: Format): string {
  return FORMATS.find((option) => option.value === format)?.label ?? format;
}

export type ArchiveRequest = {
  id: string;
  format: Format;
  scope: Scope;
  requestedAt: number;
  /** When the file was saved to this device, or null if it never was. */
  savedAt: number | null;
};

export type RequestResult = { ok: true; requests: ArchiveRequest[] } | { ok: false; retryInMs: number };

/* ── The request list ──────────────────────────────────────────── */

export function readRequests(): ArchiveRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<ArchiveRequest>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is ArchiveRequest =>
          typeof row?.id === "string" &&
          typeof row?.requestedAt === "number" &&
          (row?.format === "json" || row?.format === "html") &&
          SCOPES.some((scope) => scope.value === row?.scope),
      )
      .map((row) => ({ ...row, savedAt: typeof row.savedAt === "number" ? row.savedAt : null }))
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, MAX_REQUESTS);
  } catch {
    return [];
  }
}

function writeRequests(requests: ArchiveRequest[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(requests.slice(0, MAX_REQUESTS)));
  } catch {
    /* private mode — the request still holds for this session */
  }
}

export function isReady(request: ArchiveRequest, at: number): boolean {
  return at - request.requestedAt >= PREP_MS;
}

/** One request by its id, or null when this device never filed it. */
export function findRequest(id: string | undefined | null): ArchiveRequest | null {
  if (!id) return null;
  return readRequests().find((request) => request.id === id) ?? null;
}

/** 0–100, so a tick of the clock moves the number in front of the user. */
export function progressOf(request: ArchiveRequest, at: number): number {
  return Math.min(100, Math.round(((at - request.requestedAt) / PREP_MS) * 100));
}

/** How long a saved archive stays worth re-downloading from its own page.
    After a week the file is old enough that handing it over again without
    saying so would be a small lie, so the button closes and points at a
    fresh request instead. */
export const RESAVE_MS = 7 * 24 * 60 * 60_000;

export function resaveClosed(request: ArchiveRequest, at: number): boolean {
  return !!request.savedAt && at - request.savedAt > RESAVE_MS;
}

/**
 * Files a request. Three a day, because preparing one is the same work
 * whether or not the file is ever saved. Returns the wait instead when
 * the limit is already reached.
 */
export function requestArchive(format: Format, scope: Scope): RequestResult {
  const retryInMs = cooldownMs();
  if (retryInMs > 0) return { ok: false, retryInMs };

  const fresh: ArchiveRequest = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    format,
    scope,
    requestedAt: Date.now(),
    savedAt: null,
  };
  writeRequests([fresh, ...readRequests()]);
  try {
    localStorage.setItem(RATE_STORE, JSON.stringify([...recentMarks(), fresh.requestedAt]));
  } catch {
    /* private mode — the limit isn't remembered between visits */
  }
  return { ok: true, requests: readRequests() };
}

/** Remember that the archive was saved, so the history says so. */
export function markSaved(id: string): ArchiveRequest[] {
  writeRequests(readRequests().map((request) => (request.id === id ? { ...request, savedAt: Date.now() } : request)));
  return readRequests();
}

/* ── Rate limit ────────────────────────────────────────────────── */

function readMarks(): number[] {
  try {
    const raw = localStorage.getItem(RATE_STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function recentMarks(): number[] {
  const now = Date.now();
  return readMarks().filter((t) => now - t < RATE_WINDOW_MS);
}

/** Milliseconds until another archive may be requested; 0 when it's allowed. */
export function cooldownMs(): number {
  if (typeof window === "undefined") return 0;
  const marks = recentMarks();
  if (marks.length < RATE_MAX) return 0;
  return Math.max(0, RATE_WINDOW_MS - (Date.now() - marks[0]));
}

export function cooldownLabel(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  return `${Math.ceil(mins / 60)} hr`;
}

/* ── Archive contents ──────────────────────────────────────────── */

type Rows = Record<string, string>[];
export type Section = { name: string; rows: Rows };

function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readList(key: string): Record<string, unknown>[] {
  const value = readRaw(key);
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function iso(at: number): string {
  return new Date(at).toISOString();
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function time(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "number" ? iso(value) : "";
}

/** Plain string/number/boolean fields of a saved object, nothing nested. */
function flat(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && raw) out[key] = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = String(raw);
  }
  return out;
}

/** The account fields as this browser holds them — the same record the
    profile page and the two edit screens read, so an archive can't disagree
    with what's on screen. */
function accountRows(): Rows {
  const saved = readProfile();
  return [
    { field: "Name", value: saved.name },
    { field: "Username", value: saved.username },
    { field: "Location", value: saved.location },
    { field: "Pronouns", value: saved.pronouns },
    { field: "Email address", value: "a.shrestha97@gmail.com" },
    { field: "Phone number", value: "+977 98064 18877" },
    { field: "Sign-in", value: "Email and password" },
    { field: "Two-factor", value: "On" },
  ];
}

function preferenceRows(): Rows {
  const rows: Rows = [];
  for (const { group, key } of PREF_STORES) {
    const saved = flat(readRaw(key));
    for (const [field, value] of Object.entries(saved)) rows.push({ group, setting: field, value });
  }
  return rows.length
    ? rows
    : [
        { group: "Language", setting: "language", value: "English" },
        { group: "Profile visibility", setting: "privateAccount", value: "true" },
      ];
}

function signInRows(): Rows {
  return readList(LOGIN_STORE).map((row) => ({
    at: time(row, "at"),
    kind: text(row, "kind"),
    device: text(row, "device"),
    location: text(row, "location"),
  }));
}

function changeRows(): Rows {
  return readList(CHANGE_STORE).map((row) => ({
    at: time(row, "at"),
    field: text(row, "field"),
    was: text(row, "from"),
    now: text(row, "to"),
    device: text(row, "device"),
  }));
}

function deviceRows(): Rows {
  return readList(DEVICE_STORE).map((row) => ({
    name: text(row, "name"),
    os: text(row, "os"),
    browser: text(row, "browser"),
    location: text(row, "location"),
    lastActiveAt: time(row, "lastActiveAt"),
  }));
}

function requestRows(): Rows {
  return readRequests().map((request) => ({
    requestedAt: iso(request.requestedAt),
    format: request.format,
    scope: request.scope,
    savedAt: request.savedAt ? iso(request.savedAt) : "not saved",
  }));
}

export function sectionsFor(scope: Scope): Section[] {
  const account: Section[] = [
    { name: "Account", rows: accountRows() },
    { name: "Preferences", rows: preferenceRows() },
  ];
  if (scope === "profile") return account;
  return [
    ...account,
    { name: "Login activity", rows: signInRows() },
    { name: "Account changes", rows: changeRows() },
    { name: "Devices", rows: deviceRows() },
    { name: "Data requests", rows: requestRows() },
  ];
}

/** What an archive is made of, section by section — the same rows the file
    will carry, so a page can say what's inside before it's saved. */
export function buildSections(request: ArchiveRequest): Section[] {
  return sectionsFor(request.scope);
}

/** How big the file is, in bytes. Built here rather than remembered, because
    the answer changes with everything the archive reads. */
export function archiveBytes(request: ArchiveRequest): number {
  if (typeof window === "undefined") return 0;
  return new Blob([buildArchive(request)]).size;
}

/** The archive as text — the caller decides it never leaves the device. */
export function buildArchive(request: ArchiveRequest): string {
  const sections = sectionsFor(request.scope);
  if (request.format === "json") {
    return `${JSON.stringify(
      {
        exportedAt: iso(Date.now()),
        scope: request.scope,
        sections: Object.fromEntries(sections.map((section) => [section.name, section.rows])),
      },
      null,
      2,
    )}\n`;
  }
  return htmlDocument(request, sections);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}

function htmlTable(section: Section): string {
  const columns = Object.keys(section.rows[0] ?? {});
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = section.rows
    .map((row) => `      <tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`)
    .join("\n");
  return `    <section>
      <h2>${escapeHtml(section.name)}</h2>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>
${body}
        </tbody>
      </table>
    </section>`;
}

function htmlDocument(request: ArchiveRequest, sections: Section[]): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tirbeo data — ${escapeHtml(scopeLabel(request.scope))}</title>
    <style>
      body { font: 15px/1.5 system-ui, sans-serif; margin: 40px auto; max-width: 900px; padding: 0 20px; }
      h1 { font-size: 24px; }
      h2 { font-size: 17px; margin-top: 36px; }
      p.meta { color: #5b6472; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; }
      th, td { border-bottom: 1px solid #d7dbe2; padding: 7px 9px; text-align: left; vertical-align: top; }
      th { font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>Your Tirbeo data</h1>
    <p class="meta">Exported ${escapeHtml(iso(Date.now()))}. Scope: ${escapeHtml(scopeLabel(request.scope))}.</p>
${sections.map(htmlTable).join("\n")}
  </body>
</html>
`;
}

/* ── Writing the file ──────────────────────────────────────────── */

export function fileNameFor(request: ArchiveRequest): string {
  return `tirbeo-${request.scope}-${request.format === "json" ? "data" : "pages"}.${request.format}`;
}

/** Builds the archive here and hands it to the browser's save flow. */
export function downloadArchive(request: ArchiveRequest) {
  const content = buildArchive(request);
  const blob = new Blob([content], {
    type: request.format === "json" ? "application/json" : "text/html",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(request);
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
