"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { cn } from "@/components/ig-ui";
import { Group, Helper, LinkRow, PageSkeleton, SettingsPage } from "@/components/settings-shell";
import { LoadFailed } from "@/components/page-loading";
import {
  PAGE,
  byDay,
  readChanges,
  type ChangeEntry,
} from "@/lib/activity-log";
import { ago, formatTime } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Activity log — what changed on the account, and when

   A record, not a to-do list. Tapping a row doesn't open a popup: each
   change has a page of its own with the field it touched, the machine and
   network address it came in on and where that sits on a map. Everything is
   filed under the day it happened, newest first.

   A change the owner has answered "that wasn't me" to — here, or from any
   other device — reads red: red title, and a filled disc with a ! at the end
   of the row. That mark comes back from the server with the record, so it is
   the same on every visit rather than only on the machine it was given on.
   Anything else stays neutral: an unchecked log isn't an alarm, it's a log
   you haven't read yet.
   ═══════════════════════════════════════════════════════════════════ */

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ChangeEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const load = useCallback((howMany: number) => {
    setEntries(null);
    setFailed(false);
    readChanges(howMany)
      .then(setEntries)
      .catch(() => setFailed(true));
  }, []);

  usePageRefresh(() => load(limit));

  useEffect(() => {
    load(limit);
  }, [limit, load]);

  if (failed)
    return (
      <LoadFailed
        title="Activity log"
        message="The history couldn't be read from the account. Nothing has been lost — the account just didn't answer. Try again."
        onRetry={() => load(limit)}
      />
    );

  if (entries === null) return <PageSkeleton title="Activity log" sections={2} />;

  const days = byDay(entries);
  const disputed = entries.filter((entry) => entry.youSaid === "not-me").length;

  return (
    <SettingsPage title="Activity log">
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
                    title={entry.title}
                    sub={
                      entry.fields.length
                        ? entry.fields.join(", ")
                        : "the record holds that it happened, not what it was set to"
                    }
                    danger={entry.youSaid === "not-me"}
                    right={
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="flex items-center gap-2">
                          <span>{formatTime(entry.at)}</span>
                          {entry.youSaid ? <Answered entry={entry} /> : null}
                        </span>
                        {/* The place sits under the time, the way a post's location
                            sits under its photo — and only when the record has one. */}
                        {entry.location ? <Place name={entry.location} /> : null}
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
          The log is empty. The first change you make will appear here.
        </p>
      )}

      {/* The log has no expiry, so the only thing that limits how far back this
          reaches is how much the page has asked for. */}
      {entries.length === limit ? (
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setLimit((current) => current + PAGE);
          }}
          className="mt-6 min-h-10 text-[13.5px] font-medium text-link underline underline-offset-2"
        >
          Show {PAGE} earlier changes
        </button>
      ) : null}

      <Helper className="mt-6">
        The log shows which field changed, not the value it was set to. Sign-ins have their own{" "}
        <Link href="/settings/login-activity" className="font-medium text-link underline underline-offset-2">
          page
        </Link>
        .
      </Helper>
    </SettingsPage>
  );
}

/** The place on the row. Kept to one short line: a town is long enough, and
    the full sentence — address, device, map — is on the change's own page. */
function Place({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="flex max-w-[128px] items-center gap-1 text-[11px] leading-none text-muted"
    >
      <MapPin className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The mark a change you've already answered carries. Nothing marks a change
    you haven't. */
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
