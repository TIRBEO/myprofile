"use client";

/* ═══════════════════════════════════════════════════════════════════
   Choosing the format, and asking the account for it

   The archive is written by the account, so the account is what has to be
   told which format it is writing. That means two calls rather than one:

     1. POST /api/user/export-data { format }  — confirms the sheet's choice and
        writes the request. This is the first moment anything is recorded: a
        sheet that is opened and cancelled never gets here, so cancelling
        leaves no trace on the account.
     2. GET  /api/user/export-data?request=<id> — builds *that* request, in the
        format stored with it, and sends the bytes back.

   Step 1 is a write, so it goes through lib/api (it carries the CSRF token the
   account service demands from a cookie-authed write; a raw fetch would be
   refused with a silent 403). Step 2 is a read of file bytes, which is why it
   is a plain fetch — lib/api hands back JSON, and this has to hand back a blob.

   `readDownloadPage` is the page's one read: the account's counts, the parts
   that couldn't be read, and the requests already made with their format and
   whether the file was actually produced. It maps the same endpoint that
   lib/download-data.ts reads, plus the two fields the format sheet needs.
   ═══════════════════════════════════════════════════════════════════ */

import { ApiError, apiJson } from "@/lib/api";
import { SECTIONS, recordsIn, sectionLabel, type Counts, type SecuritySummary } from "@/lib/download-data";

export type ExportFormat = "json" | "html";
export type ExportRequestStatus = "pending" | "ready" | "failed";

/** The two choices the sheet offers, each with the one line that explains it. */
export const EXPORT_FORMATS: { value: ExportFormat; label: string; sub: string }[] = [
  {
    value: "json",
    label: "JSON archive",
    sub: "Machine-readable: every record in the order your account holds them, for a program or another service to take apart.",
  },
  {
    value: "html",
    label: "HTML report",
    sub: "Human-readable: the same records laid out in sections, in one file that opens in a browser. Nothing to install, nothing to fetch.",
  },
];

export function formatName(format: ExportFormat): string {
  return format === "html" ? "HTML report" : "JSON archive";
}

/**
 * How long a request may sit at "the file hasn't been written" before it stops
 * being true. The file is written the moment a browser comes back for it, so a
 * request still unwritten after this many minutes wasn't left mid-build — it
 * was confirmed and then never fetched (the tab was closed, the download
 * refused). Calling that "Gathering" would be a polite fiction, so it gets the
 * plainer word instead. Same reasoning, same place, for list and detail page.
 */
const STALE_PENDING_MS = 10 * 60 * 1000;

export function isStalePending(row: Pick<ExportRequestRow, "status" | "at">): boolean {
  return row.status === "pending" && Date.now() - row.at > STALE_PENDING_MS;
}

/** The short value a history row shows on its right: what state it is in. */
export function statusName(status: ExportRequestStatus, at?: number): string {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Couldn't be written";
  const stale = at !== undefined && Date.now() - at > STALE_PENDING_MS;
  return stale ? "Never fetched" : "Gathering";
}

export type ExportRequestRow = {
  id: string;
  /** Milliseconds since the epoch, so the date helpers can read it directly. */
  at: number;
  bytes: number | null;
  counts: Counts | null;
  format: ExportFormat;
  status: ExportRequestStatus;
  fileName: string;
  missing: string[];
  truncated: string[];
};

export type DownloadPage = {
  exportedAt: string;
  fileName: string;
  counts: Counts;
  failed: string[];
  truncated: string[];
  security: SecuritySummary;
  recent: ExportRequestRow[];
};

/** The file this page just handed to the browser, and what the account recorded about it. */
export type SavedArchive = {
  requestId: string;
  fileName: string;
  bytes: number;
  format: ExportFormat;
  requestedAt: number;
};

export function formatOf(value: unknown): ExportFormat {
  // An answer that names no format is a JSON download: that is every archive
  // the account ever wrote before there was a choice to make.
  return String(value ?? "").toLowerCase() === "html" ? "html" : "json";
}

function asMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isNaN(n) ? null : n;
}

