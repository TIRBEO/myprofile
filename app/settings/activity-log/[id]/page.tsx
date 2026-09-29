"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sheet } from "@/components/ig-ui";
import { CHANGE_ICONS } from "@/components/activity-icons";
import { MapCard } from "@/components/map-card";
import {
  Prose,
  StatementBody,
  StatementHead,
  StatementMark,
  StatementSection,
  Value,
} from "@/components/statement";
import { SignOutSheet } from "@/components/settings-layout";
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
  CHANGE_TITLE,
  type ChangeEntry,
  type YouSaid,
  findChange,
  setYouSaid,
} from "@/lib/activity-log";
import { placeFor } from "@/lib/places";
import { ago, formatDate, formatTime } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   One change, in full

   The log gives you a line; this is the record behind it, written as
   sentences under the three questions anyone staring at it actually has: what
   moved, what it moved from, when it happened. The answer at the bottom works
   the same way as the sign-in record — "this was me" only marks the entry
   recognised, "that wasn't me" turns the page red and asks whether to log out.
   This log has no server, so the answer is written onto the record itself in
   localStorage on this device — the list marks any entry answered against in
   red because of it.
   ═══════════════════════════════════════════════════════════════════ */

export default function ChangeDetailPage() {
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ChangeEntry | null | undefined>(undefined);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  /** The sheet that asks "was this you" — open is not an answer. */
  const [asked, setAsked] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setEntry(findChange(params.id));
  }, [params.id]);

  if (entry === undefined) return <PageSkeleton title="Change details" sections={2} />;

  if (!entry) {
    return (
      <SettingsPage title="Change details">
        <Helper lead>
          That entry isn&apos;t in the log. Only the most recent changes are kept, so an old one may
          have aged out.
        </Helper>
        <PillStack>
          <PillButton label="Back to the log" href="/settings/activity-log" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const record = entry;
  const answer: YouSaid | null = record.youSaid ?? null;
  const place = placeFor(record.location);
  const kept = Boolean(record.from || record.to);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /** Write the answer onto the record, then update what's on screen from the
      store rather than from what we think we just wrote — the list reads the
      same record, so the mark has to be the same mark. */
  function answerThis(next: YouSaid | null) {
    const updated = setYouSaid(record.id, next);
    if (updated) setEntry(updated);
  }

  /** Acknowledge only — no navigation, nothing opened, nothing sent. */
  function recognise() {
    answerThis("recognised");
    haptic("success");
    toast.success("Marked as reviewed");
  }

  /** Ask, without answering for them. */
  function notMe() {
    setAsked(true);
    haptic("light");
  }

  /** "Yes, that's me" from the sheet — the change stands, nothing else. */
  function answerYes() {
    recognise();
    setAsked(false);
  }

  /** "No" from the sheet — the mark lands now, and the log-out is offered. */
  function answerNo() {
    answerThis("not-me");
    setAsked(false);
    setConfirmSignOut(true);
    haptic("error");
    toast.error("Flagged — now log out the sessions you don't recognise");
  }

  return (
    <SettingsPage>
      <StatementHead
        title={CHANGE_TITLE[record.kind]}
        mark={
          <StatementMark danger={answer === "not-me"}>
            {CHANGE_ICONS[record.kind]}
          </StatementMark>
        }
        meta={`${formatDate(record.at)} at ${formatTime(record.at)} · ${ago(record.at)}`}
      />

      <StatementBody>
        <StatementSection label="What changed">
          {kept ? (
            <>
              <Prose>
                <Value>{record.field}</Value> was <Value>{record.from || "nothing at all"}</Value>
                {" and is now "}
                <Value>{record.to || "cleared"}</Value>.
              </Prose>
              <Prose>
                Only those two values are kept on the record. The change itself can&apos;t be
                undone from here — the page it belongs to is the one that would have to be opened
                again.
              </Prose>
            </>
          ) : (
            <Prose>
              A new password was set. Neither the old one nor the new one is written down anywhere
              in this log, before or after the change — the record holds only that it happened, on
              which machine and when.
            </Prose>
          )}
        </StatementSection>

        <StatementSection label="Where it came from">
          <Prose>
            The change was made from <Value>{record.device}</Value>, coming in on{" "}
            <Value>{record.ip}</Value>, which resolves to <Value>{record.location}</Value>.
          </Prose>
          <Prose>
            That town is the city the network address resolves to, not where the device was
            standing. Nothing on the machine was asked where it was, so a change made at home can
            be drawn across town — or further — if the traffic left through another city on a
            mobile network or a VPN.
          </Prose>
        </StatementSection>

        <StatementSection label="When it happened">
          <Prose>
            <Value>{formatDate(record.at)}</Value> at <Value>{formatTime(record.at)}</Value>,
            which is {ago(record.at)}. Times here are your own clock ({zone}), converted from the
            instant the record took it.
          </Prose>
        </StatementSection>

        {place ? (
          <StatementSection label="The place, on a map">
            <MapCard coords={place.coords} label={record.location} />
            <Prose>
              Pinned from the network address the change came in on, which is the only place this
              record can point at.
            </Prose>
          </StatementSection>
        ) : null}

        <StatementSection label="Was this you?">
          {answer === "not-me" ? (
            <Prose className="text-danger-text">
              You said it wasn&apos;t you. Log out to end this session and every other one on the
              account, then change your password. This mark is kept on this device only — nothing
              was sent anywhere, and your password is never stored here.
            </Prose>
          ) : answer === "recognised" ? (
            <Prose>
              You said this was you{record.youSaidAt ? `, ${ago(record.youSaidAt)}` : ""}. The entry
              is settled — the log stops asking, and it counts as checked. Nothing was sent
              anywhere and your password is never stored here.
            </Prose>
          ) : (
            <Prose>
              Nothing on this page can tell the two of you apart, so the answer is the record. Say
              it was you and the entry stops asking; say it wasn&apos;t and the log turns red and
              offers to close every other session on the account.
            </Prose>
          )}
        </StatementSection>
      </StatementBody>

      {answer === "not-me" ? (
        <PillStack>
          <PillButton
            label="Log out of Tirbeo"
            tone="danger"
            onClick={() => {
              haptic("heavy");
              setConfirmSignOut(true);
            }}
          />
          <PillButton label="Change my answer" tone="outline" onClick={() => answerThis(null)} />
        </PillStack>
      ) : answer === "recognised" ? (
        <PillStack>
          <PillButton label="Change my answer" tone="outline" onClick={() => answerThis(null)} />
        </PillStack>
      ) : (
        <PillStack>
          <PillButton label="This was me" tone="primary" onClick={recognise} />
          <PillButton label="That wasn't me" tone="danger" onClick={notMe} />
        </PillStack>
      )}

      {/* The question, asked on its own surface — with the thing being asked
          about inside it, so you never answer a sentence you had to scroll up
          to read, and with each answer saying what pressing it will do. */}
      {asked ? (
        <Sheet
          title="Was this you?"
          description="Only you can answer this. The answer is kept on this device — nothing is sent anywhere, and your password is never stored here."
          onClose={() => setAsked(false)}
          footer={
            <div className="flex flex-col gap-2">
              <PillButton
                label="Yes, that’s me"
                sub="Marks the change as checked. Nothing else about it moves."
                tone="primary"
                onClick={answerYes}
              />
              <PillButton
                label="No, that wasn’t me"
                sub="Marks it in red and offers to close every other session on the account."
                tone="danger"
                onClick={answerNo}
              />
              <PillButton label="Let me look again" tone="outline" onClick={() => setAsked(false)} />
            </div>
          }
        >
          <SheetGroup>
            <StaticRow
              title={CHANGE_TITLE[record.kind]}
              sub={`${record.field} · ${formatDate(record.at)} at ${formatTime(record.at)} · ${record.device}`}
            />
          </SheetGroup>
        </Sheet>
      ) : null}

      {confirmSignOut ? <SignOutSheet onClose={() => setConfirmSignOut(false)} /> : null}
    </SettingsPage>
  );
}
