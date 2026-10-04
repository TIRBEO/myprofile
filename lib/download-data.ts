"use client";

/* ═══════════════════════════════════════════════════════════════════
   Download your data

   The account keeps this data, so the account produces the file. One call
   gathers every record set the account owns and hands it back as JSON; the
   browser never assembles an archive from what it happens to have lying in
   local storage, because that would be a copy of a copy — whatever this
   device happened to see, and nothing it didn't.

   Two things are deliberately absent. There is no countdown: the file is
   ready when the account says so, not after a fixed pretence of work. And
   there is no stored archive: Tirbeo writes the file at the moment you ask
   and does not keep it, so the history here is of *downloads*, and asking
   again gets a fresh copy of whatever the account holds then.

   What never comes out in the file: a password, an authenticator secret or
   recovery codes, passkey or API-key credentials, or push endpoints.
   ═══════════════════════════════════════════════════════════════════ */

import { ApiError, apiJson } from "@/lib/api";

export type Counts = Record<string, number>;

export type SecuritySummary = {
  twoFactorEnabled: boolean;
  backupCodesRemaining: number;
  mustChangePassword: boolean;
  connectedAccounts: string[];
};

export type ExportRecord = {
  id: string;
  /** Milliseconds since the epoch, so the date helpers can read it directly. */
  at: number;
  bytes: number | null;
  counts: Counts | null;
};

export type ArchiveSummary = {
  exportedAt: string;
  fileName: string;
  counts: Counts;
  failed: string[];
  truncated: string[];
  security: SecuritySummary;
  recent: ExportRecord[];
};

export type DownloadedArchive = {
  fileName: string;
  bytes: number;
  /** Milliseconds since the epoch. */
  exportedAt: number;
  counts: Counts;
  missing: string[];
  truncated: string[];
};

/**
 * What each record set in the archive is, in words a person reading the page
 * can check against their own memory of the account. The keys come from the
 * account service; a key with no label here still shows up, unlabelled, rather
 * than being dropped from the list.
 */
export const SECTIONS: { key: string; label: string; sub: string }[] = [
  { key: "account", label: "Your account", sub: "Name, username, email, the choices you've made about consent and mail" },
  { key: "profile", label: "Profile", sub: "Bio, pronouns, location, work, links, skills and the counts on your page" },
  { key: "emails", label: "Email addresses", sub: "Every address on the account, and whether each one was confirmed" },
  { key: "phone", label: "Phone number", sub: "The number and whether it was verified" },
  { key: "preferences", label: "Saved preferences", sub: "Appearance, language, notification, privacy and misc choices" },
  { key: "identities", label: "Identity records", sub: "The usernames held for you and how each was verified" },
  { key: "sessions", label: "Sign-in sessions", sub: "Every session, where it came from, and when it was last used" },
  { key: "devices", label: "Devices", sub: "Browsers and phones recorded against the account" },
  { key: "passkeys", label: "Passkeys", sub: "Which device holds a key and when it was last used — never the key itself" },
  { key: "logins", label: "Sign-in history", sub: "Each sign-in attempt, its method, and whether it succeeded" },
  { key: "activity", label: "Activity log", sub: "Changes you've made and what they were changed from and to" },
  { key: "notifications", label: "Notifications", sub: "What we've told you, and whether you read it" },
  { key: "emailsSent", label: "Emails we sent you", sub: "Subject, category, whether it was opened or clicked" },
  { key: "tipLogs", label: "Tips shown", sub: "Which in-app tips you've already seen" },
  { key: "statusChanges", label: "Account status changes", sub: "Any change to active, suspended or banned, with its reason" },
  { key: "restrictions", label: "Restrictions", sub: "Strikes and limits placed on the account, and their wording" },
  { key: "appeals", label: "Appeals", sub: "What you asked us to review, and the decision" },
  { key: "deactivation", label: "Deactivation", sub: "Whether the account was paused, when, and why" },
  { key: "deletionRequest", label: "Deletion request", sub: "A scheduled deletion, its reason and its dates" },
  { key: "apiKeys", label: "API keys", sub: "Name, what it may do, and when it was last used — never the key" },
  { key: "pushSubscriptions", label: "Push channels", sub: "Which browsers could receive notifications — not their addresses" },
];

export function sectionLabel(key: string): string {
  return SECTIONS.find((section) => section.key === key)?.label ?? key;
}

/**
 * The account's record of what it would give up, plus the downloads it has
 * already written. Dates arrive as ISO text and are turned into milliseconds
 * here, once, so every page can hand them straight to the date helpers.
 */
export async function readArchiveSummary(): Promise<ArchiveSummary> {
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
      at: asMillis(row.at),
      bytes: row.bytes === null || row.bytes === undefined ? null : Number(row.bytes),
      counts: (row.counts ?? null) as Counts | null,
    })),
  };
}

function asMillis(value: unknown): number {
  return typeof value === "number" ? value : Date.parse(String(value));
}

/**
 * Fetches the archive and hands it to the browser as a file.
 *
 * The byte count is measured from the bytes actually received rather than
 * trusting a header: if the transfer is cut short, the page has to say the
 * file was smaller than the account described, not report a clean download.
 */
export async function downloadArchive(): Promise<DownloadedArchive> {
  const res = await fetch("/api/user/export-data", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw await toDownloadError(res);

  const blob = await res.blob();
  let parsed: any;
  try {
    parsed = JSON.parse(await blob.text());
  } catch {
    throw new ApiError("The file arrived incomplete. Nothing was saved — please try again.", res.status);
  }

  const fileName = String(parsed?.format ? fileNameFrom(parsed) : "tirbeo-account.json");
  saveBlob(blob, fileName);

  return {
    fileName,
    bytes: blob.size,
    exportedAt: parsed.exportedAt ? asMillis(parsed.exportedAt) : Date.now(),
    counts: (parsed.counts ?? {}) as Counts,
    missing: (parsed.missing ?? []) as string[],
    truncated: (parsed.truncated ?? []) as string[],
  };
}

function fileNameFrom(archive: any): string {
  const when = String(archive.exportedAt ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const stem = String(archive?.account?.username || String(archive?.account?.email || "account").split("@")[0]);
  return `tirbeo-account-${stem.replace(/[^A-Za-z0-9._-]/g, "")}-${when}.json`;
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

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function recordsIn(counts: Counts | null | undefined): number {
  return Object.values(counts ?? {}).reduce((total, n) => total + (Number(n) || 0), 0);
}
