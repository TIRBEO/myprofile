"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/components/ig-ui";
import { LIVE, ROW } from "@/components/settings-shell";
import type { DeviceKind } from "@/lib/device";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   The device tile

   The one screen that names a machine — the session list, a single
   session's page, the multi-select — draws it the same way: a soft
   square with the machine in it, the details beside it, the way in on
   the right. One shape, so a phone never looks like a laptop between
   two pages.
   ═══════════════════════════════════════════════════════════════════ */

const TONE = {
  plain: "bg-surface-3 text-fg",
  current: "bg-accent/12 text-accent-text",
};

export function DeviceGlyph({ kind, className }: { kind: DeviceKind; className?: string }) {
  const cls = className ?? "size-8";
  if (kind === "phone") return <Smartphone className={cls} strokeWidth={1.6} />;
  if (kind === "tablet") return <Tablet className={cls} strokeWidth={1.6} />;
  return <Monitor className={cls} strokeWidth={1.6} />;
}

/** The machine in its square. A detail page asks for a bigger one; the
    shape and the tones don't change. */
export function DeviceTile({
  kind = "computer",
  tone = "plain",
  size = "md",
}: {
  kind?: DeviceKind;
  tone?: keyof typeof TONE;
  size?: "md" | "xl";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl",
        size === "xl" ? "size-[104px]" : "size-[62px]",
        TONE[tone],
      )}
    >
      <DeviceGlyph kind={kind} className={size === "xl" ? "size-14" : undefined} />
    </span>
  );
}

/** The row itself: tile, then the machine and where it is, then the arrow. */
export function DeviceRow({
  href,
  title,
  location,
  current,
  sub,
  kind,
  tone,
}: {
  href: string;
  title: string;
  location: string;
  /** Tags the row as the machine you're reading it on. */
  current?: boolean;
  /** Anything said under the location — a time, an "active" line. */
  sub?: ReactNode;
  kind?: DeviceKind;
  tone?: keyof typeof TONE;
}) {
  return (
    <Link
      href={href}
      onClick={() => haptic("light")}
      className={cn(ROW, LIVE)}
    >
      <DeviceTile kind={kind} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="truncate text-[15.5px] font-semibold">{title}</span>
        <span className="mt-1 block truncate text-[13.5px] text-muted">
          {location}
          {current ? (
            <>
              {" · "}
              <span className="text-muted">This device</span>
            </>
          ) : null}
        </span>
        {sub ? <span className="mt-0.5 block truncate text-[13px] text-muted">{sub}</span> : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" strokeWidth={2} />
    </Link>
  );
}
