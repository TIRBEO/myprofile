"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  createContext,
  forwardRef,
  cloneElement,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Tirbeo — account primitives

   Mobile-first app shell. Three surfaces carry the whole UI:
     Page / PageHeader   large-title screen that scrolls under the glass bar
     Section / List      inset grouped lists, iOS-style
     Sheet               bottom sheet on phones, centred dialog from sm up
   Everything else is a control that plugs into a List row.
   ═══════════════════════════════════════════════════════════════════ */

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "accent" | "success" | "danger" | "warn" | "muted";

const CHIP: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg",
  accent: "bg-accent/12 text-accent-text",
  success: "bg-success/12 text-success-text",
  danger: "bg-danger/12 text-danger-text",
  warn: "bg-warn/12 text-warn-text",
  muted: "bg-surface-2 text-muted",
};

const BANNER: Record<Tone, { shell: string; icon: string }> = {
  neutral: { shell: "border-border bg-surface-2", icon: "bg-surface-3 text-fg" },
  accent: { shell: "border-accent/20 bg-accent/[0.06]", icon: "bg-accent/15 text-accent-text" },
  success: { shell: "border-success/20 bg-success/[0.06]", icon: "bg-success/15 text-success-text" },
  danger: { shell: "border-danger/20 bg-danger/[0.06]", icon: "bg-danger/15 text-danger-text" },
  warn: { shell: "border-warn/20 bg-warn/[0.06]", icon: "bg-warn/15 text-warn-text" },
  muted: { shell: "border-border bg-surface-2", icon: "bg-surface-3 text-muted" },
};

/* ── Layout ─────────────────────────────────────────────────────── */

/** Content column. Bottom padding clears the mobile tab bar. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("shell-page", className)}>{children}</div>;
}

/**
 * Large screen title. The glass app bar fades in its own copy of this
 * title once the header has scrolled out from under it.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Small caption under the title. */
  eyebrow?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pt-6 pb-6">
      <div className="min-w-0">
        <h1 className="truncate text-[21px] leading-tight font-bold tracking-[-0.02em]">
          {title}
        </h1>
        {eyebrow || description ? (
          <div className="mt-1">
            {eyebrow ? <p className="text-[13px] font-medium text-muted">{eyebrow}</p> : null}
            {description ? (
              <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-10", className)}>
      {title ? (
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <div className="rule-label min-w-0 flex-1">
            <span className="label shrink-0">{title}</span>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {description ? (
        <p className="-mt-1 mb-3.5 max-w-[62ch] text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** Plain raised surface with no implied row semantics. */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface shadow-[0_14px_36px_-24px_rgb(0_0_0/0.4)]", padded && "p-5", className)}>
      {children}
    </div>
  );
}

/**
 * Rows separated by hairlines and bounded by a single rule above and
 * below — not a boxed card. `plain` drops the bounds entirely, for
 * lists that already sit inside a Sheet.
 */
export function List({
  children,
  className,
  plain = false,
}: {
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <div className={cn(plain ? "list-divide" : "grouped", className)}>
      {children}
    </div>
  );
}

/* ── The workhorse row ──────────────────────────────────────────── */

type ListRowProps = {
  label: ReactNode;
  description?: ReactNode;
  /** Small rounded bubble to the left. */
  icon?: ReactNode;
  iconTone?: Tone;
  /** Replaces the icon bubble entirely (avatar, brand logo, …). */
  leading?: ReactNode;
  /** Secondary line at the right, before the trailing cluster. */
  value?: ReactNode;
  /** Replaces the whole trailing cluster. */
  trailing?: ReactNode;
  /** Trailing switch — the row itself becomes the tap target. */
  on?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  tone?: "default" | "danger";
  /** Defaults to true when `href` is set. */
  chevron?: boolean;
  className?: string;
};

export function ListRow({
  label,
  description,
  icon,
  iconTone = "neutral",
  leading,
  value,
  trailing,
  on,
  onChange,
  disabled,
  href,
  external,
  onClick,
  tone = "default",
  chevron,
  className,
}: ListRowProps) {
  const showChevron = chevron ?? Boolean(href);
  const interactive = Boolean(href || onClick || on);
  const activate = () => {
    haptic("light");
    onClick?.();
  };

  const body = (
    <>
      {leading ? (
        <span className="shrink-0">{leading}</span>
      ) : icon ? (
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-[10px] border border-border",
            CHIP[iconTone],
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[14.5px] leading-snug font-medium",
            tone === "danger" ? "text-danger-text" : "text-fg",
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block max-w-[56ch] text-[13px] leading-snug text-muted">{description}</span>
        ) : null}
      </span>

      {value ? <span className="mono shrink-0 text-[13px] text-muted">{value}</span> : null}
      {trailing}
      {on ? (
        <Switch
          on={Boolean(on)}
          onChange={(next) => {
            haptic("light");
            onChange?.(next);
          }}
          label={typeof label === "string" ? label : undefined}
        />
      ) : null}
      {showChevron ? <ChevronRight className="size-4 shrink-0 text-muted/60" /> : null}
    </>
  );

  const cls = cn(
    "group flex w-full min-h-[3.5rem] items-center gap-4 px-1 py-4 text-left",
    "transition-colors duration-100",
    interactive && !disabled && "hover:bg-surface-2/60 active:bg-surface-2",
    disabled && "opacity-45",
    className,
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={activate}>
          {body}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} onClick={activate}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={activate} disabled={disabled} className={cls}>
        {body}
      </button>
    );
  }

  return <div className={cls}>{body}</div>;
}

/* ── Controls ───────────────────────────────────────────────────── */

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-7 w-[46px] shrink-0 items-center rounded-full",
        "transition-colors duration-200",
        on ? "bg-accent" : "bg-track",
        disabled && "opacity-45",
      )}
    >
      <span
        className={cn(
          "block size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)]",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          on ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110 active:brightness-95",
  secondary: "border border-border bg-transparent text-fg hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
  link: "text-accent-text hover:underline px-0",
};

/** Every full-width action button in settings is built from these two, so a
    "Save" and a "Delete" can't drift apart in size, only in fill. */
export const PILL_BASE =
  "flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 " +
  "text-center text-[14.5px] leading-snug font-semibold outline-none transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const PILL_FILL = {
  primary: "bg-accent text-accent-fg hover:brightness-110 active:brightness-95",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
  /** The way out is filled too — a bordered ghost next to a solid blue button
      reads as the disabled one. */
  outline: "bg-surface-3 text-fg hover:brightness-110 active:brightness-95",
} as const;

