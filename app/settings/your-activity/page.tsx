"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bars, Trend, TrendAll, useCountUp, type ChartPoint, type ChartSeries } from "@/components/charts";
import { Chip, cn } from "@/components/ig-ui";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { LoadFailed } from "@/components/page-loading";
import { usePageRefresh } from "@/lib/page-refresh";
import {
  GROUPS,
  TREND_DAYS,
  WEEK_DAYS,
  busiestDay,
  byDayForGroup,
  formatCount,
  groupTotal,
  lastDays,
  readSummary,
  weekTotal,
  type ActivitySummary,
  type DayRow,
  type GroupKey,
} from "@/lib/your-activity";
import { KEEP_DAYS } from "@/lib/deleted-items";
import { formatShortDate, longDay, todayWord, weekdayShort } from "@/lib/dates";
import { haptic } from "@/lib/haptics";


/* ═══════════════════════════════════════════════════════════════════
   Your activity — the numbers, drawn

   These are rows the account actually recorded, counted per day in this
   device's timezone, and both answers matter: "how was this week" and "has
   it been trending up". Both charts are touchable — slide a finger along
   and the bubble follows it to the day under it. The curve can be pulled
   apart by group, and each group keeps one colour so the picture says what
   it's showing before the words do.

   A day with no rows is drawn as a zero. Nothing here is estimated: an
   empty stretch means the account has no record of that day, not a guess
   about it.
   ═══════════════════════════════════════════════════════════════════ */

type Filter = GroupKey | "all";

/** Every colour at once, so "Everything" is recognisable by the same dot
    the individual groups use. */
const RAINBOW = `conic-gradient(${GROUPS.map((g) => g.color).join(", ")}, ${GROUPS[0].color})`;

const sayCount = (value: number) => formatCount(value);

export default function YourActivityPage() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setFailed(false);
    readSummary()
      .then(setSummary)
      .catch(() => setFailed(true));
  };

  usePageRefresh(load);

  if (failed)
    return (
      <LoadFailed
        title="Your activity"
        message="The counts couldn't be read from the account. Nothing has been lost — the account just didn't answer. Try again."
        onRetry={load}
      />
    );

  if (summary === null) return <PageSkeleton title="Your activity" sections={2} />;

  const week = weekTotal(summary);
  const peak = busiestDay(summary);

  const weekDays = lastDays(summary);
  const bars = toPoints(
    weekDays,
    weekDays.map((day) => day.total),
    WEEK_DAYS,
    (day, isLast) => (isLast ? todayWord() : weekdayShort(day.at)),
  );

  const group = GROUPS.find((row) => row.key === filter);
  const counts = group ? byDayForGroup(summary, group.key) : summary.days.map((day) => day.total);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const grandTotal = summary.total;
  const color = group?.color ?? "var(--accent)";

  const dayLabel = (day: DayRow, isLast: boolean) =>
    isLast ? todayWord() : formatShortDate(day.at);
  const curve = toPoints(summary.days, counts, TREND_DAYS, dayLabel);

  /* Every group on one set of axes, so a busy day in one line and a quiet
     one in another don't look the same size. */
  const allSeries: ChartSeries[] = GROUPS.map((row) => ({
    label: row.label,
    color: row.color,
    points: toPoints(summary.days, byDayForGroup(summary, row.key), TREND_DAYS, dayLabel),
  }));

  return (
    <SettingsPage title="Your activity">
      <SectionTitle>Recorded this week</SectionTitle>
      <p className="-mt-2 flex items-baseline gap-2">
        <span className="text-[30px] leading-none font-bold tracking-tight tabular-nums">
          <Counter value={week} />
        </span>
        <span className="text-[14px] text-muted">{week === 1 ? "thing" : "things"}</span>
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        About {Math.round(week / WEEK_DAYS)} a day
        {peak ? ` · busiest on ${weekdayShort(peak.at)}, ${formatCount(peak.total)}` : ""}
      </p>

      <div className="mt-4">
        <Bars points={bars} say={(point) => sayCount(point.value)} />
      </div>
      <Helper>
        Each bar is one day, counted in your timezone. The dashed line is your average day — tap a
        bar, or slide along the row, to read that day.
      </Helper>

      <SectionTitle>
        Last {TREND_DAYS} days{group ? ` · ${group.label.toLowerCase()}` : ""}
      </SectionTitle>

      {/* One row you swipe rather than a grid that wraps: the labels are short
          enough to read whole when nothing has to share a line with them, and
          each one carries the number it stands for, so picking a colour and
          learning what it counted are the same action. */}
      <div className="scrollbar-none -mx-4 mt-1 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <FilterChip
          on={filter === "all"}
          color={RAINBOW}
          label="Everything"
          value={grandTotal}
          title={`Everything recorded here in the last ${TREND_DAYS} days`}
          onClick={() => setFilter("all")}
        />
        {GROUPS.map((row) => (
          <FilterChip
            key={row.key}
            on={filter === row.key}
            color={row.color}
            label={row.label}
            value={groupTotal(summary, row.key)}
            title={`${row.label} in ${TREND_DAYS} days`}
            onClick={() => setFilter(row.key)}
          />
        ))}
      </div>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-[24px] leading-none font-bold tracking-tight tabular-nums">
          {/* Keyed by the filter so switching group recounts the number
              instead of swapping it. */}
          <Counter key={filter} value={total} />
        </span>
        <span className="text-[13px] text-muted">
          {group ? `${group.label.toLowerCase()} in ${TREND_DAYS} days` : `all of it in ${TREND_DAYS} days`}
        </span>
      </p>

      {/* Remounted per filter so the marker re-finds the busiest day of the
          series it's actually being shown. */}
      <div className="mt-3">
        {group ? (
          <Trend
            key={filter}
            points={curve}
            color={color}
            say={(point) => sayCount(point.value)}
          />
        ) : (
          <TrendAll series={allSeries} say={sayCount} />
        )}
      </div>
      <Helper>
        {group
          ? `Drawn in the colour of ${group.label.toLowerCase()} — that line is the ${formatCount(
              groupTotal(summary, group.key),
            )} your ${TREND_DAYS} days left behind.`
          : `Stacked, so the height of the picture is that day and each colour is the part it was. Slide a finger along it, or pick a colour above for one group.`}
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
          /* The line box of an inline link is about 15px tall, which is half
             what a finger can reliably hit. Negative margin keeps the padding
             from changing the paragraph's leading, so the hit area grows
             without the sentence moving. */
          className="-m-2.5 inline-block p-2.5 font-medium text-link underline underline-offset-2"
        >
          Download your data
        </Link>{" "}
        if you want a copy of everything Tirbeo holds on you before it goes.
      </Helper>
    </SettingsPage>
  );
}

/* ── The filter ────────────────────────────────────────────────── */

/** The big number above a chart. It carries only the count; the unit is
    written beside it, and the count-up is the only thing it adds. */
function Counter({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{shown}</>;
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
  value: number;
  title: string;
  onClick: () => void;
}) {
  return (
    <Chip
      active={on}
      onClick={onClick}
      onPointerDown={() => haptic("light")}
      title={title}
      className="min-h-10 shrink-0 snap-start"
      dot={
        <span
          aria-hidden
          className="size-[9px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      }
    >
      {label}
      <span className={cn("tabular-nums", on ? "text-accent-fg/75" : "text-fg/55")}>{value}</span>
    </Chip>
  );
}

/** Day records become chart points: short label on the axis, the full date
    in the bubble, and "Today" on the last one instead of either. */
function toPoints(
  days: DayRow[],
  values: number[],
  total: number,
  label: (day: DayRow, isLast: boolean) => string,
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
