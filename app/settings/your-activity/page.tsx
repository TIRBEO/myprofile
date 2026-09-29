"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bars, Trend, TrendAll, useCountUp, type ChartPoint, type ChartSeries } from "@/components/charts";
import { cn } from "@/components/ig-ui";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import {
  ACTIVITIES,
  KEEP_DAYS,
  TREND_DAYS,
  WEEK_DAYS,
  activityByDay,
  activityTotal,
  busiestDay,
  formatDuration,
  lastDays,
  readFigures,
  weekMinutes,
  type ActivityKey,
  type DayMinutes,
  type Figures,
} from "@/lib/your-activity";
import { formatShortDate, longDay, todayWord, weekdayShort } from "@/lib/dates";
import { haptic } from "@/lib/haptics";


/* ═══════════════════════════════════════════════════════════════════
   Your activity — the numbers, drawn

   Time gets a bar per day and a 30-day curve, because both answers
   matter: "how was this week" and "has it been trending up". Both are
   touchable — slide a finger along and the bubble follows it to the day
   under it. The curve can be pulled apart by activity, and each activity
   keeps one colour so the picture says what it's showing before the
   words do. Everything else that lives here is a list of its own, so it
   gets a page rather than a sheet.
   ═══════════════════════════════════════════════════════════════════ */

type Filter = ActivityKey | "all";

/** Every colour at once, so "Everything" is recognisable by the same dot
    the individual activities use. */
const RAINBOW = `conic-gradient(${ACTIVITIES.map((a) => a.color).join(", ")}, ${ACTIVITIES[0].color})`;