/** A filled button that can't be used yet still has to read as blue, or as
    red, rather than turning into a grey slab nobody can parse. */
export const PILL_DISABLED = "pointer-events-none opacity-55";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-10 rounded-lg px-3.5 text-[13px] gap-1.5",
  md: "h-11 rounded-xl px-4 text-[14.5px] gap-2",
  lg: "h-[46px] rounded-xl px-5 text-[14.5px] gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={cn(
        "inline-flex touch-manipulation items-center justify-center font-semibold whitespace-nowrap",
        "transition-[filter,background-color,transform,opacity] duration-100 active:scale-[0.985]",
        "disabled:pointer-events-none disabled:opacity-45",
        variant === "link" ? "text-[14px] font-medium" : BUTTON_SIZE[size],
        BUTTON_VARIANT[variant],
        block && "w-full",
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin-slow" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-fg",
        "transition-colors duration-100 hover:bg-surface-2 active:bg-surface-3",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      {icon}
    </button>
  );
}

/** Segmented control. Exactly one option is active. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  block = true,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (next: T) => void;
  size?: "sm" | "md";
  block?: boolean;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1 rounded-[13px] bg-surface-2 p-1", block && "w-full")}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) haptic("selection");
              onChange(opt.value);
            }}
            className={cn(
              "flex-1 rounded-[10px] text-center font-semibold whitespace-nowrap",
              "transition-all duration-150",
              size === "sm" ? "h-8 text-[13px]" : "h-10 text-[14px]",
              active
                ? "bg-accent text-accent-fg"
                : "bg-transparent text-muted hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Form controls ──────────────────────────────────────────────── */

/* A field is a line, not a box: the label sits above an underline and the
   typed value carries no fill of its own. A grey box inside a card is a box
   inside a box, and it makes a short answer look like a sunken panel. The rule
   under the text is the field; it turns blue while it has focus and red when
   the answer is wrong. */
