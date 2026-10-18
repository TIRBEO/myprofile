"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/settings-shell";
import { Prose, StatementScreen, Value } from "@/components/statement";
import {
  acknowledgeWelcomeBack,
  type WelcomeBack,
  type WelcomeBackFrom,
} from "@/lib/welcome-back";
import { formatDate } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { trackEvent } from "@/lib/telemetry";

/* ═══════════════════════════════════════════════════════════════════
   Welcome back

   The end of an account's interruption, said on a page of its own. The
   settings used to simply reopen — a person who had been away six weeks
   landing on the same grid of rows as if the six weeks hadn't happened, with
   nothing to tell them the account is theirs again.

   So this answers the three questions an account like that actually arrives
   with, in this order: what shut it, how long it stayed shut, and who opened
   it. Every one of those is the account's own record (`GET
   /api/users/welcome-back`) rather than a guess made here, and where the
   record is silent the screen says so instead of inventing a reason.

   The same full-bleed column every statement screen uses, and the same
   reason: a card the width of a sentence would make an apology into a dialog
   you can dismiss without reading. Pressing Continue spends the record
   server-side, so this is the last time it appears.
   ═══════════════════════════════════════════════════════════════════ */

/** The way each closed state is put, to the person who had to live with it.
    "deletion_pending" is not a sentence anybody reads; what it means is that
    a clock was running on their account, and that is what goes here. */
const CLOSED: Record<WelcomeBackFrom, string> = {
  banned: "Your account was banned.",
  suspended: "Your account was suspended.",
  deactivated: "You paused it yourself.",
  deletion_pending: "It was scheduled for deletion.",
};

/** Days, said as days — the one number the reader came for. Coerced rather
    than trusted, because it arrives over a wire: a count the account sent as
    a string is still the count, and a count that isn't a number at all is not
    worth inventing one for. */
function awayFor(value: number): string {
  const days = Math.max(0, Math.round(Number(value)));
  if (!Number.isFinite(days) || days < 1) return "Away for less than a day";
  return `Away for ${days} ${days === 1 ? "day" : "days"}`;
}

export function WelcomeBackScreen({ welcome }: { welcome: WelcomeBack }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const paused = Date.parse(welcome.pausedAt);
  const restored = Date.parse(welcome.restoredAt);
  const restoredAt = Number.isNaN(restored) ? null : restored;
  const closedWord = CLOSED[welcome.from] ?? "Your account was closed.";
  const resolvedBy =
    welcome.actor === "user"
      ? "You restored your account yourself."
      : "Tirbeo staff reinstated your account.";

  function carryOn() {
    if (busy) return;
    setBusy(true);
    haptic("success");
    trackEvent("auth.welcome_back_acknowledged", {
      detail: welcome.from,
      metadata: { days_off: welcome.daysOff },
    });
    /* The screen comes down the moment this is pressed — it has already said
       the only thing it has to say, and waiting on a write to be told that
       would make the courtesy cost a second of staring at a button. The ack
       is what stops it appearing a second time, on another device or after a
       reload. */
    void acknowledgeWelcomeBack(welcome);
    router.replace("/settings");
  }

  return (
    <StatementScreen
      title="Welcome back to Tirbeo"
      lead="Sorry for the interruption — your account is fully restored."
      meta={restoredAt ? `Restored on ${formatDate(restoredAt)}` : undefined}
      blocks={[
        {
          label: "What happened",
          body: (
            <>
              <Prose>
                {closedWord}{" "}
                {Number.isNaN(paused) ? null : `That began on ${formatDate(paused)}.`}
              </Prose>
              {welcome.reason ? (
                <Prose>
                  The reason recorded on it: <Value>“{welcome.reason}”</Value>.
                </Prose>
              ) : (
                <Prose>No reason was recorded on that decision, and none is being invented here.</Prose>
              )}
              <Prose className="text-fg">{awayFor(welcome.daysOff)}.</Prose>
              <Prose>{resolvedBy}</Prose>
            </>
          ),
        },
        {
          label: "What this means",
          body: (
            <>
              <Prose>
                The profile, your details, your saved choices and your history are all still there
                — nothing was removed while the account was closed, and nothing has to be put back.
              </Prose>
              <Prose>
                Every other device was signed out when the account stopped. They&apos;ll need your
                password again; nothing else about them changed.
              </Prose>
            </>
          ),
        },
        {
          label: "What you can do",
          body: (
            <Prose>
              Carry on from here. Pressing below tells us you&apos;ve read this, so the message
              appears once and not on every device you sign in from.
            </Prose>
          ),
        },
      ]}
      actions={<PillButton label="Continue" onClick={carryOn} disabled={busy} />}
      foot="Everything behind this screen is the account's own record — the state it was in, the reason it was put there and the moment it was given back. Where that record was silent, this page said so rather than filling the gap."
    />
  );
}
