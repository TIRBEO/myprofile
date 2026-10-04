"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/components/ig-ui";
import {
  Group,
  Helper,
  LIVE,
  PageSkeleton,
  ROW,
  SettingsPage,
  SUB,
  TITLE,
} from "@/components/settings-shell";
import { type ActivityEvent, byDay, readEvents } from "@/lib/login-activity";
import { ago, formatTime } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import { LoadFailed } from "@/components/page-loading";

/* ═══════════════════════════════════════════════════════════════════
   Login activity

   A list like every other list in here: one row per sign-in, the day written
   above the run of rows it falls in, hairlines between them. It used to be a
   timeline — a rail down the left with a ringed glyph on every event — and
   the glyphs said "signed in", "signed out", "password changed" in a picture
   the sentence beside them had already said in words.

   A blocked sign-in, or one you said wasn't you, reads red. An answered
   entry carries a tick or a mark at the end of its line; an unanswered one
   carries nothing, because a log you haven't finished reading isn't an alarm.
   ═══════════════════════════════════════════════════════════════════ */

/* The full wording lives on the record itself. This line has room for the
   short name of what happened, the town it came from and the machine — and
   the time on the right, where a value lines up down the column. */
const SHORT: Record<ActivityEvent["kind"], string> = {
  signin: "Signed in",
  signout: "Signed out",
  failed: "Blocked sign-in",
  password: "Password changed",
  "two-factor": "Two-factor on",
  passkey: "Passkey added",
};

function town(place: string) {
  return place.split(",")[0];
}

export default function LoginActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    readEvents()
      .then(setEvents)
      .catch(() => setFailed(true));
  };

  usePageRefresh(load);

  useEffect(() => {
    load();
  }, []);

  if (failed)
    return (
      <LoadFailed
        title="Login activity"
        message="The sign-in history couldn't be read from the account. Nothing has been deleted — the account just didn't answer."
        onRetry={load}
      />
    );

  if (events === null) return <PageSkeleton title="Login activity" />;

  const days = byDay(events);
  const disputed = events.filter((event) => event.review === "not-me").length;

  return (
    <SettingsPage title="Login activity">
      {/* Only a sign-in you've said wasn't yours is worth a banner. */}
      {disputed ? (
        <Helper lead tone="danger">
          {disputed === 1
            ? "One sign-in you said wasn’t yours. "
            : `${disputed} sign-ins you said weren’t yours. `}
          Log out of the sessions you don’t recognise, then set a new password.
        </Helper>
      ) : null}

      {days.length ? (
        <div className="mt-5 flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.label}>
              <h3 className="mb-2.5 px-1 text-[11.5px] font-semibold tracking-[0.09em] text-muted uppercase">
                {day.label}
              </h3>
              <Group>
                {day.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </Group>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          Nothing has been logged yet. New sign-ins will appear here.
        </p>
      )}

      <Helper className="mt-8">
        Locations are traced from network addresses — they name a city, not a place.
      </Helper>
    </SettingsPage>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const red = event.kind === "failed" || event.review === "not-me";
  return (
    <Link
      href={`/settings/login-activity/${event.id}`}
      onClick={() => haptic("light")}
      className={cn(ROW, LIVE, "items-start")}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn(TITLE, red && "text-danger-text")}>{SHORT[event.kind]}</span>
          {event.current ? (
            <span className="rounded-full bg-surface-3 px-2 py-[3px] text-[10.5px] font-semibold tracking-[0.04em] text-muted uppercase">
              This device
            </span>
          ) : null}
        </span>
        <span className={SUB}>
          {town(event.location)} · {event.device}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-1">
        <span className="text-[12.5px] tabular-nums text-muted">{formatTime(event.at)}</span>
        {event.review ? <Answered event={event} red={red} /> : null}
      </span>
    </Link>
  );
}

/** The mark an answered entry carries, and what it says when a cursor rests on
    it. Unanswered rows carry nothing at all. */
function Answered({ event, red }: { event: ActivityEvent; red: boolean }) {
  const when = event.reviewedAt ? ` · ${ago(event.reviewedAt)}` : "";
  return (
    <span
      title={red ? `You said this wasn’t you${when}` : `You said this was you${when}`}
      className={cn(
        "grid size-[18px] place-items-center rounded-full",
        red ? "bg-danger text-white" : "bg-success/18 text-success-text",
      )}
    >
      {red ? (
        <span className="text-[12px] leading-none font-bold">!</span>
      ) : (
        <Check className="size-3" strokeWidth={3} />
      )}
    </span>
  );
}
