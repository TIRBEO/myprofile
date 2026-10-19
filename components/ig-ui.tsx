"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
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
import { ChevronDown, Eye, EyeOff, Loader2, Search, X } from "lucide-react";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Tirbeo — account primitives

   The controls the settings screens build with. Two families:

     Overlays   Sheet / SheetOption / SheetActions — the bottom sheet on
                phones, the centred dialog from `sm` up
     Controls   Button / IconButton / Segmented / Chip / Input / Textarea /
                Select / Field / PasswordField / SearchField

   The surfaces these sit on are NOT here: the page column, the grouped
   plate, the row and the section header all live in
   components/settings-shell, which is the one vocabulary the 38 settings
   routes are written against. Keeping the list anatomy in one file is
   what stops a row meaning two different heights on two screens.
   ═══════════════════════════════════════════════════════════════════ */

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ── Buttons ────────────────────────────────────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

/* The three fills, written once. `Button` names them by variant and the
   page-ending action pills name them by tone, but they are the same skins —
   spelling them out twice is how one gets tuned and the other left behind. */
const FILL = {
  /* The landing's filled action: the accessible accent-solid blue, never the
     lighter system blue that fails contrast under white text. */
  primary: "bg-accent-solid text-accent-fg hover:bg-accent-solid-hover active:bg-accent-solid-hover",
  /* Apple's secondary is a filled grey, not an outlined one. The label has to
     be the accent colour for that to read as a control: a grey pill with grey
     words beside a blue one is indistinguishable from a disabled pair, and
     the fill alone carries no "you can press this" at all. */
  secondary: "bg-fill text-accent-text hover:bg-fill-hover active:bg-fill-press",
  danger: "bg-danger text-accent-fg hover:bg-danger-hover active:brightness-95",
} as const;

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: FILL.primary,
  secondary: FILL.secondary,
  ghost: "text-text-3 hover:bg-hover hover:text-fg",
  danger: FILL.danger,
  link: "min-h-12 rounded-full px-2 text-[15px] font-semibold text-text-3 hover:text-fg",
};

/** Every action button in settings is built from these two, so a "Save" and a
    "Delete" can't drift apart in size, only in fill. Compact by design: the
    pill hugs its label on wide screens and only stretches to the column on a
    phone, the way iOS draws a confirmation action. */
export const PILL_BASE =
  "inline-flex min-h-[48px] w-full max-w-full sm:w-auto items-center justify-center gap-2 rounded-full px-5 py-2 " +
  "text-center text-[15px] leading-snug font-semibold tracking-[-0.01em] outline-none transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const PILL_FILL = {
  primary: FILL.primary,
  danger: FILL.danger,
  /** The quiet action beside a loud one. `outline` is the name 60 call sites
      use for "the not-primary button"; it is no longer an outline, because
      Apple draws that one filled with `systemFill` and labelled in the accent
      colour — the blue words are what stop it reading as a disabled control. */
  outline: FILL.secondary,
} as const;

/** A filled button that can't be used yet still has to read as accent-coloured, or as
    red, rather than turning into a grey slab nobody can parse. */
export const PILL_DISABLED = "pointer-events-none opacity-55";

/** The sheet's two footer buttons: one skin, two fills. A confirm that is a
    pixel taller than the Cancel beside it is only ever noticed side by side. */
const SHEET_ACTION =
  "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 " +
  "text-[15px] font-semibold tracking-[-0.01em] outline-none transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-12 rounded-full px-5 text-[14px] gap-2",
  md: "h-[48px] rounded-full px-6 text-[15px] gap-2",
  lg: "h-[52px] rounded-full px-7 text-[15px] gap-2",
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
        "inline-flex touch-manipulation items-center justify-center font-semibold tracking-[-0.01em] whitespace-nowrap",
        "transition-[filter,background-color,opacity] duration-150 active:scale-[0.995]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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

/** Round icon button — Instagram's transport and toolbar circles. The
    default is 40px, but any caller that supplies its own `size-…` class
    (an inline 8px eye, a 76px avatar picker) keeps it: Tailwind's order,
    not the attribute's, decides which of two size utilities wins. */
