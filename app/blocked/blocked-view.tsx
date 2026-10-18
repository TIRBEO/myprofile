"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Check, ChevronLeft, Copy, Hourglass, PauseCircle, Trash2 } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ig-ui";
import { OtpInput } from "@/components/otp-input";
import { Group, PillButton } from "@/components/settings-shell";
import { Prose, StatementMark, StatementScreen, Value } from "@/components/statement";
import { formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { SupportPill } from "@/lib/support";
import { trackError, trackEvent, withRef } from "@/lib/telemetry";
import {
  apiRequestReactivationCode,
  apiVerifyReactivationCode,
} from "@/lib/account-lifecycle";
import { appealWithCredentials } from "@/lib/account-status";

/* ═══════════════════════════════════════════════════════════════════
   The interruption screen — what a closed account sees after the accounts
   app hands them over. The event reference is the point of this page:
   quoting it lets support (and the admin event lookup) pull the exact row
   that carried the decision.

   Same full-bleed column the lock screens use, for the same reason: a card
   on a 440px column reads as a dialog that can be dismissed, and this is not
   a dialog. The three questions a visitor arrives with — why, what it means,
   what can be done — are the three sections, in that order.

   Two of the five kinds can be ended from here rather than only argued
   about, and the flow for that is inline in the third section: a hand-off
   that sent you away from the app to be told you can come back, and then
   made you go find the sign-in page to do it, wastes the one thing the
   screen is for. The email and the code are the only proof it asks for,
   because there is no session left here to spend — the account that owns it
   is the thing that is closed.
   ═══════════════════════════════════════════════════════════════════ */

export type Kind = "banned" | "suspended" | "deleted" | "deletion_pending" | "deactivated";

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
  deletion_pending: {
    title: "Your account is scheduled for deletion",
    lead: "Nothing has been deleted yet. The date below is when it would happen, and it can still be stopped.",
    why: "A deletion was asked for on this account, and the window it waits out is still running.",
    means:
      "The profile is hidden and sign-in is off while the clock runs, but nothing has been removed. If the date passes, the profile, its details and everything saved to it are deleted, and that is not recoverable — not by you, and not by support.",
    next:
      "Cancel below: the code mailed to your sign-in address is the only thing it asks for. Calling it off puts the account back exactly as it was, and the schedule is forgotten — asking again later starts a fresh window.",
  },
  deactivated: {
    title: "Your account is paused",
    lead: "You paused this account — no one else did.",
    why: "The profile was hidden at the account's own request, from the settings.",
    means:
      "Nothing has been deleted. Your profile details, your saved choices and your history are held exactly where you left them, and your username stays reserved to you. Every device was signed out when the profile went away.",
    next:
      "Reactivate below: a code to your sign-in address is the only thing it asks for. The account comes back as it was, with the deletion clock having never started.",
  },
};

/** What stands where your face would on the other account screens. These pages
    are about the account too, but the account has no picture to show any more
    — and a face on a page whose message is "this one is closed" is a stranger
    telling you about yourself.

    Only a closed-for-good account is allowed to be red. A pause and a deletion
    that hasn't run yet are both reversible, and tinting their mark as though
    they weren't is how a person ends up doing the irreversible thing out of
    panic. */
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
  if (kind === "deactivated") {
    return (
      <StatementMark>
        <PauseCircle />
      </StatementMark>
    );
  }
  return (
    <StatementMark>
      <Hourglass />
    </StatementMark>
  );
}

/** The two kinds that can be ended from this screen, and the verb each one
    uses for the button that ends it. */
const RECOVERY: Partial<Record<Kind, { action: "cancel-deletion" | "reactivate"; label: string }>> = {
  deletion_pending: { action: "cancel-deletion", label: "Cancel deletion" },
  deactivated: { action: "reactivate", label: "Reactivate account" },
};

/** Only a decision someone else made can be argued with. A pause you took and
    a deletion you asked for are not decisions to appeal — they are things to
    undo, which this screen also offers. */