export async function readDownloadPage(): Promise<DownloadPage> {
  const raw = await apiJson<any>("/api/user/export-data?summary=1");
  return {
    exportedAt: String(raw.exportedAt),
    fileName: String(raw.fileName),
    counts: (raw.counts ?? {}) as Counts,
    failed: (raw.failed ?? []) as string[],
    truncated: (raw.truncated ?? []) as string[],
    security: raw.security as SecuritySummary,
    recent: ((raw.recent ?? []) as any[]).map((row) => ({
      id: String(row.id),
      at: asMillis(row.at) ?? 0,
      bytes: row.bytes === null || row.bytes === undefined ? null : Number(row.bytes),
      counts: (row.counts ?? null) as Counts | null,
      format: formatOf(row.format),
      status: row.status === "ready" || row.status === "failed" ? row.status : "pending",
      fileName: String(row.fileName ?? ""),
      missing: (Array.isArray(row.missing) ? row.missing : []).map(String),
      truncated: (Array.isArray(row.truncated) ? row.truncated : []).map(String),
    })),
  };
}

/**
 * Confirm the sheet: write the request, then take the file it produces.
 *
 * The byte count is measured from what actually arrived, so a transfer cut
 * short is reported as a smaller file rather than a clean download.
 */
export async function requestArchive(format: ExportFormat): Promise<SavedArchive> {
  const created = await apiJson<any>("/api/user/export-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ format }),
  });
  const requestId = String(created?.requestId ?? "");
  if (!requestId) {
    throw new ApiError("Your account took the request but didn't give back an id, so nothing was downloaded.", 502);
  }

  const res = await fetch(`/api/user/export-data?request=${encodeURIComponent(requestId)}`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: format === "html" ? "text/html" : "application/json" },
  });
  if (!res.ok) throw await toDownloadError(res);

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new ApiError("The file arrived empty. Nothing was saved — please try again.", res.status);
  }

  // The name comes from the request rather than from the response headers: this
  // app's bridge to the account service relays the body and its type, and the
  // request already knows what the file should be called.
  const fileName = String(created?.fileName || `tirbeo-account-${format === "html" ? "report" : "data"}.${format}`);
  saveBlob(blob, fileName);

  return {
    requestId,
    fileName,
    bytes: blob.size,
    format: formatOf(created?.format ?? format),
    requestedAt: asMillis(created?.requestedAt) ?? Date.now(),
  };
}

/** A history row described in one line — what it was, how big, how many records. */
export function describeRow(row: ExportRequestRow): string {
  const bits = [formatName(row.format)];
  if (row.counts) bits.push(`${recordsIn(row.counts).toLocaleString()} records`);
  if (row.bytes !== null) bits.push(`${row.bytes.toLocaleString()} bytes`);
  if (row.status === "pending") {
    bits.push(isStalePending(row) ? "confirmed, but no file was ever fetched" : "the file hasn't been written yet");
  }
  if (row.status === "failed") bits.push("writing the file failed");
  return bits.join(" · ");
}

/** Which parts of a finished download the account couldn't read, said out loud. */
export function missingSentence(missing: string[]): string {
  if (!missing.length) return "";
  return `${missing.map(sectionLabel).join(", ")} couldn't be read, so it isn't in this file; ask again or tell support.`;
}

export function truncatedSentence(truncated: string[]): string {
  if (!truncated.length) return "";
  return `${truncated.map(sectionLabel).join(", ")} passed the 10,000-record cap, so the newest rows after that aren't here.`;
}

/** The parts the account answered for, in the page's own order plus anything new. */
export function partsOf(counts: Counts) {
  const present = SECTIONS.filter((section) => section.key in counts);
  const extra = Object.keys(counts)
    .filter((key) => !SECTIONS.some((section) => section.key === key))
    .map((key) => ({ key, label: sectionLabel(key), sub: "" }));
  return [...present, ...extra];
}

async function toDownloadError(res: Response): Promise<ApiError> {
  let message = "";
  try {
    const body = await res.json();
    message = body?.error || body?.message || "";
  } catch {
    /* the reply wasn't JSON — the status line is all there is */
  }
  return new ApiError(
    message || "Your data couldn't be gathered. Nothing was downloaded — please try again.",
    res.status,
  );
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the download has taken ownership of the bytes.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
