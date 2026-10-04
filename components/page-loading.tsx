"use client";

/* ═══════════════════════════════════════════════════════════════════
   Loading shapes

   A skeleton has to promise the layout that is coming: rows where rows
   will land, a panel where a panel will land, none of it shifting the
   page when the real data arrives. These match the shell's own row
   metrics (ROW padding, TITLE/SUB sizes) so the promise is exact, and
   they are built from the ig-ui Skeleton — the one shimmer the app owns.
   ═══════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ig-ui";
import { Helper, PillButton, PillStack, SettingsPage } from "@/components/settings-shell";

/** One row of a Group: a title bar, its explanation, and the value that
    will sit at the end of the line. Padding and heights mirror ROW/TITLE/SUB
    so nothing moves when the data lands. */
function Row({ trailing = true }: { trailing?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-[15px] sm:px-5 sm:py-[17px]">
      <span className="min-w-0 flex-1 space-y-[7px]">
        <Skeleton className="h-[15px] w-[46%] rounded-full" />
        <Skeleton className="h-[12px] w-[72%] rounded-full" />
      </span>
      {trailing ? <Skeleton className="h-[12px] w-[56px] shrink-0 rounded-full" /> : null}
    </div>
  );
}

/** A plain list of `count` rows — the unboxed hairline list the real Group
    draws — so the skeleton promises the layout that is coming. */
export function RowsSkeleton({ count = 3, trailing = true }: { count?: number; trailing?: boolean }) {
  return (
    <div className="list-divide">
      {Array.from({ length: count }, (_, i) => (
        <Row key={i} trailing={trailing} />
      ))}
    </div>
  );
}

/** A section heading bar over a panel — the pair every list page draws. */
export function SectionSkeleton({
  count = 3,
  trailing = true,
  lead = false,
}: {
  count?: number;
  trailing?: boolean;
  /** The paragraph a page says before its first section. */
  lead?: boolean;
}) {
  return (
    <div className={lead ? undefined : "mt-9"}>
      {lead ? <Skeleton className="mt-5 mb-1 h-[14px] w-[85%] rounded-full" /> : null}
      <Skeleton className="mb-3 h-[17px] w-[140px] rounded-full" />
      <RowsSkeleton count={count} trailing={trailing} />
    </div>
  );
}

/** Two stacked bars shaped like a toggle/switch row, for pages whose rows
    carry controls rather than values. */
export function ToggleRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="list-divide">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-[15px] sm:px-5 sm:py-[17px]">
          <span className="min-w-0 flex-1 space-y-[7px]">
            <Skeleton className="h-[15px] w-[52%] rounded-full" />
            <Skeleton className="h-[12px] w-[78%] rounded-full" />
          </span>
          <Skeleton className="h-7 w-[46px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The whole page, shaped as one heading over one panel of rows — the
    layout almost every settings list is. Carries the real page title so
    the app bar and back row don't change when the data lands. */
export function SkeletonPage({
  title,
  lead = false,
  count = 3,
  trailing = true,
}: {
  title: string;
  /** The paragraph a page says before its first section. */
  lead?: boolean;
  count?: number;
  trailing?: boolean;
}) {
  return (
    <SettingsPage title={title}>
      {lead ? <Skeleton className="mt-5 mb-1 h-[14px] w-[85%] rounded-full" /> : null}
      <Skeleton className="mt-9 mb-3 h-[17px] w-[140px] rounded-full" />
      <RowsSkeleton count={count} trailing={trailing} />
    </SettingsPage>
  );
}

/** A switch page (notifications, data permissions, two-factor): a heading
    bar over a panel of control rows, which is what those pages fill in. */
export function TogglePageSkeleton({ title, count = 4 }: { title: string; count?: number }) {
  return (
    <SettingsPage title={title}>
      <Skeleton className="mt-9 mb-3 h-[17px] w-[140px] rounded-full" />
      <ToggleRowsSkeleton count={count} />
    </SettingsPage>
  );
}

/** The honest answer when the read failed: what couldn't be read, that
    nothing changed because of it, and one way to ask again. */
export function LoadFailed({
  title,
  message,
  onRetry,
  children,
}: {
  title: string;
  message: ReactNode;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <SettingsPage title={title}>
      <Helper lead tone="danger">
        {message}
      </Helper>
      {children}
      {onRetry ? (
        <PillStack>
          <PillButton tone="outline" label="Try again" onClick={onRetry} />
        </PillStack>
      ) : null}
    </SettingsPage>
  );
}
