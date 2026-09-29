"use client";

/* ═══════════════════════════════════════════════════════════════════
   Backup codes store

   Codes are generated in the browser and kept in localStorage — there is
   no server to hold them. Each set is shown exactly once: closing the
   reveal sheet, or leaving the page it sits on, files it away for good,
   so what survives of a set is its date rather than its codes. Creating
   sets is rate limited, since generating a new one is also the way to
   invalidate a set that is already saved somewhere.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:backup-codes";
const TWO_FACTOR_STORE = "tirbeo:two-factor";
const RATE_STORE = "tirbeo:backup-codes:rate";

export const CODE_COUNT = 8;
export const MAX_HISTORY = 6;
export const RATE_WINDOW_MS = 60 * 60_000;
export const RATE_MAX = 3;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type CodeSet = {
  id: string;
  createdAt: number;
  codes: string[];
  seen: boolean;
};

export type GenResult = { ok: true; fresh: CodeSet } | { ok: false; retryInMs: number };

function makeCode() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

function makeSet(): CodeSet {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    codes: Array.from({ length: CODE_COUNT }, makeCode),
    seen: false,
  };
}

export function readSets(): CodeSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<CodeSet>>;
    if (!Array.isArray(parsed)) return [];
    // Anything saved before the reveal-once rule counts as already shown.
    return parsed
      .filter((set): set is CodeSet => Array.isArray(set?.codes))
      .map((set) => ({ ...set, codes: set.codes, id: set.id ?? String(set.createdAt), seen: set.seen !== false }));
  } catch {
    return [];
  }
}

function writeSets(sets: CodeSet[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(sets.slice(0, MAX_HISTORY)));
  } catch {
    /* private mode — the codes still hold for this session */
  }
}

export function markSeen(id: string) {
  writeSets(readSets().map((set) => (set.id === id ? { ...set, seen: true } : set)));
}

/**
 * Turning the authenticator off retires every set issued under it — the
 * codes were proof of a second step that no longer exists.
 */
export function clearCodes() {
  try {
    localStorage.removeItem(STORE);
    localStorage.removeItem(RATE_STORE);
  } catch {
    /* nothing stored — nothing to retire */
  }
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

function recentMarks() {
  const now = Date.now();
  return readMarks().filter((t) => now - t < RATE_WINDOW_MS);
}

/** Milliseconds until another set may be created; 0 when it's allowed. */
export function cooldownMs(): number {
  if (typeof window === "undefined") return 0;
  const marks = recentMarks();
  if (marks.length < RATE_MAX) return 0;
  return Math.max(0, RATE_WINDOW_MS - (Date.now() - marks[0]));
}

export function cooldownLabel(ms: number) {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  return `${Math.ceil(mins / 60)} hr`;
}

/**
 * Issue a fresh set, filing away anything still unread. Returns the wait
 * remaining once the limit is hit, without creating anything.
 */
export function generate(): GenResult {
  const retryInMs = cooldownMs();
  if (retryInMs > 0) return { ok: false, retryInMs };

  const fresh = makeSet();
  writeSets([fresh, ...readSets().map((set) => ({ ...set, seen: true }))]);
  try {
    localStorage.setItem(RATE_STORE, JSON.stringify([...recentMarks(), fresh.createdAt]));
  } catch {
    /* private mode — the limit simply isn't remembered between visits */
  }
  return { ok: true, fresh };
}

/* ── Display helpers ───────────────────────────────────────────── */

export function twoFactorEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(TWO_FACTOR_STORE);
    if (!raw) return true;
    return JSON.parse(raw).authenticator !== false;
  } catch {
    return true;
  }
}

/* ── PDF download ────────────────────────────────────────────────
   Writes a one-page A4 PDF rather than opening a print window: an
   about:blank document inherits the browser's dark colour scheme, which
   lands as dark text on a dark page. Only ASCII reaches the stream, so
   string offsets double as byte offsets for the xref table.          */

const PAGE = { w: 595, h: 842, x: 56 };

function esc(text: string) {
  return text.replace(/[^\x20-\x7E]/g, "").replace(/([\\()])/g, "\\$1");
}

function drawText(x: number, y: number, size: number, body: string, bold: boolean, gray = 0) {
  return `${gray} ${gray} ${gray} rg BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(body)}) Tj ET\n`;
}

function drawBox(x: number, y: number, w: number, h: number) {
  return `0.8 0.83 0.88 RG 1 w ${x} ${y} ${w} ${h} re S\n`;
}

function codesPage(set: CodeSet, stamp: string) {
  const top = PAGE.h - 70;
  const colGap = 14;
  const colW = (PAGE.w - PAGE.x * 2 - colGap) / 2;
  const rowH = 34;
  const rowGap = 12;
  const gridTop = top - 76;

  let out = drawText(PAGE.x, top, 19, "Tirbeo backup codes", true);
  out += drawText(PAGE.x, top - 20, 10, "Each code works once, then it is gone.", false, 0.42);
  out += drawText(PAGE.x, top - 36, 10, `Generated ${stamp}`, false, 0.42);

  set.codes.forEach((code, i) => {
    const x = PAGE.x + (i % 2) * (colW + colGap);
    const y = gridTop - Math.floor(i / 2) * (rowH + rowGap);
    out += drawBox(x, y, colW, rowH);
    out += drawText(x + 12, y + 12, 9, String(i + 1), false, 0.55);
    out += drawText(x + 30, y + 11, 12, code, true);
  });

  const rows = Math.ceil(set.codes.length / 2);
  out += drawText(
    PAGE.x,
    gridTop - rows * (rowH + rowGap) - 6,
    9,
    "Keep this file somewhere safe. Generating a new set on Tirbeo invalidates every code above.",
    false,
    0.42,
  );
  return out;
}

function buildPdf(content: string) {
  // /Length counts the stream data only — the newline before `endstream` is
  // the separator the spec asks for, not part of the payload.
  const data = content.trimEnd();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${data.length} >>\nstream\n${data}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return out;
}

export function downloadCodesPdf(set: CodeSet, stamp: string) {
  const blob = new Blob([buildPdf(codesPage(set, stamp))], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tirbeo-backup-codes.pdf";
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
