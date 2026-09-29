"use client";

import { useEffect, useState } from "react";
import { Group, Helper, LinkRow, PageSkeleton, SettingsPage } from "@/components/settings-shell";
import {
  KEEP_DAYS,
  daysLeft,
  readDeleted,
  type DeletedItem,
} from "@/lib/your-activity";
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
        <p className="text-[14px] leading-relaxed text-muted">
          The tray is empty. Anything you delete lands here and waits out {KEEP_DAYS} days before it
          goes for good — while it&apos;s here you can put it back, and after that there&apos;s
          nothing left to restore, not even for support.
        </p>
      </SettingsPage>
    );
  }

  const soonest = Math.min(...items.map(daysLeft));

  return (
    <SettingsPage title="Recently deleted">
      <Helper lead>
        {items.length} {items.length === 1 ? "item" : "items"} can still be restored — the first of
        them leaves for good in {soonest} {soonest === 1 ? "day" : "days"}. Restoring puts a thing
        back where it came from; deleting it for good skips the countdown.
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
