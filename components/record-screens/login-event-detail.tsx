"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Sheet, useAction } from "@/components/ig-ui";
import { EVENT_ICONS } from "@/components/event-icons";
import { MapCard } from "@/components/map-card";
import {
  Prose,
  StatementBody,
  StatementHead,
  StatementMark,
  StatementSection,
  Value,
} from "@/components/statement";
import {
  Helper,
  PageSkeleton,
  PillButton,
  PillStack,
  SettingsPage,
  SheetGroup,
  StaticRow,
} from "@/components/settings-shell";
import {
  EVENT_TITLE,
  type ActivityEvent,
  answerEvent,
  clearAnswer,
  findEvent,
  logSignOutEverywhere,
} from "@/lib/login-activity";
import { signOutOthers } from "@/lib/devices";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { placeFor } from "@/lib/places";
import { ago, formatDate, formatTime } from "@/lib/dates";
import { SupportPill } from "@/lib/support";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";
import { trackError, withRef } from "@/lib/telemetry";
import { usePageRefresh } from "@/lib/page-refresh";
import { LoadFailed } from "@/components/page-loading";

/* ═══════════════════════════════════════════════════════════════════
   One sign-in, in full — kept calm on purpose.

   The record behind a row in the log: what happened, on which machine,
   from where, when — one short line per fact — then the one decision that
   matters: was this you. The map shows itself when the record has coords.
   Answering is a call to the account, which keeps the answer on the
   account and tells the team when it isn't you; the log-out is gated by
   proof it's you.
   ═══════════════════════════════════════════════════════════════════ */