export function IconButton({
  label,
  icon,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }) {
  const sized = /(^|\s)size-/.test(className ?? "");
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-fg outline-none",
        !sized && "size-10",
        "transition-colors duration-100 hover:bg-hover active:bg-field-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      {icon}
    </button>
  );
}

/** Segmented control. Exactly one option is active — the accounts recipe:
    a plate container with a raised pill on the choice. */
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
      className={cn("flex gap-1 rounded-full border border-border bg-surface-2 p-1", block && "w-full")}
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
              "flex-1 rounded-full text-center font-semibold whitespace-nowrap",
              "transition-all duration-150",
              size === "sm" ? "h-8 text-[13px]" : "h-9 text-[14px]",
              active
                ? "bg-card text-fg shadow-[var(--shadow-ambient)]"
                : "bg-transparent text-text-3 hover:text-fg",
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

/* The accounts/landing field: a 48px plate with a hairline that turns accent
   on focus, plus the landing's soft focus ring. 14px is the field corner the
   accounts card uses, so a control inside a 20px card is the same family
   rather than a slightly rounder rectangle dropped on top. */
const CONTROL =
  "w-full rounded-[14px] border border-border bg-field px-4 text-[16px] text-fg outline-none " +
  "placeholder:text-placeholder " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "hover:bg-field-hover " +
  "focus:border-ig-hover focus:bg-field-focus " +
  "focus:shadow-[0_0_0_3px_var(--accent-soft-ring)] focus:outline-none " +
  "disabled:opacity-50";

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
        invalid && "!border-danger",
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
        "resize-none py-3 leading-relaxed",
        invalid && "!border-danger",
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
      <select ref={ref} {...rest} className={cn(CONTROL, "h-12 cursor-pointer appearance-none pr-11 [&>option]:bg-card", className)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-text-4" />
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
          <span id={`${uid}-label`} className="tb-label mb-0">
            {label}
          </span>
          {action}
        </div>
      ) : null}
      <label className="block">{control}</label>
      {error ? (
        <p id={noteId} role="alert" className="tb-hint tb-error">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="tb-hint max-w-[62ch]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A password box with the usual way to check what was typed in it. Sits in a
    `Field` the same way an `Input` does, so the label and the error line up. */
export function PasswordField({
  value,
  onChange,
  onKeyDown,
  placeholder = "Your password",
  autoComplete = "current-password",
  autoFocus = false,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: "current-password" | "new-password";
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        className="pr-11"
      />
      <IconButton
        label={visible ? "Hide password" : "Show password"}
        icon={visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          "absolute right-1.5 top-1/2 size-8 -translate-y-1/2 after:absolute after:-inset-1.5 after:content-['']",
          visible ? "bg-hover text-fg" : "text-text-4 hover:text-fg",
        )}
      />
    </div>
  );
}

/* ── Chips ──────────────────────────────────────────────────────── */

/**
 * Toggle chip — the filter and jump pills. One primitive, so a row of
 * filters is always the same 36px rounded-full on a hairline, with the
 * selected one filled accent the way Instagram fills a chosen filter.
 */
export function Chip({
  active,
  onClick,
  children,
  dot,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
  /** A category's colour, for filter rows that key off it. */
  dot?: ReactNode;
}) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={active || undefined}
      onClick={(e) => {
        if (onClick) haptic("selection");
        onClick?.(e);
      }}
      className={cn(
        "inline-flex min-h-9 touch-manipulation items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap outline-none transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? "border-transparent bg-accent-solid text-accent-fg hover:bg-accent-solid-hover"
          : "border-border-strong bg-transparent text-text-2 hover:bg-hover hover:text-fg",
        className,
      )}
    >
      {dot}
      {children}
    </button>
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
        <span className="mb-4 flex size-14 items-center justify-center rounded-[20px] border border-border bg-card text-text-4 shadow-[var(--shadow-card)]">
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
          "h-10 rounded-full bg-field pr-10 pl-10",
          "[&::-webkit-search-cancel-button]:hidden",
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

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
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

  /* A sheet that is refused — edit-profile's X when a required field is still
     empty — must heal. The exit animations leave the sheet out of sight while
     its full-screen wrapper stays mounted and swallows every click on the page
     behind it, so the app looks frozen. A parent that closes unconditionally
     unmounts us at 300ms, before this fires; if we are still mounted and the
     sheet is out of sight (faded, or slid below the viewport on a phone), put
     it back. */
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const scrim = panel.closest('[role="dialog"]')?.firstElementChild;
      const faded = scrim ? Number(getComputedStyle(scrim).opacity) < 0.05 : false;
      const slidOut = panel.getBoundingClientRect().top >= window.innerHeight - 4;
      if (faded || slidOut) {
        setClosing(false);
        setDrag(null);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [closing]);

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
              "rounded-t-[20px] border border-border bg-card",
              "shadow-[0_-30px_90px_-20px_rgb(0_0_0/0.7)]",
              "sm:rounded-[20px] sm:shadow-[var(--shadow-pop)]",
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
                    <h2 className="text-[20px] leading-snug font-semibold tracking-[-0.02em] text-balance">
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

/** A choice made inside a sheet — the same 17px line, 15px explanation and
    accent radio the settings rows use, so a decision taken in a sheet is not
    drawn in a second type scale. */
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
      className="group flex min-h-[48px] w-full items-center gap-4 px-4 py-4 text-left outline-none transition-colors hover:bg-hover active:bg-field-focus sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[17px] leading-[1.35] font-medium",
            selected ? "text-fg" : "text-text-2",
          )}
        >
          {children}
        </span>
        {description ? (
          <span className="mt-[3px] block max-w-[56ch] text-[15px] leading-[1.45] text-text-3">{description}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          selected ? "border-ig" : "border-track group-hover:border-text-4",
        )}
      >
        <span
          className={cn(
            "size-2.5 rounded-full bg-ig transition-transform duration-150",
            selected ? "scale-100" : "scale-0",
          )}
        />
      </span>
    </button>
  );
}

