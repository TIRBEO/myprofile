"use client";

/* ═══════════════════════════════════════════════════════════════════
   Download your data — the words the archive is described in

   The account keeps this data, so the account produces the file. The calls
   themselves live with the screen that makes them
   (app/settings/download-data/export-format.ts); this file is only the
   shared vocabulary — what each record set is called, and how a count or a
   byte size is said — so the page and the record screen never disagree.

   What never comes out in the file: a password, an authenticator secret or
   recovery codes, passkey or API-key credentials, or push endpoints.
   ═══════════════════════════════════════════════════════════════════ */

export type Counts = Record<string, number>;

export type SecuritySummary = {
  twoFactorEnabled: boolean;
  backupCodesRemaining: number;
  mustChangePassword: boolean;
  connectedAccounts: string[];
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

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function recordsIn(counts: Counts | null | undefined): number {
  return Object.values(counts ?? {}).reduce((total, n) => total + (Number(n) || 0), 0);
}