const CONTROL =
  "w-full border-0 border-b border-border bg-transparent px-0 py-2 text-[15.5px] text-fg outline-none " +
  "placeholder:text-muted/60 " +
  "transition-colors duration-150 " +
  "focus:border-accent focus:outline-none disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        "h-12",
        invalid && "border-danger/70",
        className,
      )}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        "resize-none leading-relaxed",
        invalid && "border-danger/70",
        className,
      )}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }
>(function Select({ className, options, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} {...rest} className={cn(CONTROL, "h-12 appearance-none pr-8", className)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
});

/**
 * Label + control + hint/error. The label sits outside the `<label>` so the
 * "forgot?" style action beside it isn't part of the field's name — which
 * means the link has to be made by hand: the control gets an id, the label
 * text gets its own, and an error or hint is named as the field's description
 * so it is read out with the field rather than somewhere else on the page.
 */
export function Field({
  label,
  hint,
  error,
  action,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  error?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const uid = useId();
  const noteId = `${uid}-note`;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? `${uid}-field`,
        ...(label ? { "aria-labelledby": `${uid}-label` } : null),
        ...(error || hint ? { "aria-describedby": noteId } : null),
      })
    : children;

  return (
    <div className={cn("px-4 py-4 sm:px-5", className)}>
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <span id={`${uid}-label`} className="label">
            {label}
          </span>
          {action}
        </div>
      ) : null}
      <label className="block">{control}</label>
      {error ? (
        <p id={noteId} className="mono mt-2 text-[12px] text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ── Display ────────────────────────────────────────────────────── */

export function Pill({
  children,
  tone = "neutral",
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-current/25 px-2 py-[3px] font-mono text-[10.5px] font-medium tracking-[0.08em] uppercase",
        CHIP[tone],
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Avatar({
  src,
  name,
  size = 48,
  className,
  ring = false,
}: {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-surface-3 font-semibold text-muted select-none",
        ring && "ring-2 ring-bg",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? "Profile photo"} className="size-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <PersonGlyph size={size} />
      )}
    </span>
  );
}

function PersonGlyph({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size * 0.5, height: size * 0.5 }}
      aria-hidden
    >
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/** Compact metric tile — device counts, channel counts, totals. */
export function Stat({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {icon ? (
        <span className={cn("flex size-7 items-center justify-center rounded-[9px]", CHIP[tone])}>
          {icon}
        </span>
      ) : null}
      <span className="tabular text-[20px] leading-none font-bold tracking-[-0.02em]">{value}</span>
      <span className="label truncate">{label}</span>
    </div>
  );
}

/** Definition grid for session and profile details. */
export function KeyValue({
  rows,
  columns = 2,
}: {
  rows: { key: string; value: ReactNode; mono?: boolean; icon?: ReactNode }[];
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3.5",
        columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}
    >
      {rows.map((r) => (
        <div key={r.key} className="min-w-0">
          <dt className="label flex items-center gap-1.5">
            {r.icon}
            {r.key}
          </dt>
          <dd className={cn("mt-1 text-[14px] font-medium break-words", r.mono && "font-mono text-[13px]")}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Banner({
  tone = "neutral",
  icon,
  title,
  action,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const skin = BANNER[tone];
  return (
    <div className={cn("rounded-2xl border px-4 py-4", skin.shell, className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            className={cn(
              "mt-px grid size-8 shrink-0 place-items-center rounded-full",
              skin.icon,
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {title ? <p className="text-[14px] leading-snug font-semibold">{title}</p> : null}
          {children ? <div className="mt-1 text-[13px] leading-relaxed text-muted">{children}</div> : null}
          {action ? <div className="mt-3.5 flex flex-wrap gap-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? (
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
          {icon}
        </span>
      ) : null}
      <p className="text-[16px] font-semibold">{title}</p>
      {description ? (
        <p className="mt-2 max-w-[36ch] text-[14px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Height-animated collapse. Children stay mounted, so form state survives. */
export function Disclosure({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/* ── Timeline ───────────────────────────────────────────────────── */

export function Timeline({ children }: { children: ReactNode }) {
  return (
    <ol className="relative space-y-3 before:absolute before:top-6 before:bottom-6 before:left-5 before:w-px before:bg-border">
      {children}
    </ol>
  );
}

export function TimelineItem({
  icon,
  tone = "neutral",
  title,
  meta,
  badge,
  children,
}: {
  icon?: ReactNode;
  tone?: Tone;
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-3.5">
      <span
        className={cn(
          "z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border",
          CHIP[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-4">
        <p className="flex flex-wrap items-center gap-2 text-[14.5px] leading-snug font-semibold">
          {title}
          {badge}
        </p>
        {meta ? <p className="mt-0.5 text-[13px] text-muted">{meta}</p> : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </li>
  );
}

/* ── Misc ───────────────────────────────────────────────────────── */

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  autoFocus,
  onKeyDown,
  inputRef,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        type="search"
        aria-label={placeholder}
        className={cn(
          CONTROL,
          "h-11 rounded-full pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
 className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1.5 text-muted outline-none transition-colors hover:text-fg after:absolute after:-inset-2 after:content-['']"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin-slow", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("hairline", className)} role="separator" />;
}

/* ── Sheet ──────────────────────────────────────────────────────── */

/** Lets SheetActions route Cancel through the sheet's exit animation. */
const SheetDeferredClose = createContext<(() => void) | null>(null);

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Portalled to
 * <body>, scroll-locked, Escape-dismissible, with a Tab trap.
 *
 * On mobile the sheet is a two-stage surface: it opens to a comfortable
 * height and can be pulled up (or the grabber tapped) to grow to full
 * height when there is more to see, then pushed back down. A further
 * downward pull dismisses it. Everything below the grabber scrolls.
 */
export function Sheet({
  title,
  description,
  onClose,
  footer,
  children,
  width = "md",
}: {
  title?: string;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  /** Optional — a confirm-only sheet is just a title and a footer. */
  children?: ReactNode;
  width?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Exit animation: dismiss gestures linger mounted just long enough to
  // play sheet-down/scale-out before the parent unmounts us.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  function startClose() {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => closeRef.current(), 300);
  }

  useOverlay(startClose);

  // Phone layout (bottom sheet) vs desktop (centred dialog).
  const [isPhone, setIsPhone] = useState(false);
  // Whether the content needs more room than the screen has.
  const [tall, setTall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // A sheet with more in it than fits opens at full height, so nothing
  // worth editing is ever parked below the fold waiting for a drag.
  // `moreBelow` drives the fade at the bottom edge: a clipped field looks
  // exactly like a finished form, so the page has to say there is more.
  const [moreBelow, setMoreBelow] = useState(false);
  const checkScroll = useRef(() => {});
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    checkScroll.current = () => setMoreBelow(body.scrollHeight - body.scrollTop - body.clientHeight > 12);
    checkScroll.current();
    body.addEventListener("scroll", checkScroll.current, { passive: true });
    return () => body.removeEventListener("scroll", checkScroll.current);
  }, [children]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setTall(body.scrollHeight - body.clientHeight > 4);
      checkScroll.current();
    });
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  // Drag the handle or header down and the sheet follows the finger,
  // then leaves on a long pull or a downward flick.
  const [drag, setDrag] = useState<{ y: number; releasing: boolean } | null>(null);
  const dragMeta = useRef({ startY: 0, lastY: 0, lastT: 0, v: 0 });
  const snapTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (snapTimer.current) window.clearTimeout(snapTimer.current);
    },
    [],
  );

  function onDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (closing || drag !== null) return;
    if (!window.matchMedia("(max-width: 640px)").matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMeta.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), v: 0 };
    setDrag({ y: 0, releasing: false });
  }
  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.releasing) return;
    const m = dragMeta.current;
    const now = performance.now();
    const dt = Math.max(1, now - m.lastT);
    m.v = (e.clientY - m.lastY) / dt;
    m.lastY = e.clientY;
    m.lastT = now;
    setDrag({ y: e.clientY - m.startY, releasing: false });
  }
  function onDragEnd() {
    if (!drag || drag.releasing) return;
    const { y } = drag;
    const flickDown = dragMeta.current.v > 0.65;
    if (y > 110 || (flickDown && y > 40)) {
      setDrag({ y: window.innerHeight, releasing: true });
      closeTimer.current = window.setTimeout(() => closeRef.current(), 330);
    } else {
      setDrag({ y: 0, releasing: true });
      snapTimer.current = window.setTimeout(() => setDrag(null), 260);
    }
  }
  const dragHandlers = {
    onPointerDown: onDragStart,
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  };

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const selector =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(
        (n) => n.offsetWidth > 0 || n.offsetHeight > 0,
      );

    const restoreTo = document.activeElement as HTMLElement | null;
    // Defer a frame so entry animation doesn't fight scroll-into-view.
    // The header's X is the first focusable on every sheet, and it is never the
    // answer: landing there means Enter dismisses a sheet the user meant to
    // fill, and Tab has to walk back past the title.
    const raf = requestAnimationFrame(() => {
      const items = focusables();
      const firstField = panel.querySelector<HTMLElement>(
        "input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
      );
      (firstField ?? items.find((n) => !n.hasAttribute("data-sheet-close")))?.focus();
    });

    // Escape is handled by useOverlay; this only owns the Tab cycle.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? items[i <= 0 ? items.length - 1 : i - 1]
        : items[i === items.length - 1 ? 0 : i + 1];
      e.preventDefault();
      next?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      restoreTo?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  // Only a downward drag moves the sheet; pulling it up does nothing,
  // because at full height there is nothing above to reveal.
  const dragY = drag ? Math.max(0, drag.y) : 0;
  const scrimFade = drag && drag.y > 0 ? Math.max(0, 1 - drag.y / 320) : 1;

  return createPortal(
    <SheetDeferredClose.Provider value={startClose}>
      <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
        <div
          className={cn(
            "absolute inset-0 bg-scrim backdrop-blur-[6px]",
            drag !== null
              ? ""
              : closing
                ? "animate-fade-out"
                : "animate-fade-in",
          )}
          style={drag ? { opacity: scrimFade } : undefined}
          onClick={startClose}
        />

        <div
          className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) startClose();
          }}
        >
          <div
            ref={panelRef}
            className={cn(
              "relative flex w-full flex-col overflow-hidden",
              drag === null &&
                (closing
                  ? "animate-sheet-down sm:animate-scale-out"
                  : "animate-sheet-up sm:animate-scale-in"),
              "rounded-t-[34px] bg-surface",
              "shadow-[0_-30px_90px_-20px_rgb(0_0_0/0.7)]",
              "sm:rounded-[30px] sm:border sm:border-border/70 sm:shadow-[0_44px_120px_-24px_rgb(0_0_0/0.75)]",
              width === "lg" ? "sm:max-w-[560px]" : "sm:max-w-[420px]",
            )}
            style={{
              maxHeight: "92dvh",
              // Phone: full height when there's a lot in it, otherwise snug.
              height: isPhone ? (tall ? "92dvh" : "auto") : undefined,
              ...(drag
                ? {
                    transform: `translateY(${dragY}px)`,
                    transition: drag.releasing
                      ? "height 300ms cubic-bezier(0.32, 0, 0.67, 0), transform 300ms cubic-bezier(0.32, 0, 0.67, 0)"
                      : "transform 0ms",
                    willChange: "transform",
                  }
                : {
                    transition:
                      "height 300ms cubic-bezier(0.32, 0.72, 0, 1), transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
                  }),
            }}
          >
            <div
              className="flex shrink-0 touch-none select-none justify-center pt-3 pb-1 sm:hidden"
              {...dragHandlers}
              aria-hidden
            >
              <span className="h-1 w-12 rounded-full bg-fg/15" />
            </div>

            {title || description ? (
              <div
                className="relative flex shrink-0 touch-none select-none items-start gap-2 px-4 pt-2 pb-5 sm:px-5 sm:pt-7"
                {...dragHandlers}
              >
                <div className="min-w-0 flex-1">
                  {title ? (
                    <h2 className="text-[19px] leading-snug font-bold tracking-[-0.02em] text-balance">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="mt-1.5 max-w-[44ch] text-[13.5px] leading-relaxed text-muted">
                      {description}
                    </p>
                  ) : null}
                </div>
                {/* The way out is visible rather than a swipe you have to know
                    about, but it is never where the keyboard lands first —
                    landing here would let Enter dismiss a sheet you meant to
                    answer. */}
                <button
                  type="button"
                  data-sheet-close
                  onClick={startClose}
                  aria-label="Close"
 className="relative -mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg after:absolute after:-inset-1 after:content-['']"
                >
                  <X className="size-[19px]" strokeWidth={2} />
                </button>
              </div>
            ) : (
              <div className="relative shrink-0 touch-none sm:hidden" {...dragHandlers} aria-hidden>
                <div className="h-4 w-full" />
              </div>
            )}

            {children ? (
              <div
                ref={bodyRef}
                className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-2 sm:px-5"
              >
                {children}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none sticky bottom-0 -mt-14 h-14 bg-gradient-to-t from-surface via-surface/80 to-transparent transition-opacity duration-200",
                    moreBelow ? "opacity-100" : "opacity-0",
                  )}
                />
              </div>
            ) : null}

            {footer ? (
              <div className="relative shrink-0 border-t border-divider px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pt-4 sm:pb-[calc(20px+env(safe-area-inset-bottom,0px))]">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </SheetDeferredClose.Provider>,
    document.body,
  );
}

/** Radio row for sheets and settings pages. */
export function SheetOption({
  children,
  selected,
  onClick,
  description,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  description?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => {
        haptic("selection");
        onClick();
      }}
 className="group flex w-full items-center gap-4 px-4 py-4 text-left outline-none transition-colors hover:bg-surface-2/60 active:bg-surface-2/80 sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-medium",
            selected ? "text-fg" : "text-fg/90",
          )}
        >
          {children}
        </span>
        {description ? (
          <span className="mt-0.5 block max-w-[56ch] text-[13px] leading-snug text-muted">{description}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150",
          selected ? "border-fg" : "border-track group-hover:border-muted/60",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full bg-fg transition-transform duration-150",
            selected ? "scale-100" : "scale-0",
          )}
        />
      </span>
    </button>
  );
}

/** The two buttons at the bottom of a sheet. The one that does something is
    filled — blue when it builds or changes, red when it takes something away —
    so the difference between "Save" and "Delete" is a colour, not a sentence. */
export function SheetActions({
  onCancel,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  disabled,
  loading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const deferredClose = useContext(SheetDeferredClose);
  /* The bar runs edge to edge under the rule the footer already draws, and the
     two halves are split by a hairline, so the sheet ends on lines rather than
     on two floating pills. Cancel is the quiet half; the action keeps its
     colour — blue when it saves, red when it takes something away. */
  return (
    <div className="-mx-4 -mb-[calc(14px+env(safe-area-inset-bottom,0px))] flex sm:-mx-5 sm:-mb-[calc(20px+env(safe-area-inset-bottom,0px))]">
      <button
        type="button"
        onClick={() => (deferredClose ? deferredClose() : onCancel())}
 className="min-w-0 flex-1 py-4 text-center text-[15px] font-medium text-muted outline-none transition-colors hover:bg-surface-2/60 hover:text-fg"
      >
        {cancelLabel}
      </button>
      <span aria-hidden className="w-px shrink-0 bg-divider" />
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || loading}
        className={cn(
 "min-w-0 flex-1 py-4 text-center text-[15px] font-semibold outline-none transition-colors",
          confirmVariant === "danger"
            ? "text-danger-text hover:bg-danger/8"
            : "text-accent-text hover:bg-accent/8",
          (disabled || loading) && "pointer-events-none opacity-45",
        )}
      >
        {loading ? <Loader2 className="mr-1 inline size-4 animate-spin-slow align-[-2px]" /> : null}
        {confirmLabel}
      </button>
    </div>
  );
}

/**
 * Escape-to-close plus scroll lock, for overlays built by hand (the
 * navigation drawer). `Sheet` composes this internally.
 */
export function useOverlay(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

/**
 * Runs a save handler at most once at a time. Stale calls are dropped
 * rather than queued, so double-tapping Save can't fire two writes.
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async (fn: () => void | Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}

/* ── Legacy settings-page API ─────────────────────────────────────
   The settings screens were written against this vocabulary
   (Panel / CardGroup / ToggleRow / Modal …). Kept as thin wrappers
   over the primitives above so old and new pages share one system.
   ═══════════════════════════════════════════════════════════════ */

/** Settings screen: page column + big title + trailing content. */
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Page className={className}>
      <PageHeader title={title} />
      {children}
    </Page>
  );
}

/** Small uppercase label between groups. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 mb-2 px-1 text-[13px] font-semibold text-muted first:mt-0">
      {children}
    </h2>
  );
}

/** Grouped list. `clip` drops the outer border. */
export function CardGroup({
  children,
  className,
  clip = true,
}: {
  children: ReactNode;
  className?: string;
  clip?: boolean;
}) {
  return <List className={className} plain={!clip}>{children}</List>;
}

/*
 * Label + control row that sits inside a CardGroup. The control is
 * rendered below the label, like IG's stacked field rows.
 */
export function FieldRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-3.5 sm:px-5", className)}>
      <div className="mb-2">
        <FieldLabel>{label}</FieldLabel>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
      {children}
    </div>
  );
}

/** Select styled like the legacy SelectField — forwardRef for form reads. */
export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }
>(function SelectField({ className, options, ...rest }, ref) {
  return <Select ref={ref} className={className} options={options} {...rest} />;
});

/** Lightweight inline toast for legacy pages. */
export function Toast({
  kind,
  message,
}: {
  kind: "success" | "error";
  message: string;
}) {
  return (
    <Banner tone={kind === "success" ? "success" : "danger"} className="mt-4">
      {message}
    </Banner>
  );
}

/** Toggle row built on ListRow's trailing-switch mode. */
export function ToggleRow({
  label,
  sub,
  defaultOn = false,
  on,
  onChange,
}: {
  label: string;
  sub?: string;
  /** Uncontrolled initial state for static rows. */
  defaultOn?: boolean;
  /** Controlled mode overrides defaultOn. */
  on?: boolean;
  onChange?: (next: boolean) => void;
}) {
  const [internal, setInternal] = useState(defaultOn);
  const isOn = on ?? internal;
  return (
    <ListRow
      label={label}
      description={sub}
      on={isOn}
      onChange={(next) => {
        if (on === undefined) setInternal(next);
        onChange?.(next);
      }}
    />
  );
}

export function SwitchRow(props: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return <ToggleRow {...props} />;
}

/** Small status chip. */
export function StatusPill({
  children,
  tone = "success",
}: {
  children: ReactNode;
  tone?: "success" | "muted" | "danger";
}) {
  return <Pill tone={tone}>{children}</Pill>;
}

/** Label + hint text pair used above and below groups. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[13px] font-medium text-fg">{children}</span>;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{children}</p>;
}

/** Accent-tinted summary card with icon, pill and trailing control. */
export function HighlightCard({
  icon,
  title,
  pill,
  sub,
  active = false,
  right,
}: {
  icon: ReactNode;
  title: string;
  pill?: ReactNode;
  sub?: string;
  active?: boolean;
  right?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border p-4 transition-colors",
        active ? "border-accent/40 bg-accent/8" : "border-border bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
          active ? CHIP.accent : CHIP.neutral,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{title}</span>
          {pill}
        </span>
        {sub ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{sub}</span>
        ) : null}
      </span>
      {right}
    </div>
  );
}

