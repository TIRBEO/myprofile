"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { PillButton } from "@/components/settings-shell";
import { formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { trackEvent } from "@/lib/telemetry";

/* ═══════════════════════════════════════════════════════════════════
   The interruption screen — what a banned, suspended or deleted account
   sees after the accounts app hands them over. The event reference is the
   point of this page: quoting it lets support (and the admin event lookup)
   pull the exact row that carried the decision.
   ═══════════════════════════════════════════════════════════════════ */

const COPY: Record<string, { title: string; lead: string }> = {
  banned: {
    title: "Your account is banned",
    lead: "This decision was made by Tirbeo staff after reviewing the account. It is permanent.",
  },
  suspended: {
    title: "Your account is suspended",
    lead: "The account is on hold while a review is completed. Sign-in is disabled until then.",
  },
  deleted: {
    title: "Your account was deleted",
    lead: "The deletion you (or a recovery of it) set in motion has completed. The data is gone.",
  },
};

export function BlockedView({
  kind,
  eventId,
  reason,
  until,
}: {
  kind: "banned" | "suspended" | "deleted";
  eventId: string | null;
  reason: string | null;
  until: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copy = COPY[kind];
  const untilAt = until ? Date.parse(until) : null;

  useEffect(() => {
    trackEvent("auth.block_viewed", {
      detail: kind,
      metadata: { eventId: eventId ?? undefined },
    });
  }, [kind, eventId]);

  async function copyRef() {
    if (!eventId) return;
    try {
      await navigator.clipboard.writeText(eventId);
      setCopied(true);
      haptic("success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (insecure context) — the code is still readable */
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-6 sm:p-7">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">{copy.title}</h1>
        {untilAt && !Number.isNaN(untilAt) ? (
          <p className="mt-1 text-[13px] text-muted">
            {kind === "suspended" ? "Under review until" : "Until"}{" "}
            {formatStamp(untilAt)}.
          </p>
        ) : null}
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted">{copy.lead}</p>
        {reason ? (
          <p className="mt-3 rounded-xl bg-field px-3.5 py-2.5 text-[14px] leading-relaxed text-text-2">
            {reason}
          </p>
        ) : null}
        {eventId ? (
          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-text-4">
              Event reference
            </p>
            <button
              type="button"
              onClick={copyRef}
              aria-label={`Copy event reference ${eventId}`}
              className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-field px-3.5 py-2.5 text-left transition-colors hover:bg-field-hover"
            >
              <code className="font-mono text-[14.5px] text-fg">{eventId}</code>
              {copied ? (
                <Check size={16} className="shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Copy size={16} className="shrink-0 text-text-3" aria-hidden="true" />
              )}
            </button>
            <p className="mt-2 text-[13px] leading-relaxed text-text-4">
              Quote this reference when contacting support so the exact decision record can be
              found.
            </p>
          </div>
        ) : null}
        <div className="mt-6 flex items-center gap-3">
          <PillButton label="Back to sign in" onClick={() => (window.location.href = "/login")} />
          <a
            href="mailto:support@tirbeo.com"
            className="text-[14px] font-semibold text-accent-text underline underline-offset-4"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
