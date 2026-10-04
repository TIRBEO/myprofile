"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ig-ui";
import { changeIcon } from "@/components/activity-icons";
import { MapCard } from "@/components/map-card";
import { StatementHead, StatementMark } from "@/components/statement";
import { SignOutSheet } from "@/components/settings-layout";
import {
  Group,
  Helper,
  PageSkeleton,
  PillButton,
  PillStack,
  SettingsPage,
  SheetGroup,
  StaticRow,
} from "@/components/settings-shell";
import { answerChange, type ChangeEntry, type YouSaid, findChange } from "@/lib/activity-log";
import { placeFor } from "@/lib/places";
import { ago, formatDate, formatTime } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";
import { LoadFailed } from "@/components/page-loading";

/* ═══════════════════════════════════════════════════════════════════
   One change, in full — one short line per fact.

   What moved, on which machine, from where, when; then the same
   "was this you" answer as the sign-in record. The answer goes to the
   account, so it reads the same on every device. The log keeps which
   field moved, not the new value — one quiet line says so, and nothing
   else here.
   ═══════════════════════════════════════════════════════════════════ */

export default function ChangeDetailPage({ id }: { id: string }) {
  const [entry, setEntry] = useState<ChangeEntry | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  /** The sheet that asks "was this you" — open is not an answer. */
  const [asked, setAsked] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let live = true;
    setFailed(false);
    findChange(id)
      .then((found) => live && setEntry(found))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  const load = () => {
    setFailed(false);
    findChange(id).then(setEntry).catch(() => setFailed(true));
  };

  usePageRefresh(load);

  if (failed)
    return (
      <LoadFailed
        title="Change details"
        message="This change couldn't be read from the account. It hasn't been removed from your history — the account just didn't answer."
        onRetry={load}
      />
    );

  if (entry === undefined) return <PageSkeleton title="Change details" sections={2} />;

  if (!entry) {
    return (
      <SettingsPage title="Change details">
        <Helper lead>That change isn&apos;t in this account&apos;s history.</Helper>
        <PillStack>
          <PillButton label="Back to the log" href="/settings/activity-log" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const record = entry;
  const answer: YouSaid | null = record.youSaid ?? null;
  const place = record.location
    ? record.coords
      ? { location: record.location, coords: record.coords }
      : placeFor(record.location)
    : null;
  const touched = record.fields.length ? record.fields.join(", ") : "Not recorded";

  /** Send the answer, then show what the account has on file. */
  async function answerThis(next: YouSaid | null) {
    setSending(true);
    try {
      const updated = await answerChange(record.id, next);
      if (updated) setEntry(updated);
      return true;
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "The answer wasn’t saved");
      haptic("error");
      return false;
    } finally {
      setSending(false);
    }
  }

  /** Acknowledge only — nothing opened, nothing else moves. */
  async function recognise() {
    if (await answerThis("recognised")) {
      haptic("success");
      toast.success("Marked as reviewed");
    }
  }

  /** Ask, without answering for them. */
  function notMe() {
    setAsked(true);
    haptic("light");
  }

  /** "Yes, that's me" from the sheet — the change stands, nothing else. */
  async function answerYes() {
    setAsked(false);
    await recognise();
  }

  /** "No" from the sheet — the mark lands on the record first, and only then is
      the log-out offered. */
  async function answerNo() {
    setAsked(false);
    if (await answerThis("not-me")) {
      setConfirmSignOut(true);
      haptic("error");
      toast.error("Flagged — now log out the sessions you don't recognise");
    }
  }

  return (
    <SettingsPage>
      <StatementHead
        title={record.title}
        mark={<StatementMark danger={answer === "not-me"}>{changeIcon(record.kind)}</StatementMark>}
        meta={`${formatDate(record.at)} at ${formatTime(record.at)} · ${ago(record.at)}`}
      />

      <Group>
        <StaticRow title="What changed" sub={touched} />
        <StaticRow title="Device" sub={record.device} />
        <StaticRow title="Network address" sub={record.ip || "Not recorded"} />
        <StaticRow title="Location" sub={record.location || "Not recorded"} />
        <StaticRow
          title="When"
          sub={`${formatDate(record.at)} at ${formatTime(record.at)}`}
          right={ago(record.at)}
        />
      </Group>

      <Helper>The log keeps which field moved — not the value it was set to.</Helper>

      {place ? (
        <div className="mt-4">
          <MapCard coords={place.coords} label={record.location ?? ""} />
        </div>
      ) : null}

      {answer === "not-me" ? (
        <>
          <Helper tone="danger">
            You said this wasn&apos;t you{record.youSaidAt ? `, ${ago(record.youSaidAt)}` : ""}. Log
            out to end every other session, then change your password.
          </Helper>
          <PillStack>
            <PillButton
              label="Log out of Tirbeo"
              tone="danger"
              onClick={() => {
                haptic("heavy");
                setConfirmSignOut(true);
              }}
            />
            <PillButton
              label="Change my answer"
              tone="outline"
              disabled={sending}
              onClick={() => void answerThis(null)}
            />
          </PillStack>
        </>
      ) : answer === "recognised" ? (
        <>
          <Helper tone="ok">
            You confirmed this{record.youSaidAt ? `, ${ago(record.youSaidAt)}` : ""}.
          </Helper>
          <PillStack>
            <PillButton
              label="Change my answer"
              tone="outline"
              disabled={sending}
              onClick={() => void answerThis(null)}
            />
          </PillStack>
        </>
      ) : (
        <PillStack>
          <PillButton
            label="This was me"
            tone="primary"
            disabled={sending}
            onClick={recognise}
          />
          <PillButton label="That wasn't me" tone="danger" onClick={notMe} />
        </PillStack>
      )}

      {/* The question, asked on its own surface — with the record inside it. */}
      {asked ? (
        <Sheet
          title="Was this you?"
          description="The answer goes to the account, so it reads the same on every device."
          onClose={() => setAsked(false)}
          footer={
            <div className="flex flex-col gap-2">
              <PillButton
                label="Yes, that’s me"
                sub="Marks the change as checked. Nothing else about it moves."
                tone="primary"
                disabled={sending}
                onClick={answerYes}
              />
              <PillButton
                label="No, that wasn’t me"
                sub="Marks it in red and offers to close every other session on the account."
                tone="danger"
                disabled={sending}
                onClick={answerNo}
              />
              <PillButton label="Let me look again" tone="outline" onClick={() => setAsked(false)} />
            </div>
          }
        >
          <SheetGroup>
            <StaticRow
              title={record.title}
              sub={`${touched || "a change on the account"} · ${formatDate(record.at)} at ${formatTime(record.at)} · ${record.device}`}
            />
          </SheetGroup>
        </Sheet>
      ) : null}

      {confirmSignOut ? <SignOutSheet onClose={() => setConfirmSignOut(false)} /> : null}
    </SettingsPage>
  );
}
