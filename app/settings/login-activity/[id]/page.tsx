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
import { readDevices, signOutOthers } from "@/lib/devices";
import { placeFor } from "@/lib/places";
import { ago, formatDate, formatTime } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   One sign-in, in full

   A row in the log is a line; this is the record behind it, written as the
   sentences a person reading it needs — what opened, from where, when, and
   then the one decision that matters: was this you. Saying it was leaves
   everything as it is — no mark, no navigation, nothing sent. Saying it
   wasn't flags the record, which lifts the log into its red state, and puts
   up a sheet that asks you to confirm it — with the option to log out of
   every session. Nothing here leaves the browser: no password is kept, and
   nothing is sent anywhere.
   ═══════════════════════════════════════════════════════════════════ */

export default function LoginEventDetailPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<ActivityEvent | null | undefined>(undefined);
  const [confirmNotMe, setConfirmNotMe] = useState(false);
  /** How many sessions the "log out everywhere" button just ended, or 0. */
  const [signedOutAll, setSignedOutAll] = useState(0);
  const toast = useToast();

  useEffect(() => {
    setEvent(findEvent(params.id));
  }, [params.id]);

  if (event === undefined) return <PageSkeleton title="Login activity" sections={2} />;

  if (!event) {
    return (
      <SettingsPage title="Login activity">
        <Helper lead>
          That event isn&apos;t in the log. The log keeps a limited number of events, so an old one
          may have aged out.
        </Helper>
        <PillStack>
          <PillButton label="Back to login activity" href="/settings/login-activity" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const record = event;
  const place = placeFor(record.location);
  /** The answer you gave, or null while the log is still asking. */
  const answer = record.review ?? null;
  const confirmed = answer === "me";
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  /** End every session but this one, here. The old route sent you to a picker
      and left the record still saying "not me" with nothing done about it.
      Pulling this trigger from the asking sheet settles the record too — you
      don't shut every other machine out on a sign-in you recognise. */
  function signOutAll() {
    const others = readDevices().filter((d) => !d.current).length;
    signOutOthers();
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
        meta={`${formatDate(record.at)} at ${formatTime(record.at)} · ${ago(record.at)}`}
      />

      <StatementBody>
        <StatementSection label="What happened">
          <Prose>
            {record.kind === "failed" ? (
              <>
                A sign-in was <Value>turned away</Value> after <Value>{record.method.toLowerCase()}</Value>
                . Nothing opened: no session started, and no data was reached.
              </>
            ) : record.kind === "signout" ? (
              <>
                This machine <Value>signed out</Value>, from the app or by closing the session
                somewhere else.
              </>
            ) : (
              <>
                The account <Value>{EVENT_TITLE[record.kind].toLowerCase()}</Value> on{" "}
                <Value>{record.device}</Value>, confirmed with{" "}
                <Value>{record.method.toLowerCase()}</Value>.
              </>
            )}
          </Prose>
        </StatementSection>

        <StatementSection label="Where it came from">
          <Prose>
            The request arrived on <Value>{record.ip}</Value>, which resolves to{" "}
            <Value>{record.location}</Value>.
          </Prose>
          <Prose>
            That is the town your network address resolves to, not the corner a device was standing
            in. Mobile carriers and VPNs hand out addresses from somewhere other than where the
            phone actually is, so a sign-in made from home can be drawn fifty kilometres away — and
            a traced city is never, on its own, proof of someone else.
          </Prose>
        </StatementSection>

        <StatementSection label="When">
          <Prose>
            <Value>{formatDate(record.at)}</Value> at <Value>{formatTime(record.at)}</Value>, which
            is {ago(record.at)}. Times are your own clock ({zone}), converted from the instant the
            record took it.
          </Prose>
        </StatementSection>

        {place ? (
          <StatementSection label="The place, on a map">
            <MapCard coords={place.coords} label={record.location} />
            <Prose>
              Pinned from the network address, which names a city rather than a place.
            </Prose>
          </StatementSection>
        ) : null}

        <StatementSection label="Was this you?">
          {confirmed ? (
            <Prose>
              You said this was you{record.reviewedAt ? `, ${ago(record.reviewedAt)}` : ""}. This
              entry is settled — the log stops asking, and it counts as checked. Nothing was sent
              anywhere and your password is never stored here.
            </Prose>
          ) : answer === "not-me" ? (
            <Prose className="text-danger-text">
              {signedOutAll
                ? `You ended ${signedOutAll} other ${
                    signedOutAll === 1 ? "session" : "sessions"
                  } from this screen — every one of them now needs your password to get back in. Change your password next, in case it was the password that was taken.`
                : "End every session on the account but this one, then change your password. This mark is kept on this device only — nothing was sent anywhere, and your password is never stored here."}
            </Prose>
          ) : (
            <Prose>
              Nothing here can tell the two of you apart, so the answer is the record. Say it was
              you and the entry stops asking; say it wasn&apos;t and the log turns red and puts the
              one action that helps beside it.
            </Prose>
          )}
        </StatementSection>
      </StatementBody>

      {answer === null ? (
        <PillStack>
          <PillButton label="This was me" tone="primary" onClick={thatWasMe} />
          <PillButton label="That wasn't me" tone="danger" onClick={askWasThisYou} />
        </PillStack>
      ) : confirmed ? (
        <PillStack>
          <PillButton label="Change my answer" tone="outline" onClick={changeAnswer} />
        </PillStack>
      ) : (
        <>
          <PillStack>
            <PillButton
              label={signedOutAll ? "Logged out everywhere" : "Log out of all sessions"}
              tone="danger"
              disabled={signedOutAll > 0}
              onClick={signOutAll}
            />
            {/* The second half of the fix, offered the moment the first half is
                done — closing sessions doesn't help if the password that
                opened them is still someone else's. */}
            {signedOutAll ? (
              <PillButton label="Change your password" tone="primary" href="/settings/security" />
            ) : null}
            <PillButton label="Change my answer" tone="outline" onClick={changeAnswer} />
          </PillStack>

          {signedOutAll ? (
            <Helper>
              Every session on the account is closed except the one you&apos;re reading this from.
              Each machine will need your password to get back in.
            </Helper>
          ) : null}
        </>
      )}

      {/* The question, asked on its own surface — with the record inside it, so
          you're answering something you can see, and with each answer saying
          what pressing it will do. The log-out lives on the page, not here:
          you don't shut every other machine out from inside a yes/no. */}
      {confirmNotMe ? (
        <Sheet
          title="Was this you?"
          description="Only you can answer this. The answer is kept on this device — nothing is sent anywhere, and your password is never stored here."
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
    </SettingsPage>
  );
}
