"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ig-ui";

/* ═══════════════════════════════════════════════════════════════════
   Charts

   Two shapes, both plain DOM plus one SVG path — no chart library,
   because a settings screen needs two small pictures and not a plotting
   engine. They draw whatever they're handed and say nothing about
   units; the page passes a formatter for the numbers around them.

   Both are read by touch as much as by eye: every column, and every
   point on the curve, is a real button, and the bubble above slides to
   whatever is selected. The peak is selected before anyone touches it,
   so the picture has an answer on it from the start.
   ═══════════════════════════════════════════════════════════════════ */

export type ChartPoint = {
  /** The short mark under the chart — "Thu", "26 Sept". */
  label: string;
  value: number;
  /** Fuller wording for the bubble — "Thu, 24 Sept". */
  readout?: string;
};

/** One line in a multi-series chart. All series share the same days, in the
    same order, so a single index addresses every line at once. */
export type ChartSeries = {
  label: string;
  color: string;
  points: ChartPoint[];
};

type ChartProps = {
  points: ChartPoint[];
  /** How a value is spoken back to the person — "1h 6m", "41m", "6". */
  say: (point: ChartPoint) => string;
};

/** One line above a chart: which day is selected, and what it came to. It
    sits on its own row rather than floating over the picture, so a tall bar
    never has to share space with it. */
function Readout({
  point,
  value,
}: {
  point: ChartPoint | undefined;
  value: string;
}) {
  if (!point) return null;
  return (
    <p
      className="mb-3 text-center text-[13px] font-semibold tabular-nums"
      style={{ animation: "ig-fade 450ms ease-out backwards" }}
    >
      {point.readout ?? point.label}
      <span className="mx-1.5 text-muted">·</span>
      {value}
    </p>
  );
}

/** Count a number up to its value, so a headline figure arrives in the same
    beat the picture draws itself. It starts at nothing on purpose: these
    numbers only render once their data has, so the first run is always the
    real one. The running value is kept in a ref rather than read back from
    state, so a second effect pass picks up where the first left off instead
    of concluding there's nothing to animate. */
