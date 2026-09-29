"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/ig-ui";
import { Group, Helper, LinkRow, PageSkeleton, SettingsPage } from "@/components/settings-shell";
import {
  CHANGE_TITLE,
  MAX_ENTRIES,
  byDay,
  readChanges,
  type ChangeEntry,
} from "@/lib/activity-log";
import { ago, formatTime } from "@/lib/dates";

/* ═══════════════════════════════════════════════════════════════════
   Activity log — what changed on the account, and when

   A record, not a to-do list. Tapping a row doesn't open a popup: each
   change has a page of its own with the field, what it was, what it is
   now, the machine and network address it came in on and where that sits
   on a map. Everything is filed under the day it happened, newest first.

   A change the owner has answered "that wasn't me" to — on its own page,
   or on any other visit — reads red here: red title, and a filled disc
   with a ! at the end of the row. Anything else stays neutral.
   ═══════════════════════════════════════════════════════════════════ */

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ChangeEntry[] | null>(null);

  useEffect(() => {
    setEntries(readChanges());
  }, []);

  if (entries === null) return <PageSkeleton title="Activity log" sections={2} />;

  const days = byDay(entries);
  const disputed = entries.filter((entry) => entry.youSaid === "not-me").length;

  return (
    <SettingsPage title="Activity log">
      {/* Only a change you've said "not me" to is worth a banner. An unchecked
          log isn't an alarm — it's just a log you haven't read yet. */}
      {disputed ? (
        <Helper lead tone="danger">
          {disputed === 1
            ? "One change you said wasn’t yours. "
            : `${disputed} changes you said weren’t yours. `}
          Log out of every other session and set a new password before anything else.
        </Helper>
      ) : null}

      {days.length ? (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.day}>
              <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                {day.day}
              </h3>
              <Group>
                {day.entries.map((entry) => (
                  <LinkRow
                    key={entry.id}
                    href={`/settings/activity-log/${entry.id}`}
                    title={CHANGE_TITLE[entry.kind]}
                    sub={
                      entry.to
                        ? `${entry.field} · ${entry.to}`
                        : `${entry.field} — the value itself is not kept`
                    }
                    danger={entry.youSaid === "not-me"}
                    right={
                      <span className="flex items-center gap-2">
                        <span>{formatTime(entry.at)}</span>
                        {entry.youSaid ? <Answered entry={entry} /> : null}
                      </span>
                    }
                  />
                ))}
              </Group>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          The log is empty. Nothing has been changed on this account yet.
        </p>
      )}

      <Helper>
        Every entry names the field it touched, the value it took, and the device and network
        address the change arrived from. Only the {MAX_ENTRIES} most recent changes are kept, so an
        entry that has aged out can’t be recovered — open one while it’s still here if you need the
        detail. A row marked in red is one you said wasn’t yours; tap it to read the full record and
        log the rest of the sessions out.
      </Helper>
    </SettingsPage>
  );
}

/** The mark a change you've already answered carries. Nothing marks a change
    you haven't — a log that nagged about every unread row would be all badge. */
function Answered({ entry }: { entry: ChangeEntry }) {
  const disputed = entry.youSaid === "not-me";
  return (
    <span
      title={
        disputed
          ? `You said this wasn’t you${entry.youSaidAt ? ` · ${ago(entry.youSaidAt)}` : ""}`
          : `You said this was you${entry.youSaidAt ? ` · ${ago(entry.youSaidAt)}` : ""}`
      }
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-full",
        disputed ? "bg-danger text-white" : "bg-success/18 text-success-text",
      )}
    >
      {disputed ? (
        <span className="text-[12px] leading-none font-bold">!</span>
      ) : (
        <Check className="size-3" strokeWidth={3} />
      )}
    </span>
  );
}
