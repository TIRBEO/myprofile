"use client";

/* One place that builds "email support" links, so every screen that reports a
   problem attaches the same facts — the event reference above all, because
   that is what lets support (and the admin event lookup) pull the exact
   record behind a block, a limit, or a failed sign-in. */

export const SUPPORT_EMAIL = "support@tirbeo.com";

export function supportMailto(subject: string, lines: (string | null | undefined | false)[]): string {
  const facts = lines.filter(Boolean).join("\n");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const body = [
    "Tirbeo support,",
    "",
    "I'm writing about the account screen below. Details attached automatically:",
    "",
    facts,
    "",
    `Reported: ${new Date().toISOString()}`,
    `Browser: ${ua}`,
    "",
    "My note:",
    "---",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The quiet text-pill every blocked/status page carries. */
export function SupportPill({
  subject,
  lines,
  label = "Email support",
}: {
  subject: string;
  lines: (string | null | undefined | false)[];
  label?: string;
}) {
  return (
    <a
      href={supportMailto(subject, lines)}
      className="btn btn-secondary w-full sm:w-auto"
    >
      {label}
    </a>
  );
}