const APPEALABLE = new Set<Kind>(["banned", "suspended"]);

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
  /** Which inline flow is standing open. Both halves of the screen's advice —
      reactivate, appeal — are actions, so one at a time, and the one that is
      open is the one the reader asked for. */
  const [open, setOpen] = useState<"none" | "recover" | "appeal">("none");
  /** The account is back: the screen stops being an interruption and says so. */
  const [restored, setRestored] = useState(false);
  /** An appeal that has been filed stays filed — the desk takes one per
      decision, so the form is not offered a second time. */
  const [appealFiled, setAppealFiled] = useState(false);
  const flowRef = useRef<HTMLDivElement | null>(null);

  const copy = COPY[kind];
  const untilAt = until ? Date.parse(until) : null;
  const hasUntil = untilAt !== null && !Number.isNaN(untilAt);
  const recovery = RECOVERY[kind];
  const canAppeal = APPEALABLE.has(kind);

  useEffect(() => {
    trackEvent("auth.block_viewed", {
      detail: kind,
      metadata: { eventId: eventId ?? undefined },
    });
  }, [kind, eventId]);

  useEffect(() => {
    if (open === "none") return;
    // The action is at the bottom edge and the form belongs in the section you
    // were just reading, so follow it down rather than leaving a button that
    // appears to have done nothing.
    flowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open]);

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

  const daysLeft = hasUntil
    ? Math.max(0, Math.ceil((untilAt! - Date.now()) / 86_400_000))
    : null;

  /** Is something on this screen allowed to be the loud button? Once the appeal
      is filed, or a flow is standing open in the body, it isn't — and then
      "Back to sign in" takes the fill back rather than being the quiet second
      choice beside nothing. */
  const loudOpen = open === "none" && (!!recovery || (canAppeal && !appealFiled));

  return (
    <StatementScreen
      title={restored ? "Your account is back" : copy.title}
      lead={
        restored
          ? "You can sign in. The account is open again, exactly as it was."
          : copy.lead
      }
      meta={
        restored
          ? undefined
          : kind === "deletion_pending" && hasUntil
            ? `Final deletion on ${formatStamp(untilAt!)}${daysLeft != null ? ` · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left to cancel` : ""}`
            : hasUntil
              ? `${kind === "suspended" ? "Under review until" : "Until"} ${formatStamp(untilAt!)}`
              : undefined
      }
      mark={restored ? <RestoredMark /> : <Mark kind={kind} />}
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
          label: restored ? "What happens next" : "What you can do",
          body: (
            <>
              <Prose>
                {restored
                  ? "Sign in and the account opens where you left it. Nothing else changed, and nothing has to be put back."
                  : copy.next}
              </Prose>
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

              {/* The receipt outlives the form: an appeal can only be filed
                  once per decision, so a box that stays open beside a filed
                  one is an invitation to file a second. */}
              {appealFiled ? (
                <Prose className="text-fg">
                  <Check
                    className="mr-1.5 inline size-[15px] -translate-y-px text-success-text"
                    strokeWidth={2.6}
                    aria-hidden
                  />
                  Appeal filed — a reviewer will look at it.{" "}
                  {eventId ? (
                    <>
                      Reference <Value>{eventId}</Value>.
                    </>
                  ) : (
                    <>Quote the email address you sign in with and they’ll find it.</>
                  )}
                </Prose>
              ) : null}

              {/* The flow sits under the advice it is the doing of, rather than
                  in a popup over it: this is the same decision, continued. */}
              <div ref={flowRef}>
                {open === "recover" && recovery ? (
                  <ReactivateFlow
                    action={recovery.action}
                    onDone={() => {
                      setRestored(true);
                      setOpen("none");
                    }}
                    onBack={() => setOpen("none")}
                  />
                ) : null}
                {open === "appeal" ? (
                  <AppealFlow
                    eventId={eventId}
                    onFiled={() => {
                      setAppealFiled(true);
                      setOpen("none");
                    }}
                    onBack={() => setOpen("none")}
                  />
                ) : null}
              </div>
            </>
          ),
        },
      ]}
      actions={
        <>
          {restored ? (
            <PillButton label="Go to sign in" onClick={() => (window.location.href = "/login")} />
          ) : (
            <>
              {recovery && !restored && open === "none" ? (
                <PillButton
                  label={recovery.label}
                  onClick={() => {
                    haptic("medium");
                    setOpen("recover");
                  }}
                />
              ) : null}
              {canAppeal && !appealFiled && open === "none" ? (
                <PillButton
                  tone={recovery ? "outline" : "primary"}
                  label="Appeal this decision"
                  onClick={() => {
                    haptic("medium");
                    setOpen("appeal");
                  }}
                />
              ) : null}
              <PillButton
                tone={loudOpen ? "outline" : "primary"}
                label="Back to sign in"
                onClick={() => (window.location.href = "/login")}
              />
            </>
          )}
          {/* One loud thing, and the second choice as a word rather than a
              second button — same as the screens the gate puts up. The email
              carries the event reference so support lands on the exact record. */}
          <SupportPill
            subject={`Blocked account (${kind})${eventId ? ` — ref ${eventId}` : ""}`}
            label="Email support"
            lines={[
              `Event reference: ${eventId ?? "none"}`,
              `Account state: ${copy.title}`,
              reason ? `Reason recorded: ${reason}` : null,
              hasUntil ? `Until: ${formatStamp(untilAt!)}` : null,
            ]}
          />
        </>
      }
      foot="Where a fact wasn’t carried over — a reason, a date, a reference — this page says so rather than guessing."
    />
  );
}

