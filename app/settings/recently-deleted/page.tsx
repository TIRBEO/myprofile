"use client";

import { useEffect, useState } from "react";
import { Group, Helper, LinkRow, PageSkeleton, SettingsPage, StaticRow } from "@/components/settings-shell";
import {
  KEEP_DAYS,
  daysLeft,
  readDeleted,
  type DeletedItem,
} from "@/lib/deleted-items";
import { ago } from "@/lib/dates";

/* ═══════════════════════════════════════════════════════════════════
   Recently deleted

   A waiting room, not a graveyard: everything on this page still exists
   and still has its clock running. The count and the shortest clock are
   said up front, because that's the question people arrive with — how
   long before this is really gone. Then one column, newest first, each
   row saying what it is and how long ago it went in. A row opens its own
   page, where the two ways out (back, or gone) are the whole screen.

   The rows carry no glyph: the kind is already the first word of the line
   under the title, so the picture said what the sentence had just said.

   Honest about what it is: Tirbeo holds no notes, albums or files of
   yours, so there is nothing server-side a deletion could have removed and
   nothing a restore could bring back. Until a content model exists, this
   tray is a stand-in kept in this browser, and the page says so instead of
   implying the account keeps a recovery shelf it doesn't have.
   ═══════════════════════════════════════════════════════════════════ */

export default function RecentlyDeletedPage() {
  const [items, setItems] = useState<DeletedItem[] | null>(null);

  useEffect(() => {
    setItems(readDeleted());
  }, []);

  if (items === null) return <PageSkeleton title="Recently deleted" sections={2} />;

  if (!items.length) {
    return (
      <SettingsPage title="Recently deleted">
        <Group>
          <StaticRow
            title="Nothing has been deleted"
            sub={`Anything you delete lands here and waits out ${KEEP_DAYS} days before it goes for good — while it's here you can put it back.`}
          />
        </Group>
        <Helper className="mt-4">
          Tirbeo doesn&apos;t hold notes, files or albums of yours yet, and this tray is kept in
          this browser — another device will not see what you delete here.
        </Helper>
      </SettingsPage>
    );
  }

  const soonest = Math.min(...items.map(daysLeft));

  return (
    <SettingsPage title="Recently deleted">
      <Helper lead>
        {items.length} {items.length === 1 ? "item" : "items"} in the tray, the first of them gone
        for good in {soonest} {soonest === 1 ? "day" : "days"}. Restoring puts a thing back where it
        came from; deleting it for good skips the countdown.
      </Helper>

      <Helper className="mt-4">
        These rows are kept in this browser, not on the account — Tirbeo holds no content of yours
        yet, so there&apos;s nothing server-side a restore could bring back. Another device, or a
        cleared browser, will not see this tray.
      </Helper>

      {/* One list rather than a section per day: the tray holds few enough
          things that a heading above each one made boxes out of rows, and the
          row already says when it was deleted. */}
      <div className="mt-5">
        <Group>
          {items.map((item) => {
            const left = daysLeft(item);
            return (
              <LinkRow
                key={item.id}
                href={`/settings/recently-deleted/${item.id}`}
                title={item.label}
                sub={`${item.kind} · deleted ${ago(item.deletedAt)}`}
                right={left ? `${left} ${left === 1 ? "day" : "days"}` : "Gone today"}
              />
            );
          })}
        </Group>
      </div>
    </SettingsPage>
  );
}
