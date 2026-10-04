"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sheet, SheetActions } from "@/components/ig-ui";
import { trayGlyph } from "@/components/tray-icons";
import { StatementHead, StatementMark } from "@/components/statement";
import {
  Group,
  Helper,
  PageSkeleton,
  PillButton,
  PillStack,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import {
  KEEP_DAYS,
  type DeletedItem,
  daysLeft,
  findDeleted,
  removeFromTray,
} from "@/lib/deleted-items";
import { ago, formatDate, formatTime } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   One deleted thing, with its clock — kept to the essentials.

   What it is, when it went in, when it leaves for good — one line each —
   then the two ways out: back where it was, or gone before the countdown
   finishes. The countdown is the only thing here that changes on its own.
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
        <Helper lead>Nothing left in the tray — it&apos;s gone for good or been restored.</Helper>
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
        meta={left ? `${left} ${left === 1 ? "day" : "days"} left` : "Gone today, whether you act or not"}
      />

      <Group>
        <StaticRow title="Type" sub={item.kind} />
        <StaticRow
          title="Deleted"
          sub={`${formatDate(item.deletedAt)} at ${formatTime(item.deletedAt)}`}
          right={ago(item.deletedAt)}
        />
        <StaticRow
          title="Removed for good"
          sub={formatDate(purgeAt)}
          right={left ? `${left} ${left === 1 ? "day" : "days"}` : "today"}
        />
      </Group>

      <Helper>
        Do nothing and it deletes itself on that date. After it&apos;s gone, support can&apos;t
        recover it either. This tray lives in this browser only — it isn&apos;t synced.
      </Helper>

      <PillStack>
        <PillButton
          label="Restore it"
          tone="primary"
          sub="Out of the tray, back where you left it."
          onClick={() => takeOut("restored")}
        />
        <PillButton label="Delete for good" tone="danger" onClick={() => setConfirming(true)} />
        <PillButton label="Leave it in the tray" tone="outline" href="/settings/recently-deleted" />
      </PillStack>

      {/* The final one asks on its own surface — it's the only button here
          that can't be answered for. */}
      {confirming ? (
        <Sheet
          title="Delete this for good?"
          description={`That skips the remaining ${left} ${left === 1 ? "day" : "days"}. It can't be undone.`}
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