export default function YourActivityPage() {
  const [figures, setFigures] = useState<Figures | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setFigures(readFigures());
  }, []);

  if (figures === null) return <PageSkeleton title="Your activity" sections={2} />;

  const week = weekMinutes(figures);
  const peak = busiestDay(figures);

  const weekDays = lastDays(figures);
  const bars = toPoints(
    weekDays,
    weekDays.map((day) => day.minutes),
    WEEK_DAYS,
    (day, isLast) => (isLast ? todayWord() : weekdayShort(day.at)),
  );

  const days = lastDays(figures, TREND_DAYS);
  const activity = ACTIVITIES.find((row) => row.key === filter);
  const minutes = activity
    ? activityByDay(figures, activity)
    : days.map((day) => day.minutes);
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const grandTotal = days.reduce((sum, day) => sum + day.minutes, 0);
  const color = activity?.color ?? "var(--accent)";

  const dayLabel = (day: DayMinutes, isLast: boolean) =>
    isLast ? todayWord() : formatShortDate(day.at);
  const curve = toPoints(days, minutes, TREND_DAYS, dayLabel);

  /* Every activity on one set of axes, so a big day in one line and a small
     one in another don't look the same size. */
  const allSeries: ChartSeries[] = ACTIVITIES.map((row) => ({
    label: row.label,
    color: row.color,
    points: toPoints(days, activityByDay(figures, row), TREND_DAYS, dayLabel),
  }));

  return (
    <SettingsPage title="Your activity">
      <SectionTitle>Time on Tirbeo</SectionTitle>
      <p className="-mt-2 flex items-baseline gap-2">
        <span className="text-[30px] leading-none font-bold tracking-tight tabular-nums">
          <Counter minutes={week} />
        </span>
        <span className="text-[14px] text-muted">this week</span>
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        About {formatDuration(Math.round(week / WEEK_DAYS))} a day
        {peak ? ` · busiest on ${weekdayShort(peak.at)}, ${formatDuration(peak.minutes)}` : ""}
      </p>

      <div className="mt-4">
        <Bars points={bars} say={(point) => formatDuration(point.value)} />
      </div>
      <Helper>
        Each bar is one day, in minutes. The dashed line is your average day — tap a bar, or slide
        along the row, to read that day.
      </Helper>

      <SectionTitle>
        Last {TREND_DAYS} days{activity ? ` · ${activity.label.toLowerCase()}` : ""}
      </SectionTitle>

      {/* One row you swipe rather than a grid that wraps: the labels are short
          enough to read whole when nothing has to share a line with them, and
          each one carries the number it stands for, so picking a colour and
          learning what it cost are the same action. */}
      <div className="scrollbar-none -mx-4 mt-1 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <FilterChip
          on={filter === "all"}
          color={RAINBOW}
          label="Everything"
          value={formatDuration(grandTotal)}
          title={`Everything you've done here in the last ${TREND_DAYS} days`}
          onClick={() => setFilter("all")}
        />
        {ACTIVITIES.map((row) => (
          <FilterChip
            key={row.key}
            on={filter === row.key}
            color={row.color}
            label={row.label}
            value={formatDuration(activityTotal(figures, row))}
            title={`${row.label} in ${TREND_DAYS} days`}
            onClick={() => setFilter(row.key)}
          />
        ))}
      </div>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-[24px] leading-none font-bold tracking-tight tabular-nums">
          {/* Keyed by the filter so switching activity recounts the number
              instead of swapping it. */}
          <Counter key={filter} minutes={total} />
        </span>
        <span className="text-[13px] text-muted">
          {activity ? `${activity.label.toLowerCase()} in ${TREND_DAYS} days` : `all of it in ${TREND_DAYS} days`}
        </span>
      </p>

      {/* Remounted per filter so the marker re-finds the busiest day of the
          series it's actually being shown. */}
      <div className="mt-3">
        {activity ? (
          <Trend
            key={filter}
            points={curve}
            color={color}
            say={(point) => formatDuration(point.value)}
          />
        ) : (
          <TrendAll series={allSeries} say={formatDuration} />
        )}
      </div>
      <Helper>
        {activity
          ? `Drawn in the colour of ${activity.label.toLowerCase()} — ${formatDuration(
              activityTotal(figures, activity),
            )} of your ${TREND_DAYS} days went there.`
          : `Stacked, so the height of the picture is that day and each colour is the part it went to. Slide a finger along it, or pick a colour above for one activity.`}
      </Helper>

      <SectionTitle>Your records</SectionTitle>
      <Group>
        <LinkRow
          href="/settings/recently-deleted"
          title="Recently deleted"
          sub={`Gone for good ${KEEP_DAYS} days after you delete it.`}
        />
        <LinkRow
          href="/settings/activity-log"
          title="Account history"
          sub="Every change you've made to the account."
        />
      </Group>
      <Helper>
        <Link
          href="/settings/download-data"
          className="font-medium text-link underline underline-offset-2"
        >
          Download your data
        </Link>{" "}
        if you want a copy of everything Tirbeo holds on you before it goes.
      </Helper>
    </SettingsPage>
  );
}

/* ── The filter ────────────────────────────────────────────────── */

/** The big number above a chart. It carries the unit, so it owns the
    wording; the count-up is the only thing it adds. */
function Counter({ minutes }: { minutes: number }) {
  const shown = useCountUp(minutes);
  return <>{formatDuration(shown)}</>;
}

function FilterChip({
  on,
  color,
  label,
  value,
  title,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  value: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => haptic("light")}
      aria-pressed={on}
      title={title}
      className={cn(
        "flex min-h-10 shrink-0 snap-start items-center gap-2 rounded-full py-2 pr-3.5 pl-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
        on ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg",
      )}
    >
      <span aria-hidden className="size-[9px] shrink-0 rounded-full" style={{ background: color }} />
      {label}
      <span className={cn("tabular-nums", on ? "text-bg/65" : "text-fg/55")}>{value}</span>
    </button>
  );
}

/** Day records become chart points: short label on the axis, the full date
    in the bubble, and "Today" on the last one instead of either. */
function toPoints(
  days: DayMinutes[],
  values: number[],
  total: number,
  label: (day: DayMinutes, isLast: boolean) => string,
): ChartPoint[] {
  return days.map((day, i) => {
    const isLast = i === total - 1;
    return {
      label: label(day, isLast),
      readout: isLast ? todayWord() : longDay(day.at),
      value: values[i],
    };
  });
}
