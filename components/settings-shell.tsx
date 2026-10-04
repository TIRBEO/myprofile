"use client";

/* ═══════════════════════════════════════════════════════════════════
   Settings shell

   The single vocabulary every settings page is built from: a titled
   column, a status card, bold section headings over plain unboxed lists,
   and rows where the whole line is the tap target — never the
   control at the end of it alone.

   Pages import these rather than restating them, so a change here lands
   everywhere instead of drifting between screens.
   ═══════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { cn, PILL_BASE, PILL_DISABLED, PILL_FILL } from "@/components/ig-ui";
import { navItem, parentHref, titleFor } from "@/lib/nav";
import { guidesFor } from "@/lib/docs-links";
import { useT } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

/** Shared by the handful of pages that draw a row the primitives above don't
    fit. Exported so a list can't quietly drift back to coin-shaped icons.
    Tall on purpose: a row is a title and its explanation, and the line has to
    have room for both without the control at the end crowding the words. */
export const ROW =
 "flex w-full items-center gap-4 px-4 py-[15px] text-left outline-none transition-colors sm:px-5 sm:py-[17px]";
export const LIVE = "hover:bg-surface-2/50 active:bg-surface-2/70";
/** A bare glyph, not a coin: the picture belongs to the row, not to itself. */
export const CHIP = "flex size-7 shrink-0 items-center justify-center text-muted [&_svg]:size-[19px]";
/** The row's own line. It wraps rather than clipping, because the label often
    IS the setting — "Share anonymous usage data with partners" cut to two
    lines and an ellipsis stops being a question you can answer. */
export const TITLE = "block text-[15.5px] leading-[1.35] font-medium";
export const SUB = "mt-[3px] block text-[13.5px] leading-[1.45] text-muted";

/** The square beside a record's heading — the same tile on every detail page,
    so a change, a sign-in and a deleted item are all introduced the same way.
    A clean raised surface with a strong glyph, not a tinted slab: the colour
    belongs to the record's state, which the heading and the flags carry. */
export const TILE =
  "flex size-[62px] shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-fg [&_svg]:size-[26px]";

export function SettingsPage({
  title,
  crumb,
  wide,
  children,
}: {
  /** Omit it on the statement pages, which carry their own centred heading in
      the page body — a left-aligned title above a centred one says the same
      sentence twice and pushes the face off the top of the screen. */
  title?: string;
  /** A trail instead of the plain back arrow, for pages that sit inside a
      list of their own — documentation, policies. The trail contains the way
      back, so giving it means the arrow is dropped rather than doubled. */
  crumb?: ReactNode;
  /** For pages that are a library rather than a form — the documentation
      index — where one narrow column wastes the wide screen. */
  wide?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const t = useT();
  const back = parentHref(pathname);
  /* A page the rail already lists has its way out one tap to the left, so on a
     wide screen it drops the back row and keeps the heading. A narrow screen
     always keeps it, and a page outside the rail keeps it at every width. */
  const inRail = !!navItem(pathname);
  /* Instagram's arrangement: on a phone the heading lives in a sticky
     app bar with the back chevron beside it, and the page itself starts
     on the rows. On desktop the bar is gone and the big left-aligned
     title is back. A page that brings its own crumb keeps the old
     arrangement at every width. */
  const inBar = Boolean(title) && !crumb;

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pt-4 pb-16 sm:px-6 sm:pt-9",
        wide ? "max-w-[980px]" : "max-w-[680px]",
      )}
    >
      {crumb ? crumb : null}

      {back && !inRail ? (
        <div className={inBar ? "hidden lg:block" : undefined}>
          <BackLink href={back} />
        </div>
      ) : back && inRail && !inBar ? (
        <div className="lg:hidden">
          <BackLink href={back} />
        </div>
      ) : null}

      {inBar ? (
        <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-3 flex items-center gap-1 border-b border-divider bg-bg/85 px-1.5 py-1.5 backdrop-blur-xl sm:-mx-6 sm:-mt-9 lg:hidden">
          {back ? (
            <Link
              href={back}
              aria-label={`Back to ${titleFor(back)}`}
              onClick={() => haptic("light")}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-fg outline-none transition-colors hover:bg-surface-2 active:bg-surface-3"
            >
              <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
            </Link>
          ) : (
            <span aria-hidden className="size-10 shrink-0" />
          )}
          <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold tracking-[-0.01em]">
            {t(title!)}
          </h1>
          <span aria-hidden className="size-10 shrink-0" />
        </div>
      ) : null}

      {title ? (
        <h1
          className={cn(
            "mb-4 text-[24px] leading-tight font-bold tracking-[-0.025em] sm:mb-5 sm:text-[30px]",
            inBar && "hidden lg:block",
            !crumb && back && "mt-1.5",
          )}
        >
          {t(title)}
        </h1>
      ) : null}

      {children}

      <Guides pathname={pathname} />
    </div>
  );
}

