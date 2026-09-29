"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sheet, SheetActions } from "@/components/ig-ui";
import { trayGlyph } from "@/components/tray-icons";
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
} from "@/components/settings-shell";
import {
  KEEP_DAYS,
  type DeletedItem,
  daysLeft,
  findDeleted,
  removeFromTray,
} from "@/lib/your-activity";
import { ago, formatDate, formatTime } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   One deleted thing, with its clock

   Two ways out and nothing else: back where it was, or gone before the
   countdown finishes. It used to be a tile, a heading and a four-row table
   of label/value pairs — which said how long was left without ever saying
   what either button actually does, or what happens if you press neither.
   So it's a statement now, the way the other records are: the thing up top,
   then the three questions under hairlines, with the dates inside the
   sentences. The clock is still the loudest number on the page, because
   it's the only thing here that changes on its own.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeletedItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [item, setItem] = useState<DeletedItem | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setItem(findDeleted(params.id));
  }, [params.id]);

  if (item === undefined) return <PageSkeleton title="Recently deleted" sections={2} />;

  if (!item) {
    return (
      <SettingsPage title="Recently deleted">
        <Helper lead>
          Nothing left in the tray. It has either gone for good or been put back where it came from.
        </Helper>
        <PillStack>
          <PillButton label="Back to the tray" href="/settings/recently-deleted" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const row = item;
  const left = daysLeft(row);
  const purgeAt = row.deletedAt + KEEP_DAYS * 86_400_000;

  function takeOut(action: "restored" | "deleted") {
    removeFromTray(row.id);
    haptic(action === "restored" ? "success" : "heavy");
    toast.toggled(
      action === "restored" ? `${row.kind} restored` : `${row.kind} deleted for good`,
      action === "restored",
    );
    router.push("/settings/recently-deleted");
  }

  return (
    <SettingsPage>
      <StatementHead
        title={item.label}
        mark={<StatementMark danger={!left}>{trayGlyph(item.kind)}</StatementMark>}
        sub={`${item.kind} in the tray.`}
        meta={
          left
            ? `Deleted ${formatDate(item.deletedAt)} at ${formatTime(item.deletedAt)} · ${ago(item.deletedAt)}`
            : `Gone today, whether you act or not · deleted ${ago(item.deletedAt)}`
        }
      />

      <StatementBody>
        <StatementSection label="What this is">
          <Prose>
            A <Value>{item.kind.toLowerCase()}</Value> called <Value>{item.label}</Value>, deleted{" "}
            {ago(item.deletedAt)}. It still exists, and it still holds whatever was in it at the
            moment it went to the tray.
          </Prose>
        </StatementSection>

        <StatementSection label="How long it stays">
          <Prose>
            The tray keeps a deleted thing for <Value>{KEEP_DAYS} days</Value>. This one was deleted
            on <Value>{formatDate(item.deletedAt)}</Value>, so it leaves for good on{" "}
            <Value>{formatDate(purgeAt)}</Value> —{" "}
            {left ? (
              <>
                that is <Value>{left} {left === 1 ? "day" : "days"}</Value> from now.
              </>
            ) : (
              <>that is today.</>
            )}
          </Prose>
          <Prose>
            Doing nothing is one of the choices. Leave the page and the clock keeps running, and when
            it reaches zero the item goes on its own.
          </Prose>
        </StatementSection>

        <StatementSection label="The two ways out">
          <Prose>
            <Value>Restoring</Value> puts it back where it came from, with its history intact, and
            takes it off this page. <Value>Deleting for good</Value> skips the countdown and removes
            it now.
          </Prose>
          <Prose>
            Neither can be taken back afterwards — the {KEEP_DAYS} days are the undo, and once
            they&apos;re used up there&apos;s nothing left to restore, not even for support.
          </Prose>
        </StatementSection>
      </StatementBody>

      <PillStack>
        <PillButton
          label="Restore it"
          tone="primary"
          sub="Back where it was, with its history intact."
          onClick={() => takeOut("restored")}
        />
        <PillButton label="Delete for good" tone="danger" onClick={() => setConfirming(true)} />
        <PillButton label="Leave it in the tray" tone="outline" href="/settings/recently-deleted" />
      </PillStack>

      {/* The final one asks on its own surface, because it's the only button
          here that can't be answered for. */}
      {confirming ? (
        <Sheet
          title="Delete this for good?"
          description={`That skips the remaining ${left} ${left === 1 ? "day" : "days"}. Support can't recover it afterwards, and neither can you.`}
          onClose={() => setConfirming(false)}
          footer={
            <SheetActions
              cancelLabel="Leave it in the tray"
              onCancel={() => setConfirming(false)}
              confirmLabel="Delete for good"
              confirmVariant="danger"
              onConfirm={() => takeOut("deleted")}
            />
          }
        />
      ) : null}
    </SettingsPage>
  );
}