/** The mark a restored account puts where the warning sign was. Calm on
    purpose: by this point the thing the screen was afraid of has been undone. */
function RestoredMark() {
  return (
    <StatementMark>
      <Check />
    </StatementMark>
  );
}

/* ── Coming back: email, code, account open ───────────────────────
   Two steps in one inline flow, because the account is closed and a cookie
   can't prove anything here. Step one mails a 6-digit code to the sign-in
   address; step two spends it. `POST /api/user/reactivate` is the one
   endpoint behind both — it reopens a paused account and calls off a
   scheduled deletion, which are the same write: status back to open.

   A wrong or spent code leaves the account exactly as it was, and the
   brain's own sentence says which of the two happened.                    */

const BLANK_CODE = ["", "", "", "", "", ""];

function ReactivateFlow({
  action,
  onDone,
  onBack,
}: {
  action: "cancel-deletion" | "reactivate";
  onDone: () => void;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(BLANK_CODE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The wait the account enforces between two codes. */
  const [againIn, setAgainIn] = useState(0);
  /** The account's own words for the code it just mailed — including the
      address it says it mailed it to, which this page cannot know otherwise. */
  const [sent, setSent] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    if (!againIn) return;
    const id = window.setTimeout(() => setAgainIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [againIn]);

  const looksLikeEmail = /.+@.+\..+/.test(email.trim());
  const codeFull = code.every((d) => d);

  async function sendCode() {
    if (busy || !looksLikeEmail) return;
    setBusy(true);
    setError(null);
    try {
      const reply = await apiRequestReactivationCode(email);
      if (!live.current) return;
      trackEvent("auth.reactivation_code_requested", { detail: action });
      haptic("success");
      setError(null);
      setSent(reply.message);
      setCode(BLANK_CODE);
      setAgainIn(30);
      setStage("code");
    } catch (err) {
      if (!live.current) return;
      haptic("error");
      trackError(`blocked.${action}.request`, err);
      setError(
        withRef(
          err instanceof Error && err.message ? err.message : "That code couldn’t be sent right now.",
          err,
        ),
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  async function confirm() {
    if (busy || !codeFull) return;
    setBusy(true);
    setError(null);
    try {
      await apiVerifyReactivationCode(email, code.join(""));
      if (!live.current) return;
      trackEvent("auth.account_reactivated_by_code", { detail: action });
      haptic("success");
      onDone();
    } catch (err) {
      if (!live.current) return;
      haptic("error");
      trackError(`blocked.${action}.verify`, err);
      setCode(BLANK_CODE);
      setError(
        withRef(
          err instanceof Error && err.message ? err.message : "That code wasn’t right, and nothing changed.",
          err,
        ),
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-full px-1 py-1 text-[13.5px] font-semibold text-muted transition-colors hover:bg-fill hover:text-fg"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        {stage === "email" ? "Back" : "Change the email address"}
      </button>

      <Group>
        {stage === "email" ? (
          <Field
            label="Your sign-in email"
            hint="The address the account is opened with. The code goes there and nowhere else."
            error={error ?? undefined}
          >
            <Input
              type="email"
              value={email}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendCode();
              }}
            />
          </Field>
        ) : (
          <Field
            label="The 6-digit code"
            hint={
              sent
                ? `${sent} Until the code is entered here, nothing about the account changes.`
                : `The code goes to ${email.trim()}. Until it is entered here, nothing about the account changes.`
            }
            error={error ?? undefined}
          >
            <div className="pt-1">
              <OtpInput value={code} onChange={setCode} />
            </div>
          </Field>
        )}
      </Group>

      <div className="mt-3 flex flex-col gap-2">
        {stage === "email" ? (
          <PillButton
            label={busy ? "Sending the code…" : "Email me a code"}
            disabled={!looksLikeEmail || busy}
            loading={busy}
            onClick={() => void sendCode()}
          />
        ) : (
          <>
            <PillButton
              label={busy ? "Checking the code…" : action === "reactivate" ? "Reactivate my account" : "Cancel the deletion"}
              disabled={!codeFull || busy}
              loading={busy}
              onClick={() => void confirm()}
            />
            <button
              type="button"
              disabled={againIn > 0 || busy}
              onClick={() => void sendCode()}
              className={
                againIn > 0 || busy
                  ? "min-h-11 rounded-full px-1 text-center text-[14px] font-semibold text-muted opacity-55"
                  : "min-h-11 rounded-full px-1 text-center text-[14px] font-semibold text-accent-text transition-colors hover:bg-fill"
              }
            >
              {againIn > 0 ? `Code already sent — try again in ${againIn}s` : "Send the code again"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Arguing with a decision ───────────────────────────────────────
   POST /api/support/appeal takes credentials as well as a cookie, and the
   proxy exempts it from the blocked-status gate for exactly this screen: the
   account is what is closed, so the email and the password prove the caller
   owns it. The note has to be 40–900 characters — the floor is the desk's,
   because a one-line "this is wrong" gives a reviewer nothing to look up.
   Once filed, the form collapses: an appeal can only be filed once per
   decision, and a second box beside a filed one is an invitation.           */

const NOTE_MIN = 40;
const NOTE_MAX = 900;

function AppealFlow({
  eventId,
  onFiled,
  onBack,
}: {
  eventId: string | null;
  onFiled: () => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const trimmed = note.trim();
  const short = trimmed.length < NOTE_MIN;
  const ready = /.+@.+\..+/.test(email.trim()) && password.length > 0 && !short;

  async function file() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      /* The event reference rides inside the note, so the appeal carries its
         own pointer to the record the decision was made on. */
      const fullNote = `${eventId ? `[ref ${eventId}] ` : ""}${trimmed}`.slice(0, NOTE_MAX);
      await appealWithCredentials({ email: email.trim(), password, note: fullNote });
      if (!live.current) return;
      trackEvent("auth.appeal_filed", {
        detail: eventId ?? undefined,
        metadata: { chars: trimmed.length },
      });
      haptic("success");
      /* The password never stays in the tree longer than the request that
         needed it, and the box closes itself — the receipt is the screen's to
         hold, not this form's, so it outlives the fields that made it. */
      setPassword("");
      setNote("");
      onFiled();
    } catch (err) {
      if (!live.current) return;
      haptic("error");
      trackError("blocked.appeal", err);
      setError(
        withRef(
          err instanceof Error && err.message ? err.message : "The appeal couldn’t be filed.",
          err,
        ),
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-full px-1 py-1 text-[13.5px] font-semibold text-muted transition-colors hover:bg-fill hover:text-fg"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back
      </button>

      <Group>
        <Field label="Your sign-in email" hint="The address on the account this decision was made about.">
          <Input
            type="email"
            value={email}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label="Your password"
          hint="Proves this is your account, since nothing else on it is open. It goes to the review desk and nowhere else."
        >
          <Input
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="Your password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field
          label="What you’re appealing"
          hint={
            short
              ? `${NOTE_MIN - trimmed.length} more characters before this reads as an answer rather than an objection.`
              : "Say what happened, in your own words — and what you think was misread. The event reference above travels with it."
          }
          action={
            <span className="text-[12px] tabular-nums text-muted">
              {trimmed.length}/{NOTE_MAX}
            </span>
          }
        >
          <Textarea
            value={note}
            maxLength={NOTE_MAX}
            rows={6}
            placeholder="What happened, in your own words — and what you think was misread."
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </Group>

      {error ? (
        <p role="alert" className="mt-2.5 px-1 text-[13.5px] leading-relaxed text-danger-text">
          {error}
        </p>
      ) : null}

      <div className="mt-3">
        <PillButton
          label={busy ? "Filing the appeal…" : "Send appeal"}
          disabled={!ready || busy}
          loading={busy}
          onClick={() => void file()}
        />
      </div>
    </div>
  );
}
