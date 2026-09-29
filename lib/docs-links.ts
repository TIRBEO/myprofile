"use client";

/* ═══════════════════════════════════════════════════════════════════
   Which guides belong to which page

   The documentation is only worth having if you find it where you got
   stuck, so every settings page names the articles written about it and
   the shell prints them at the bottom. This file is deliberately just
   strings — it doesn't import the articles themselves, because pulling
   the whole documentation into every page's bundle to render three chips
   would cost more than the feature is worth.

   Keys are the page's own path. A page under /settings/devices/something
   walks up to /settings/devices, so a detail page inherits its list's
   guides. Anything at the top level that isn't a known route is somebody's
   profile, and gets the profile guides.
   ═══════════════════════════════════════════════════════════════════ */

export type GuideLink = { slug: string; label: string };

const GUIDES: Record<string, GuideLink[]> = {
  "/settings/security": [
    { slug: "change-password", label: "Changing the password" },
    { slug: "wrong-current-password", label: "“Current password is wrong”" },
    { slug: "recovery-email", label: "Recovery email" },
  ],
  "/settings/two-factor": [
    { slug: "turn-on-two-factor", label: "Turning it on" },
    { slug: "turn-off-two-factor", label: "Turning it off" },
    { slug: "authenticator-code-wrong", label: "The code isn't accepted" },
  ],
  "/settings/backup-codes": [
    { slug: "backup-codes", label: "How the codes work" },
    { slug: "backup-code-already-used", label: "“Already used”" },
    { slug: "lost-phone", label: "If the phone is gone" },
  ],
  "/settings/passkeys": [
    { slug: "set-up-passkey", label: "Adding a passkey" },
    { slug: "passkey-not-working", label: "When it won't unlock" },
  ],
  "/settings/login-activity": [
    { slug: "sign-in-not-me", label: "A sign-in that wasn't me" },
    { slug: "unknown-device", label: "A device I don't know" },
    { slug: "sign-in-blocked", label: "Being blocked from signing in" },
  ],
  "/settings/devices": [
    { slug: "sign-out-other-devices", label: "Signing other devices out" },
    { slug: "unknown-device", label: "A device I don't know" },
  ],
  "/settings/download-data": [
    { slug: "data-copy", label: "Taking a copy of your data" },
    { slug: "archive-request", label: "What the archive holds" },
    { slug: "archive-limit", label: "Why there's a daily limit" },
  ],
  "/settings/recently-deleted": [
    { slug: "restore-deleted", label: "Getting something back" },
    { slug: "data-copy", label: "Taking a copy of your data" },
  ],
  "/settings/your-activity": [
    { slug: "time-spent", label: "What the activity log keeps" },
    { slug: "change-not-mine", label: "A change I didn't make" },
  ],
  "/settings/activity-log": [
    { slug: "change-not-mine", label: "A change I didn't make" },
    { slug: "time-spent", label: "What the activity log keeps" },
  ],
  "/settings/data-permissions": [
    { slug: "privacy", label: "What's collected about you" },
    { slug: "data-permissions", label: "Each row, explained" },
  ],
  "/settings/connected-apps": [
    { slug: "disconnect-app", label: "Removing an app's access" },
    { slug: "privacy", label: "What's collected about you" },
  ],
  "/settings/notifications": [
    { slug: "emails", label: "The emails Tirbeo sends" },
    { slug: "pause-emails", label: "Pausing them all at once" },
  ],
  "/settings/language": [
    { slug: "language", label: "Language, dates and numbers" },
    { slug: "language-dates", label: "What changes and what doesn't" },
  ],
  "/settings/appearance": [
    { slug: "theme-choice", label: "Dark, light and following the system" },
  ],
  "/settings/edit-profile": [
    { slug: "change-name", label: "Changing your name" },
    { slug: "photo-rejected", label: "When a photo is refused" },
  ],
  "/settings/personal-details": [
    { slug: "phone-not-checked", label: "Why a number gets re-checked" },
  ],
  "/settings/deactivate": [
    { slug: "deactivate-return", label: "Coming back from a pause" },
    { slug: "closing", label: "Deactivating instead of deleting" },
  ],
  "/settings/delete-account": [
    { slug: "cancel-deletion", label: "Reversing a deletion" },
    { slug: "closing", label: "Deactivating instead of deleting" },
  ],
  "/settings/account-status": [
    { slug: "status", label: "When something is restricted" },
    { slug: "account-held", label: "Appealing a decision" },
  ],
};

const TOP_LEVEL = new Set(["login", "settings", "chatbot", "api"]);

export function guidesFor(pathname: string | null): GuideLink[] {
  if (!pathname) return [];
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length || !TOP_LEVEL.has(parts[0])) return [];
  for (let n = parts.length; n > 0; n -= 1) {
    const hit = GUIDES[`/${parts.slice(0, n).join("/")}`];
    if (hit) return hit;
  }
  return [];
}