/** The two buttons at the bottom of a sheet. The one that does something is
    filled — accent-coloured when it builds or changes, red when it takes something away —
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
  /* Instagram's dialog actions: a `systemFill` way out beside a filled
     decision, both full pills, stacked on a phone with the action under the
     thumb. Blue when it builds, red when it takes something away. */
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || loading}
        className={cn(
          SHEET_ACTION,
          confirmVariant === "danger" ? PILL_FILL.danger : PILL_FILL.primary,
          (disabled || loading) && PILL_DISABLED,
        )}
      >
        {loading ? <Loader2 className="size-4 animate-spin-slow" /> : null}
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => (deferredClose ? deferredClose() : onCancel())}
        className={cn(SHEET_ACTION, PILL_FILL.outline)}
      >
        {cancelLabel}
      </button>
    </div>
  );
}

/**
 * Escape-to-close plus scroll lock, for overlays built by hand (the
 * navigation drawer). `Sheet` composes this internally.
 *
 * The lock is reference-counted and lives on <html>, not <body>: two overlays
 * stacked (a sheet opening a confirm on top of it) used to hand the body back
 * its old `overflow: hidden` when the inner one closed, which left the page
 * unscrollable for good. The scrollbar slot is reserved by
 * `scrollbar-gutter: stable` in globals.css, so nothing is added to the
 * padding — that compensation is what made the page jump sideways the instant
 * a popup opened.
 */
let overlaysOpen = 0;

function lockPageScroll() {
  const root = document.documentElement;
  if (overlaysOpen++ === 0) root.setAttribute("data-scroll-lock", "1");
  return () => {
    overlaysOpen = Math.max(0, overlaysOpen - 1);
    if (!overlaysOpen) root.removeAttribute("data-scroll-lock");
  };
}

export function useOverlay(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const unlock = lockPageScroll();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      unlock();
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