/** The articles written about this page, printed at the bottom of it — the
    documentation is no use if you only find it after you've given up. Which
    guides belong here is listed in lib/docs-links rather than derived from
    the articles, so a settings page never has to carry the documentation
    bundle to say where the documentation is. */
function Guides({ pathname }: { pathname: string }) {
  const t = useT();
  const guides = guidesFor(pathname);
  if (!guides.length) return null;
  return (
    <nav aria-label="Guides about this page" className="mt-12">
      <p className="mb-3 px-1 text-[13px] font-semibold text-muted">
        {t("Read about this page")}
      </p>
      {/* Rows, not chips: a guide is a page you go to, and the app already has
          one look for that. Chips made three real links read as three tags. */}
      <Group>
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/settings/help/${guide.slug}`}
            onClick={() => haptic("light")}
            className={cn(ROW, LIVE, "group")}
          >
            <span className="min-w-0 flex-1 text-[15.5px] font-medium">{guide.label}</span>
            <ChevronRight
              className="size-[17px] shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
              strokeWidth={2.2}
            />
          </Link>
        ))}
      </Group>
    </nav>
  );
}

/** Where this page sits inside a set of pages of its own: each earlier part is
    a link back, the last one is where you are. Small and muted — it's a sign,
    not a heading. */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="-ml-2 mb-2 flex min-w-0 items-center gap-0.5 text-[12.5px] font-semibold text-muted"
    >
      {items.map((item, i) => (
        <span key={item.label} className="flex min-w-0 items-center">
          {i > 0 ? (
            <ChevronRight className="size-[14px] shrink-0 opacity-50" strokeWidth={2.4} />
          ) : null}
          {item.href ? (
            <Link
              href={item.href}
              onClick={() => haptic("light")}
 className="inline-flex min-h-10 items-center truncate rounded-full px-2 py-1 outline-none transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ) : (
            <span className="truncate px-2 text-fg/60">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* The way back: a chevron and the name of the place you're leaving, the
   way Instagram draws a push back — no bar, no fill, just a thumb-sized
   target with the arrow nudging left when you hover it. */
function BackLink({ href }: { href: string }) {
  const t = useT();
  const label = t(titleFor(href));
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      onClick={() => haptic("light")}
      className={cn(
        "group -ml-2.5 inline-flex min-h-11 max-w-full items-center gap-1 rounded-lg py-2 pr-3 pl-2 text-[15px] font-semibold text-fg outline-none transition-colors hover:bg-surface-2 active:bg-surface-3",
      )}
    >
      <ChevronLeft
        className="size-[21px] shrink-0 transition-transform duration-200 group-hover:-translate-x-[2px]"
        strokeWidth={2.2}
      />
      <span className="truncate">{titleFor(href)}</span>
    </Link>
  );
}

export function PageSkeleton({ title, sections = 1 }: { title: string; sections?: number }) {
  return (
    <SettingsPage title={title}>
      <div className="mb-3 h-[68px] animate-pulse rounded-2xl bg-fg/[0.045] sm:h-[76px]" />
      {Array.from({ length: sections }, (_, i) => (
        <div key={i}>
          <div className="mt-10 mb-3 h-[17px] w-[140px] animate-pulse rounded-full bg-fg/[0.06]" />
          <div className="list-divide">
            <div className="h-[52px] animate-pulse bg-fg/[0.04]" />
            <div className="h-[52px] animate-pulse bg-fg/[0.03]" />
          </div>
        </div>
      ))}
    </SettingsPage>
  );
}

export function SectionTitle({
  children,
  desc,
  action,
}: {
  children: ReactNode;
  desc?: ReactNode;
  /** A control that belongs to the whole section — "Edit" on a block of
      details — put beside the heading instead of faking a row inside it. */
  action?: ReactNode;
}) {
  /* A heading, its explanation, then the plain list it belongs to — with enough
     air above that a page reads as a few separate decisions rather than one
     long list, and enough below that the first line isn't crowding the words. */
  return (
    <div className="mt-9 mb-3 first:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-fg">{children}</h2>
        {action}
      </div>
      {desc ? <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-[1.5] text-muted">{desc}</p> : null}
    </div>
  );
}

/** A section of rows, unboxed: a plain list on the page, the rows divided by
    one full-width hairline each. No frame, no fill, no shadow — the heading
    above says what the block is, and the hairlines say what belongs to it.
    The same container serves nav rows and read-only detail rows, so one look
    runs through the app. */
export function Group({
  children,
  dimmed,
  label,
}: {
  children: ReactNode;
  dimmed?: boolean;
  label?: string;
}) {
  return (
    <div
      role={label ? "radiogroup" : undefined}
      aria-label={label}
      aria-disabled={dimmed || undefined}
      className={cn("list-divide transition-opacity duration-200", dimmed && "pointer-events-none opacity-45")}
    >
      {children}
    </div>
  );
}

/** The small control beside a section heading — the whole block's action, not
    a row inside the block it acts on. */
export function SectionAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
 className="relative shrink-0 rounded-full px-2.5 py-1 text-[13.5px] font-semibold text-accent-text outline-none transition-colors hover:bg-accent/10 after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']"
    >
      {label}
    </button>
  );
}

/** The line of plain text that explains a card, or opens a page when that page
    has one fact to state before any list. `lead` is the page-opening size;
    `tone` colours it when the fact is a good or a bad one. A section that
    explains itself before you read it uses SectionTitle's `desc` instead. */
export function Helper({
  children,
  className,
  lead,
  tone,
}: {
  children: ReactNode;
  className?: string;
  /** The first line of a page, rather than a footnote under a card. */
  lead?: boolean;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <p
      className={cn(
        "leading-relaxed text-muted",
        lead ? "mt-5 mb-1 max-w-[62ch] text-[14.5px]" : "mt-2.5 text-[13px]",
        tone === "ok" && "text-success-text",
        tone === "warn" && "text-warn-text",
        tone === "danger" && "text-danger-text",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SwitchVisual({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-7 w-[46px] shrink-0 items-center rounded-full transition-colors duration-200",
        on ? "bg-accent" : "bg-track",
      )}
    >
      <span
        className={cn(
          "block size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-200 ease-out motion-reduce:transition-none",
          on ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </span>
  );
}

/* Rows — the whole line opens, taps included. */

export function ToggleRow({
  icon,
  title,
  sub,
  on,
  onChange,
  label,
  disabled,
  blockedHint,
  locked,
}: {
  icon?: ReactNode;
  title: string;
  sub: string;
  on: boolean;
  /** Absent on a locked row, which never changes anything. */
  onChange?: (next: boolean) => void;
  /** Screen-reader name; the visible title isn't always the control's label. */
  label?: string;
  /** Locked on or off — tapping says why instead of changing anything. */
  disabled?: boolean;
  blockedHint?: () => void;
  /** Shows why a disabled switch can't move. */
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ?? title}
      aria-disabled={disabled || undefined}
      onClick={() => {
        haptic("light");
        if (disabled) blockedHint?.();
        else onChange?.(!on);
      }}
      className={cn(ROW, disabled ? "cursor-not-allowed opacity-55" : LIVE)}
    >
      {icon ? <span className={CHIP}>{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5 text-[15px] font-medium">
          <span className="line-clamp-2">{title}</span>
          {locked ? <Lock className="mt-1 size-[13px] shrink-0 text-muted" strokeWidth={2} /> : null}
        </span>
        <span className={SUB}>{sub}</span>
      </span>
      <SwitchVisual on={on} />
    </button>
  );
}

/** A name, its one-line description, and the plain list of rows under it —
    no frame, just hairlines between the lines. The name sits above the list
    so the block reads as one decision with its explanation, not a form. */
export function Panel({
  title,
  sub,
  id,
  className,
  compact,
  children,
}: {
  title: ReactNode;
  sub?: string;
  /** Set on a section a jump chip scrolls to. */
  id?: string;
  className?: string;
  /** Tighter rows, for a long list you scan for one word rather than a block
      of six you stop and read. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn(id && "scroll-mt-20", className)}>
      <div className="mb-3 px-1">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {sub ? (
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-[1.5] text-muted">{sub}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "list-divide",
          compact && "[&_a]:py-[11px] [&_button]:py-[11px]",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function LinkRow({
  href,
  icon,
  title,
  sub,
  right,
  disabled,
  blockedHint,
  compact,
  danger,
  accent,
}: {
  href: string;
  icon?: ReactNode;
  title: string;
  sub?: string;
  /** Short value shown before the chevron — a count, a name, a date. */
  right?: ReactNode;
  /** The page it leads to can't be used yet; tapping says why. */
  disabled?: boolean;
  blockedHint?: () => void;
  /** A list that should read as one line per row on a phone — the explanation
      is there on a bigger screen, and in the page itself once you're in. */
  compact?: boolean;
  /** Leads somewhere that takes something away. */
  danger?: boolean;
  /** Leads to an editor rather than to a report. */
  accent?: boolean;
}) {
  const inner = (
    <>
      {icon ? (
        <span className={cn(CHIP, danger && "text-danger-text", accent && !danger && "text-accent-text")}>{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn(TITLE, compact && "text-[16px] font-medium sm:text-[15px]", danger && "text-danger-text", accent && !danger && "text-accent-text")}>{title}</span>
        {sub ? <span className={cn(SUB, compact && "hidden sm:block")}>{sub}</span> : null}
      </span>
      <Trailing right={right} chevron={accent && !danger ? "text-accent-text" : undefined} />
    </>
  );
  if (disabled) {
    return (
      <button
        type="button"
        aria-disabled
        onClick={() => {
          haptic("light");
          blockedHint?.();
        }}
        className={cn(ROW, "cursor-not-allowed opacity-50")}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={href}
      onClick={() => haptic("light")}
      className={cn(ROW, danger ? "text-danger-text hover:bg-danger/8 active:bg-danger/15" : LIVE)}
    >
      {inner}
    </Link>
  );
}

/** `accent` puts the row's own name in the link colour. Every page is full of
    rows that only report a fact; the ones that open an editor should say so
    before you read the sub-line. */
export function ActionRow({
  icon,
  title,
  sub,
  onClick,
  right,
  danger,
  accent,
  disabled,
  blockedHint,
  opens,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  onClick: () => void;
  right?: ReactNode;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
  blockedHint?: () => void;
  /** False when the row acts in place, so it doesn't point at a page. */
  opens?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        if (disabled) blockedHint?.();
        else onClick();
      }}
      className={cn(
        ROW,
        disabled ? "cursor-not-allowed opacity-55" : danger ? "text-danger-text hover:bg-danger/8 active:bg-danger/15" : LIVE,
      )}
    >
      {icon ? (
        <span className={cn(CHIP, danger && "text-danger-text", accent && !danger && "text-accent-text")}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn(TITLE, danger && "text-danger-text", accent && !danger && "text-accent-text")}>
          {title}
        </span>
        {sub ? <span className={SUB}>{sub}</span> : null}
      </span>
      {opens === false && !right ? null : (
        <Trailing right={right} chevron={accent && !danger ? "text-accent-text" : undefined} />
      )}
    </button>
  );
}

/** A choice made right here in the list — tapping moves the dot, nothing opens. */
export function OptionRow({
  icon,
  title,
  sub,
  selected,
  onSelect,
  label,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  selected: boolean;
  onSelect: () => void;
  /** Screen-reader name when the visible title isn't the whole answer. */
  label?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label ?? title}
      onClick={() => {
        haptic("selection");
        onSelect();
      }}
      className={cn(ROW, LIVE)}
    >
      {icon ? (
        <span className={cn(CHIP, selected && "text-accent-text")}>{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={TITLE}>{title}</span>
        {sub ? <span className={SUB}>{sub}</span> : null}
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-accent" : "border-track",
        )}
      >
        {selected ? <span className="size-2.5 rounded-full bg-accent" /> : null}
      </span>
    </button>
  );
}

/** A read-only line in a card: the fact and its value, no chevron. The value
    sits under its label rather than pinned to the right edge — a long one is
    the common case, and right-aligned values either clip or push the label
    into a column two words wide. */
export function StaticRow({
  icon,
  title,
  sub,
  right,
}: {
  icon?: ReactNode;
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={ROW}>
      {icon ? <span className={CHIP}>{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className={TITLE}>{title}</span>
        {sub ? <span className={SUB}>{sub}</span> : null}
      </span>
      {right ? <span className="shrink-0 text-[13px] text-muted">{right}</span> : null}
    </div>
  );
}

function Trailing({ right, chevron }: { right?: ReactNode; chevron?: string }) {
  if (!right) return <ChevronRight className={cn("size-[18px] shrink-0", chevron ?? "text-muted")} strokeWidth={2} />;
  return (
    <span className="flex shrink-0 items-center gap-2 text-muted">
      <span className="text-[13px] tabular-nums">{right}</span>
      <ChevronRight className={cn("size-[18px]", chevron)} strokeWidth={2} />
    </span>
  );
}

/* ── The last decision on a page ─────────────────────────────────
   Some confirmations are the screen itself rather than a row on one, so
   the buttons sit full-width at the bottom of the page, loudest first. */

/** Actions stack down the column on a phone — the way a phone dialog lays them
    out, one full-width decision per row — and sit beside each other once there
    is room. Nothing about a label is allowed to push past the button. */
export function PillStack({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">{children}</div>;
}

const PILL_TONE = PILL_FILL;


export function PillButton({
  label,
  onClick,
  href,
  tone = "primary",
  icon,
  sub,
  disabled,
}: {
  label: string;
  /** Where it goes, when the button is a page rather than an action. */
  href?: string;
  onClick?: () => void;
  /** What the button gives up — the loudest fill is the most final. */
  tone?: keyof typeof PILL_TONE;
  icon?: ReactNode;
  /** One line of consequence, printed under the button. */
  sub?: string;
  disabled?: boolean;
}) {
  const go = () => {
    haptic(tone === "outline" ? "light" : "medium");
    onClick?.();
  };
  const shared = cn(
    PILL_BASE,
    PILL_TONE[tone],
    disabled && PILL_DISABLED,
  );
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      {href ? (
        <Link href={href} onClick={go} className={shared}>
          {icon}
          <span className="min-w-0">{label}</span>
        </Link>
      ) : (
        <button type="button" onClick={go} disabled={disabled} className={shared}>
          {icon}
          <span className="min-w-0">{label}</span>
        </button>
      )}
      {sub ? (
        <span className="px-1 text-center text-[12.5px] leading-snug text-muted">{sub}</span>
      ) : null}
    </span>
  );
}

/* ── Lines inside a sheet ───────────────────────────────────────── */

const SHEET_ROW =
 "flex w-full items-center gap-4 px-4 py-4 text-left outline-none transition-colors sm:px-5";

export function SheetAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
      className={cn(
        SHEET_ROW,
        danger ? "text-danger-text hover:bg-danger/8 active:bg-danger/15" : "hover:bg-surface-2/60 active:bg-surface-2/80",
      )}
    >
      <span className={cn("shrink-0", danger ? "text-danger-text" : "text-muted")}>{icon}</span>
      <span className="min-w-0 flex-1 text-[15px] font-medium">{label}</span>
    </button>
  );
}

export function SheetButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
      className={cn(
        SHEET_ROW,
        danger ? "text-danger-text hover:bg-danger/8 active:bg-danger/15" : "hover:bg-surface-2/60 active:bg-surface-2/80",
      )}
    >
      <span className="min-w-0 flex-1 text-[15px] font-medium">{label}</span>
    </button>
  );
}

/** Sheets list their choices and actions under a hairline. */
export function SheetGroup({ children }: { children: ReactNode }) {
  return <div className="-mx-4 mt-5 list-divide border-t border-divider sm:-mx-5">{children}</div>;
}