/**
 * Title + body modal. Portalled, scroll-locked, Escape-dismissible.
 * Children fill the body; buttons are laid out by the caller.
 */
export function Modal({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  function startClose() {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => closeRef.current(), 300);
  }

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const firstField = panel.querySelector<HTMLElement>(
      "input, select, textarea",
    );
    (firstField ?? panel.querySelector<HTMLElement>("button"))?.focus();
  }, []);

  useOverlay(startClose);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-end justify-center bg-scrim backdrop-blur-[6px] sm:items-center sm:p-6",
        closing ? "animate-fade-out" : "animate-fade-in",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) startClose();
      }}
      data-overlay
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full max-w-md overflow-hidden rounded-t-[34px] bg-surface",
          closing
            ? "animate-sheet-down sm:animate-scale-out"
            : "animate-sheet-up sm:animate-scale-in",
          "shadow-[0_-30px_90px_-20px_rgb(0_0_0/0.7)]",
          "sm:rounded-[30px] sm:border sm:border-border/70 sm:shadow-[0_44px_120px_-24px_rgb(0_0_0/0.75)]",
        )}
      >
        <div className="px-6 pt-4 pb-1 sm:pt-6">
          <div className="min-w-0">
            <h2 className="text-[19px] leading-snug font-bold tracking-[-0.02em] text-balance">{title}</h2>
            {sub ? (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{sub}</p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Radio-style option row inside a Modal body. */
export function ModalOption({
  children,
  selected,
  onClick,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return <SheetOption selected={selected} onClick={onClick}>{children}</SheetOption>;
}

/** Dialog action button. */
export function DialogButton({
  variant = "secondary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "secondary" | "accent" }) {
  return (
    <Button
      {...rest}
      variant={variant === "accent" ? "primary" : "secondary"}
      className={cn("flex-1", className)}
    />
  );
}

/** Plain grouped container (legacy alias of CardGroup). */
export function Group({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <CardGroup className={className}>{children}</CardGroup>;
}
