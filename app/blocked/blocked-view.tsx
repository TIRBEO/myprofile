"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Copy, Hourglass, Trash2 } from "lucide-react";
import { PillButton } from "@/components/settings-shell";
import { Prose, StatementMark, StatementScreen, Value } from "@/components/statement";
import { formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { trackEvent } from "@/lib/telemetry";

/* ═══════════════════════════════════════════════════════════════════
   The interruption screen — what a banned, suspended or deleted account
   sees after the accounts app hands them over. The event reference is the
   point of this page: quoting it lets support (and the admin event lookup)
   pull the exact row that carried the decision.

   Same full-bleed column the lock screens use, for the same reason: a card
   on a 440px column reads as a dialog that can be dismissed, and this is not
   a dialog. The three questions a visitor arrives with — why, what it means,
   what can be done — are the three sections, in that order.
   ═══════════════════════════════════════════════════════════════════ */

type Kind = "banned" | "suspended" | "deleted";

const COPY: Record<Kind, { title: string; lead: string; why: string; means: string; next: string }> = {
  banned: {
    title: "Your account is banned",
    lead: "This decision was made by Tirbeo staff after reviewing the account. It is permanent.",
    why: "A member of Tirbeo staff reviewed this account and decided to close it.",
    means:
      "Sign-in is closed and the profile is no longer reachable, along with everything saved to it. Nothing you do in the app will reopen it.",
    next:
      "This is only worth writing to support about if you believe the decision was made about the wrong account. The reference below is what lets them find the record it was made on.",
  },
  suspended: {
    title: "Your account is suspended",
    lead: "The account is on hold while a review is completed. Sign-in is disabled until then.",
    why: "The account is on hold while a review of it is completed.",
    means:
      "Nothing has been deleted. The profile, its details and its history are as you left them, held until the review finishes. Signing in stays off until then.",
    next:
      "A suspension ends by itself — you don't need to ask again, and asking doesn't move it up. If the date below passes with the account still closed, that is worth contacting support about.",
  },
  deleted: {
    title: "Your account was deleted",
    lead: "The deletion you (or a recovery of it) set in motion has completed. The data is gone.",
    why: "The deletion that was set in motion for this account has completed.",
    means:
      "The 30-day window ran out, so the profile, its details and everything saved to it have been removed. This is not recoverable — not by you, and not by support.",
    next:
      "Nothing here can be undone from this screen. If you believe the deletion went ahead without you confirming it — a code asked for and never entered, say — the reference below is how support checks the record.",
  },
};

/** What stands where your face would on the other account screens. These pages
    are about the account too, but the account has no picture to show any more
    — and a face on a page whose message is "this one is closed" is a stranger
    telling you about yourself. */
function Mark({ kind }: { kind: Kind }) {
  if (kind === "banned") {
    return (
      <StatementMark danger>
        <Ban />
      </StatementMark>
    );
  }
  if (kind === "deleted") {
    return (
      <StatementMark danger>
        <Trash2 />
      </StatementMark>
    );
  }
  return (
    <StatementMark>
      <Hourglass />
    </StatementMark>
  );
}

export function BlockedView({
  kind,
  eventId,
  reason,
  until,
}: {
  kind: Kind;
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
    <StatementScreen
      title={copy.title}
      lead={copy.lead}
      meta={
        untilAt && !Number.isNaN(untilAt)
          ? `${kind === "suspended" ? "Under review until" : "Until"} ${formatStamp(untilAt)}`
          : undefined
      }
      mark={<Mark kind={kind} />}
      avatar={false}
      blocks={[
        {
          label: "Why this happened",
          body: (
            <>
              <Prose>{copy.why}</Prose>
              <Prose>
                {reason ? (
                  <>
                    The reason recorded on it: <Value>“{reason}”</Value>.
                  </>
                ) : (
                  "No reason was recorded on this decision, and none is being invented here."
                )}
              </Prose>
            </>
          ),
        },
        { label: "What this means", body: <Prose>{copy.means}</Prose> },
        {
          label: "What you can do",
          body: (
            <>
              <Prose>{copy.next}</Prose>
              {eventId ? (
                <Prose>
                  <span className="text-fg">Event reference</span>{" "}
                  <code className="font-mono text-[14px] text-fg">{eventId}</code>{" "}
                  <button
                    type="button"
                    onClick={copyRef}
                    aria-label={`Copy event reference ${eventId}`}
                    className="ml-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 align-baseline text-[13.5px] font-semibold text-accent-text transition-colors hover:bg-fill"
                  >
                    {copied ? (
                      <Check className="size-[13px] shrink-0" strokeWidth={2.6} aria-hidden />
                    ) : (
                      <Copy className="size-[13px] shrink-0" aria-hidden />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  .
                </Prose>
              ) : (
                <Prose>
                  This hand-off carried no event reference, so support will have to find the account
                  another way — the email address you sign in with is enough.
                </Prose>
              )}
            </>
          ),
        },
      ]}
      actions={
        <>
          <PillButton label="Back to sign in" onClick={() => (window.location.href = "/login")} />
          {/* One loud thing, and the second choice as a word rather than a
              second button — same as the screens the gate puts up. */}
          <a
            href="mailto:support@tirbeo.com"
            className="flex min-h-11 items-center justify-center rounded-full text-[15px] font-semibold text-accent-text transition-colors hover:bg-fill"
          >
            Contact support
          </a>
        </>
      }
      foot="This page is the account's answer, not a warning about it. Where a fact wasn't carried over — a reason, a date, a reference — the screen above says so instead of filling the gap."
    />
  );
}
