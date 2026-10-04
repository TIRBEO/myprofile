"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sheet } from "@/components/ig-ui";
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
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";
import { LoadFailed } from "@/components/page-loading";

/* ═══════════════════════════════════════════════════════════════════
   One sign-in, in full — kept calm on purpose.

   The record behind a row in the log: what happened, on which machine,
   from where, when — one short line per fact — then the one decision that
   matters: was this you. The map shows itself when the record has coords.
   Answering is local; the log-out is a call to the account, gated by proof
   it's you. All behaviour is unchanged from the long-form version.
   ═══════════════════════════════════════════════════════════════════ */

export default function LoginEventDetailPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<ActivityEvent | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [confirmNotMe, setConfirmNotMe] = useState(false);
  /** How many sessions the "log out everywhere" button just ended, or 0. */
  const [signedOutAll, setSignedOutAll] = useState(0);
  const toast = useToast();
  const { guard, reauthDialog } = useReauthGuard();

  const load = () => {
    setFailed(false);
    findEvent(params.id).then(setEvent).catch(() => setFailed(true));
  };

  usePageRefresh(load);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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
  function thatWasMe() {
    const [next] = answerEvent(record.id, "me").filter((e) => e.id === record.id);
    setEvent(next);
    setConfirmNotMe(false);
    haptic("success");
    toast.success("Marked as reviewed");
  }

  /** Say it wasn't you. The mark lands on the record and lifts the log to red. */
  function notMeConfirmed() {
    const [next] = answerEvent(record.id, "not-me").filter((e) => e.id === record.id);
    setEvent(next);
    setConfirmNotMe(false);
    haptic("error");
    toast.error("Flagged — now log out the sessions you don't recognise");
  }

  /** Take the answer back, so the record goes into the log as unreviewed. */
  function changeAnswer() {
    const [next] = clearAnswer(record.id).filter((e) => e.id === record.id);
    setEvent(next);
    haptic("light");
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
    if (others) logSignOutEverywhere(others);
    if (answer === null)
      setEvent(answerEvent(record.id, "not-me").find((e) => e.id === record.id) ?? event);
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
            It came from the network address <Value>{record.ip}</Value>, which traces to{" "}
            <Value>{record.location}</Value>. A location read from an address names a city, not an
            exact place.
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

      {answer === null ? (
        <PillStack>
          <PillButton label="This was me" tone="primary" onClick={thatWasMe} />
          <PillButton label="That wasn't me" tone="danger" onClick={askWasThisYou} />
        </PillStack>
      ) : confirmed ? (
        <>
          <Helper tone="ok">
            You confirmed this{record.reviewedAt ? `, ${ago(record.reviewedAt)}` : ""}.
          </Helper>
          <PillStack>
            <PillButton label="Change my answer" tone="outline" onClick={changeAnswer} />
          </PillStack>
        </>
      ) : (
        <>
          <Helper tone="danger">
            {signedOutAll
              ? `Signed out of ${signedOutAll} other ${
                  signedOutAll === 1 ? "session" : "sessions"
                }. Change your password next.`
              : `You said this wasn't you${
                  record.reviewedAt ? `, ${ago(record.reviewedAt)}` : ""
                }. Log out of every other session, then change your password.`}
          </Helper>
          <PillStack>
            <PillButton
              label={signedOutAll ? "Logged out everywhere" : "Log out of all sessions"}
              tone="danger"
              disabled={signedOutAll > 0}
              onClick={signOutAll}
            />
            {signedOutAll ? (
              <PillButton label="Change your password" tone="primary" href="/settings/security" />
            ) : null}
            <PillButton label="Change my answer" tone="outline" onClick={changeAnswer} />
          </PillStack>
        </>
      )}

      {/* The question, asked on its own surface — with the record inside it. */}
      {confirmNotMe ? (
        <Sheet
          title="Was this you?"
          description="The answer is kept on this device — nothing is sent anywhere."
          onClose={() => setConfirmNotMe(false)}
          footer={
            <div className="flex flex-col gap-2">
              <PillButton
                label="Yes, that’s me"
                sub="Marks the entry as checked. Nothing about the session changes."
                tone="primary"
                onClick={thatWasMe}
              />
              <PillButton
                label="No, that wasn’t me"
                sub="Marks it in red and puts the log-out on the page beside this record."
                tone="danger"
                onClick={notMeConfirmed}
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