export default function LoginEventDetailPage({ id }: { id: string }) {
  const [event, setEvent] = useState<ActivityEvent | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [confirmNotMe, setConfirmNotMe] = useState(false);
  /** How many sessions the "log out everywhere" button just ended, or 0. */
  const [signedOutAll, setSignedOutAll] = useState(0);
  const toast = useToast();
  const { guard, reauthDialog } = useReauthGuard();
  /* One in-flight flag per decision, so the button the person actually
     pressed is the one that shows it's working — and can't be pressed twice. */
  const confirmMe = useAction();
  const confirmNot = useAction();
  const undoAnswer = useAction();
  const endSessions = useAction();

  const load = () => {
    setFailed(false);
    findEvent(id).then(setEvent).catch(() => setFailed(true));
  };

  usePageRefresh(load);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (failed)
    return (
      <LoadFailed
        title="Login activity"
        message="This sign-in couldn't be read from the account. It hasn't been removed from your history — the account just didn't answer."
        onRetry={load}
      />
    );

  if (event === undefined) return <PageSkeleton title="Login activity" sections={2} />;

  if (!event) {
    return (
      <SettingsPage title="Login activity">
        <Helper lead>That event isn&apos;t in the log — old entries age out.</Helper>
        <PillStack>
          <PillButton label="Back to login activity" href="/settings/login-activity" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const record = event;
  const place = record.coords
    ? { location: record.location, coords: record.coords }
    : placeFor(record.location);
  /** The answer you gave, or null while the log is still asking. */
  const answer = record.review ?? null;
  const confirmed = answer === "me";

  const whatHappened =
    record.kind === "failed"
      ? `Sign-in blocked after ${record.method.toLowerCase()}`
      : record.kind === "signout"
        ? "This machine signed out"
        : EVENT_TITLE[record.kind];

  /** Say it was you. The record stops asking, here and in the log. */
  async function thatWasMe() {
    try {
      const [next] = (await answerEvent(record.id, "me")).filter((e) => e.id === record.id);
      setEvent(next);
      setConfirmNotMe(false);
      haptic("success");
      toast.success("Marked as reviewed");
    } catch (err) {
      haptic("error");
      trackError("login-event.answer-me", err);
      toast.error(
        withRef(
          err instanceof Error && err.message ? err.message : "Couldn’t record your answer — nothing was saved.",
          err,
        ),
      );
    }
  }

  /** Say it wasn't you. The mark lands on the record and lifts the log to red. */
  async function notMeConfirmed() {
    try {
      const [next] = (await answerEvent(record.id, "not-me")).filter((e) => e.id === record.id);
      setEvent(next);
      setConfirmNotMe(false);
      haptic("error");
      toast.error("Flagged — now log out the sessions you don't recognise");
    } catch (err) {
      haptic("error");
      trackError("login-event.answer-not-me", err);
      toast.error(
        withRef(
          err instanceof Error && err.message ? err.message : "Couldn’t flag this sign-in — nothing was saved.",
          err,
        ),
      );
    }
  }

  /** Take the answer back, so the record goes into the log as unreviewed. */
  async function changeAnswer() {
    try {
      const [next] = (await clearAnswer(record.id)).filter((e) => e.id === record.id);
      setEvent(next);
      haptic("light");
    } catch (err) {
      haptic("error");
      trackError("login-event.clear-answer", err);
      toast.error(
        withRef(
          err instanceof Error && err.message ? err.message : "Couldn’t clear your answer.",
          err,
        ),
      );
    }
  }

  /** End every session but this one, here. */
  async function signOutAll() {
    let others: number;
    try {
      others = await guard((proof) => signOutOthers(proof));
    } catch (err) {
      if (wasDeclined(err)) return;
      haptic("error");
      toast.error(err instanceof Error && err.message ? err.message : "No sessions were ended.");
      return;
    }
    await logSignOutEverywhere();
    if (answer === null)
      setEvent((await answerEvent(record.id, "not-me")).find((e) => e.id === record.id) ?? event);
    setConfirmNotMe(false);
    haptic("success");
    toast.success(
      others
        ? `Signed out of ${others} other ${others === 1 ? "session" : "sessions"}`
        : "No other session was open",
    );
    setSignedOutAll(others);
  }

  /** Ask, without answering for them. */
  function askWasThisYou() {
    setConfirmNotMe(true);
    haptic("light");
  }

  return (
    <SettingsPage>
      <StatementHead
        title={EVENT_TITLE[record.kind]}
        mark={
          <StatementMark danger={record.review === "not-me" || record.kind === "failed"}>
            {EVENT_ICONS[record.kind]}
          </StatementMark>
        }
        sub={record.current ? "This machine, right now." : "A sign-in on this account."}
      />

      <StatementBody>
        <StatementSection label="What happened">
          <Prose>
            <Value>{whatHappened}</Value> on a <Value>{record.device}</Value>, signing in with{" "}
            <Value>{record.method.toLowerCase()}</Value>.
          </Prose>
        </StatementSection>

        <StatementSection label="Where and when">
          <Prose>
            {place ? (
              <>
                It came from the network address <Value>{record.ip || "not recorded"}</Value>, which
                traces to <Value>{record.location}</Value>. A location read from an address names a
                city, not an exact place.
              </>
            ) : (
              <>
                It came from the network address{" "}
                <Value>{record.ip || "not recorded"}</Value>. The account never saw a place behind
                that address, so this record honestly has none — the request reached the service
                without an address a front door had resolved.
              </>
            )}
          </Prose>
          <Prose>
            It happened on <Value>{formatDate(record.at)}</Value> at{" "}
            <Value>{formatTime(record.at)}</Value> — <Value>{ago(record.at)}</Value>.
          </Prose>
        </StatementSection>
      </StatementBody>

      {place ? (
        <div className="mt-6">
          <MapCard coords={place.coords} label={record.location} />
        </div>
      ) : null}

      {/* ── The decision ───────────────────────────────────────────
          No plate behind it — the question, its answers and the
          record's paperwork read fine on the page itself; a card here
          just boxes the eye in. */}
      <section className="mt-8">
        <h2 className="text-[17px] leading-snug font-semibold tracking-[-0.01em]">
          {answer === null ? "Was this you?" : confirmed ? "You confirmed this sign-in" : "You said this wasn’t you"}
        </h2>
        <p className="mt-1 max-w-[58ch] text-[13.5px] leading-relaxed text-muted">
          {answer === null
            ? "Your answer goes to the account, which keeps it and dates it. Say it wasn’t you and the team is told."
            : confirmed
              ? record.reviewedAt
                ? `Marked as reviewed ${ago(record.reviewedAt)}. The session itself was left alone.`
                : "Marked as reviewed. The session itself was left alone."
              : signedOutAll
                ? `Signed out of ${signedOutAll} other ${signedOutAll === 1 ? "session" : "sessions"}. Changing your password is the step that finishes it.`
                : `Log out of every other session, then change your password.${record.reviewedAt ? ` You said this ${ago(record.reviewedAt)}.` : ""}`}
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {answer === null ? (
            <>
              <Button
                variant="primary"
                loading={confirmMe.pending}
                onClick={() => confirmMe.run(thatWasMe)}
              >
                This was me
              </Button>
              <Button variant="danger" onClick={askWasThisYou}>
                That wasn’t me
              </Button>
            </>
          ) : confirmed ? (
            <Button
              variant="secondary"
              loading={undoAnswer.pending}
              onClick={() => undoAnswer.run(changeAnswer)}
            >
              Change my answer
            </Button>
          ) : (
            <>
              <Button
                variant="danger"
                disabled={signedOutAll > 0}
                loading={endSessions.pending}
                onClick={() => endSessions.run(signOutAll)}
              >
                {signedOutAll ? "Logged out everywhere" : "Log out of all sessions"}
              </Button>
              {signedOutAll ? (
                <Link href="/settings/security" className="btn btn-primary">
                  Change your password
                </Link>
              ) : null}
              <Button
                variant="ghost"
                loading={undoAnswer.pending}
                onClick={() => undoAnswer.run(changeAnswer)}
              >
                Change my answer
              </Button>
            </>
          )}
        </div>

        <div className="mt-5 border-t border-divider pt-4">
          <p className="text-center text-[12px] text-muted">
            Event reference <code className="font-mono">{record.ref ?? record.id}</code>
          </p>
          <div className="mt-3">
            <SupportPill
              subject={`Question about a sign-in — event ${record.ref ?? record.id}`}
              lines={[
                `Event reference: ${record.ref ?? record.id}`,
                `Record id: ${record.id}`,
                `What: ${whatHappened}`,
                `Device: ${record.device}`,
                `Method: ${record.method}`,
                `IP: ${record.ip} · Location: ${record.location}`,
                `When: ${formatDate(record.at)} at ${formatTime(record.at)}`,
              ]}
            />
          </div>
        </div>
      </section>

      {/* The question, asked on its own surface — with the record inside it. */}
      {confirmNotMe ? (
        <Sheet
          title="Was this you?"
          description="Your answer goes to the account, which keeps it and dates it. Say it wasn't you and the team is told."
          onClose={() => setConfirmNotMe(false)}
          footer={
            <div className="flex flex-col gap-2">
              <PillButton
                label="Yes, that’s me"
                sub="Marks the entry as checked. Nothing about the session changes."
                tone="primary"
                loading={confirmMe.pending}
                onClick={() => confirmMe.run(thatWasMe)}
              />
               <PillButton
                label="No, that wasn’t me"
                sub="Marks it in red, tells the team, and puts the log-out on the page beside this record."
                tone="danger"
                loading={confirmNot.pending}
                onClick={() => confirmNot.run(notMeConfirmed)}
              />
              <PillButton label="Let me look again" tone="outline" onClick={() => setConfirmNotMe(false)} />
            </div>
          }
        >
          <SheetGroup>
            <StaticRow
              title={EVENT_TITLE[record.kind]}
              sub={`${record.device} · ${record.location} · ${formatDate(record.at)} at ${formatTime(record.at)}`}
            />
          </SheetGroup>
        </Sheet>
      ) : null}

      {reauthDialog}
    </SettingsPage>
  );
}