export function useCountUp(target: number, ms = 720) {
  const [shown, setShown] = useState(0);
  const at = useRef(0);

  useEffect(() => {
    const start = at.current;
    if (start === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      at.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const value = Math.round(start + (target - start) * (1 - (1 - p) ** 3));
      at.current = value;
      setShown(value);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return shown;
}

/** Day-by-day bars with a dashed average, so the one long day reads at a
    glance and "busier than usual" has something to sit against. */
export function Bars({
  points,
  height = 132,
  say = (point) => String(point.value),
}: ChartProps & { height?: number }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const avg = points.reduce((sum, p) => sum + p.value, 0) / (points.length || 1);
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  /** Bars stop short of the box so the row of labels underneath has room. */
  const SCALE = 0.94;

  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState(peak);
  const sel = touched ? picked : peak;
  const box = useRef<HTMLDivElement>(null);

  const choose = (i: number) => {
    setTouched(true);
    setPicked(i);
  };

  /** Dragging across the row is the gesture people reach for, so the whole
      box tracks the pointer instead of only the bar under it. */
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect?.width || event.pointerType === "mouse" && event.buttons === 0 && !touched) return;
    const column = rect.width / Math.max(1, points.length);
    choose(Math.min(points.length - 1, Math.max(0, Math.floor((event.clientX - rect.left) / column))));
  };

  if (!points.length) return null;

  return (
    <div>
      <Readout point={points[sel]} value={say(points[sel])} />

      <div
        ref={box}
        className="relative flex touch-pan-y items-end gap-1.5"
        style={{ height }}
        onPointerMove={onMove}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[calc(100%/var(--cols))] rounded-xl bg-surface-2/70 transition-[left] duration-200 ease-out"
          style={{ left: `${(sel / points.length) * 100}%`, ["--cols" as string]: String(points.length) }}
        />
        {avg > 0 && avg < max ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/45"
            style={{ bottom: `${(avg / max) * SCALE * 100}%` }}
          />
        ) : null}
        {points.map((p, i) => {
          const on = i === sel;
          return (
            <button
              key={p.label}
              type="button"
              onPointerEnter={() => choose(i)}
              onFocus={() => choose(i)}
              onClick={() => choose(i)}
              aria-label={`${p.label}: ${say(p)}`}
              aria-pressed={on}
              className="relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end rounded-lg outline-none"
            >
              <div
                className={cn(
                  "w-full rounded-t-[6px] transition-colors",
                  on ? "bg-accent" : "bg-surface-3",
                )}
                style={{
                  height: `${Math.max(3, (p.value / max) * SCALE * 100)}%`,
                  animation: `ig-bar-rise 620ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 34}ms backwards`,
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {points.map((p, i) => (
          <span
            key={p.label}
            className={cn(
              "min-w-0 flex-1 truncate text-center text-[11px] transition-colors",
              i === sel ? "font-semibold text-fg" : "text-muted",
            )}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A 30-day curve. The line is drawn in a stretched viewBox so it fills any
    width; the stroke keeps its weight because it doesn't scale with it.
    `color` lets a filtered chart carry the colour of what it's showing. */
export function Trend({
  points,
  height = 150,
  color = "var(--accent)",
  say = (point) => String(point.value),
}: ChartProps & { height?: number; color?: string }) {
  const W = 300;
  const H = 100;
  const PAD = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const spot = points.map((p, i) => {
    const x = PAD + (i / Math.max(1, points.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (p.value / max) * (H - PAD * 2);
    return { x, y, p };
  });
  const line = spot.map((s, i) => `${i ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join(" ");
  const first = spot[0];
  const last = spot[spot.length - 1];
  const peakAt = spot.reduce((best, s, i) => (s.p.value > spot[best].p.value ? i : best), 0);

  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState(peakAt);
  const sel = spot[touched ? picked : peakAt];
  const box = useRef<HTMLDivElement>(null);

  const setPick = (i: number) => {
    setTouched(true);
    setPicked(Math.min(points.length - 1, Math.max(0, i)));
  };
  const choose = (clientX: number, fallback: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect?.width) return setPick(fallback);
    setPick(Math.round(((clientX - rect.left) / rect.width) * (points.length - 1)));
  };

  if (!first || !last || !sel) return null;

  return (
    <div>
      <Readout point={sel.p} value={say(sel.p)} />

      <div
        ref={box}
        className="relative touch-pan-y"
        style={{ height }}
        onPointerMove={(event) => choose(event.clientX, picked)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${last.x.toFixed(1)} ${H} L${first.x.toFixed(1)} ${H} Z`}
            fill="url(#trend-fill)"
            style={{ animation: "ig-fade 700ms ease-out 260ms backwards" }}
          />
          {/* pathLength=1 normalises the dash to the whole line, so the same
              keyframe draws a 7-day and a 30-day curve in the same time. */}
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            style={{ animation: "ig-line-draw 900ms cubic-bezier(0.65, 0, 0.35, 1) backwards" }}
          />
        </svg>

        {/* Guide and dot live in unscaled space, so the stretched viewBox
            can't squash either of them. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-muted/35 transition-[left] duration-150 ease-out"
          style={{ left: `${(sel.x / W) * 100}%`, animation: "ig-fade 400ms ease-out 700ms backwards" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg transition-[left,top] duration-150 ease-out"
          style={{
            left: `${(sel.x / W) * 100}%`,
            top: `${(sel.y / H) * 100}%`,
            background: color,
            animation: "ig-fade 400ms ease-out 760ms backwards",
          }}
        />

        {/* One tab stop for the whole curve, and the arrow keys walk it a day
            at a time. A column per day used to mean thirty presses before you
            could leave the chart — and none of them showed where you were. */}
        <div
          className="absolute inset-0 flex"
          role="group"
          aria-label="Daily minutes. Use the arrow keys to move between days."
          tabIndex={0}
          onKeyDown={(event) => {
            const at = touched ? picked : peakAt;
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setPick(at - 1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setPick(at + 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              setPick(0);
            } else if (event.key === "End") {
              event.preventDefault();
              setPick(points.length - 1);
            }
          }}
        >
          {points.map((p, i) => (
            <button
              key={p.label}
              type="button"
              tabIndex={-1}
              onClick={(event) => {
                const rect = box.current?.getBoundingClientRect();
                if (rect) {
                  const ratio = (event.clientX - rect.left) / rect.width;
                  const step = (W - PAD * 2) / Math.max(1, points.length - 1);
                  const j = Math.round((PAD + ratio * (W - PAD * 2) - PAD) / step);
                  setPicked(Math.min(points.length - 1, Math.max(0, j)));
                } else {
                  setPicked(i);
                }
                setTouched(true);
              }}
              aria-label={`${p.label}: ${say(p)}`}
              aria-pressed={i === (touched ? picked : peakAt)}
              className="h-full min-w-0 flex-1 cursor-pointer outline-none"
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{first.p.label}</span>
        <span>{last.p.label}</span>
      </div>
    </div>
  );
}

/** Every activity at once, stacked rather than overlapped. Five lines on one
    set of axes spend most of their time tangled in the bottom third of the
    box and leave the top empty; stacked, the same numbers fill the picture
    and a day's shape says what it went to. One crosshair answers for all of
    them, and the breakdown sits under the chart where it can be read. */
export function TrendAll({
  series,
  height = 150,
  say = (value) => String(value),
}: {
  series: ChartSeries[];
  height?: number;
  say?: (value: number) => string;
}) {
  const W = 300;
  const H = 100;
  const PAD = 6;
  const days = series[0]?.points.length ?? 0;
  const xAt = (i: number) => PAD + (i / Math.max(1, days - 1)) * (W - PAD * 2);
  const totalAt = (i: number) => series.reduce((sum, s) => sum + (s.points[i]?.value ?? 0), 0);
  const totals = Array.from({ length: days }, (_, i) => totalAt(i));
  const max = Math.max(...totals, 1);
  const yAt = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  /** Each band runs from the top of everything below it to its own top. */
  let running = new Array(days).fill(0);
  const bands = series.map((s) => {
    const base = running.slice();
    running = running.map((v, i) => v + (s.points[i]?.value ?? 0));
    const outline = Array.from({ length: days }, (_, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(running[i]).toFixed(1)}`).join(" ");
    const back = Array.from({ length: days }, (_, i) => days - 1 - i)
      .map((i) => `L${xAt(i).toFixed(1)} ${yAt(base[i]).toFixed(1)}`)
      .join(" ");
    return { ...s, path: `${outline} ${back} Z` };
  });

  // The day worth opening on: the one everything added up to.
  const busiest = totals.reduce((best, t, i, all) => (t > all[best] ? i : best), 0);

  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState(busiest);
  const sel = touched ? picked : busiest;
  const box = useRef<HTMLDivElement>(null);

  const setPick = (i: number) => {
    setTouched(true);
    setPicked(Math.min(days - 1, Math.max(0, i)));
  };
  const choose = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect?.width) return;
    setPick(Math.round(((clientX - rect.left) / rect.width) * (days - 1)));
  };

  if (!days) return null;

  const day = series[0].points[sel];

  return (
    <div>
      <Readout point={day} value={say(totalAt(sel))} />

      <div
        ref={box}
        className="relative touch-pan-y"
        style={{ height }}
        onPointerMove={(event) => choose(event.clientX)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
          style={{ animation: "ig-reveal 780ms cubic-bezier(0.22, 1, 0.36, 1) backwards" }}
        >
          {bands.map((b) => (
            <path key={b.label} d={b.path} fill={b.color} fillOpacity={0.85} />
          ))}
        </svg>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[1.5px] rounded-full bg-bg/80 transition-[left] duration-150 ease-out"
          style={{ left: `${(xAt(sel) / W) * 100}%`, animation: "ig-fade 400ms ease-out 720ms backwards" }}
        />

        <div
          className="absolute inset-0 flex"
          role="group"
          aria-label="Daily minutes, by activity. Use the arrow keys to move between days."
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setPick(sel - 1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setPick(sel + 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              setPick(0);
            } else if (event.key === "End") {
              event.preventDefault();
              setPick(days - 1);
            }
          }}
        >
          {series[0].points.map((p, i) => (
            <button
              key={p.label}
              type="button"
              tabIndex={-1}
              onClick={() => setPick(i)}
              aria-label={`${p.readout ?? p.label}: ${series
                .map((s) => `${s.label} ${say(s.points[i]?.value ?? 0)}`)
                .join(", ")}`}
              aria-pressed={i === sel}
              className="h-full min-w-0 flex-1 cursor-pointer outline-none"
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{series[0].points[0]?.label}</span>
        <span>{series[0].points[days - 1]?.label}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5">
        {series.map((s) => (
          <span
            key={s.label}
            className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted tabular-nums"
          >
            <span aria-hidden className="size-[8px] shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto font-semibold text-fg">{say(s.points[sel]?.value ?? 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
