"use client";

/* ═══════════════════════════════════════════════════════════════════
   Pull the page down and it asks again

   The gesture every phone user already knows: nothing has changed on the
   account, but the finger wants proof. So the column comes down against a
   rubber band, a ring turns, and the page underneath asks the account
   again — the page's own re-read (lib/page-refresh), not a rebuild of the
   rail, the header and every other panel along with it.

   It only answers to a pull that starts at the top of the page, because a
   gesture that competes with scrolling loses every time.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { cn } from "@/components/ig-ui";
import { haptic } from "@/lib/haptics";
import { refreshCurrentPage } from "@/lib/page-refresh";

/** How far it has to come down before it counts as an ask. */
const THRESHOLD = 62;
/** Where the band stops, however far the finger goes. */
const MAX = 116;
/** A finger travels further than a page should. */
const DAMP = 0.5;
/** How long the ring is allowed to turn before the page comes back. */
const READ_MS = 700;
/** The same spring the band uses, so the column and the ring come home as one. */
const HOME = "transform 320ms cubic-bezier(0.16,1,0.3,1)";

/**
 * @param target the column that comes down with the finger. The ring alone
 * would sit on top of the page it is refreshing, over whatever heading happens
 * to be there, so the page has to make room for it.
 */
export function PullToRefresh({
  onRefresh,
  target,
}: {
  onRefresh: () => void;
  target?: RefObject<HTMLElement | null>;
}) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  /* The live distance lives in a ref as well as in state: the handlers are
     bound once, and a `pull` in the dependency list would re-bind them on
     every frame of the drag. */
  const from = useRef<number | null>(null);
  const held = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    /* The column is moved by hand rather than through state: a frame of this
       gesture re-rendering the whole rail and page is the difference between
       a band that follows the finger and one that lags behind it. */
    const shift = (value: number, animate: boolean) => {
      const el = target?.current;
      if (!el) return;
      el.style.transition = animate ? HOME : "none";
      el.style.transform = `translate3d(0, ${value}px, 0)`;
      /* Cleared once it is home, because a transform left on the column would
         quietly become the containing block for every sheet and dialog in it. */
      if (value || !animate) return;
      window.setTimeout(() => {
        if (held.current || !target?.current) return;
        target.current.style.transition = "";
        target.current.style.transform = "";
      }, 340);
    };

    const lift = (value: number, animate = false) => {
      held.current = value;
      setPull(value);
      shift(value, animate);
    };

    const start = (event: TouchEvent) => {
      if (busyRef.current || event.touches.length !== 1 || window.scrollY > 1) return;
      from.current = event.touches[0].clientY;
    };

    const move = (event: TouchEvent) => {
      const at = from.current;
      if (at === null) return;
      const dy = event.touches[0].clientY - at;
      const next = dy > 0 ? Math.min(MAX, dy * DAMP) : 0;
      if (next !== held.current) lift(next);
    };

    const giveUp = () => {
      from.current = null;
      lift(0, true);
    };

    const release = () => {
      from.current = null;
      if (held.current < THRESHOLD) {
        lift(0, true);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      /* The ring parks just under the threshold rather than snapping back to
         zero, so the thing you're watching is the answer, not the spring. */
      lift(THRESHOLD * 0.55);
      haptic("medium");
      window.setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
        lift(0, true);
        /* The page re-reads itself when it knows how; only a page with no
           registered handler pays for the shell's rebuild. */
        if (!refreshCurrentPage()) onRefresh();
      }, READ_MS);
    };

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", release, { passive: true });
    window.addEventListener("touchcancel", giveUp, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", giveUp);
    };
  }, [onRefresh, target]);

  const shown = busy ? THRESHOLD * 0.55 : pull;
  if (!shown) return null;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center overflow-hidden"
      style={{
        height: shown,
        /* Springs home only when the finger has let go — following it exactly
           while it drags is the whole feel of the gesture. */
        transition: busy || from.current !== null ? "none" : "height 320ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <span className="mt-3 grid size-9 place-items-center rounded-full border border-border bg-surface shadow-[0_6px_18px_-8px_rgb(0_0_0/0.5)]">
        <svg
          viewBox="0 0 24 24"
          className={cn("size-[18px] text-accent", busy && "motion-safe:animate-spin")}
          style={busy ? undefined : { transform: `rotate(${progress * 300}deg)` }}
        >
          <path
            d="M20.5 12a8.5 8.5 0 1 1-5.9-8.06"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
}
