"use client";

/* ════════════════════════════════════════════════════════════════════
   OAuth completion screen — the Accounts app's sign-in surface

   Visual design: the same shell the accounts app signs people in with,
   through the classes ported into globals.css — `.login-page` canvas (pure
   black with one soft falloff, no photograph), a transparent borderless
   `.login-card` column that scales in em, `--field` plates, the single
   indigo action fill, and the fixed wordmark + legal bar. No glass plate: an
   account is created on the same surface that signs people in, so it looks
   like it.

   ─────────────────────────────────────────────────────────────
   All logic preserved: API calls (oauth/pending, username-exists,
   oauth/complete, oauth-consent), state management, debounced username
   check, file upload validation, form submission, avatar editor, legal
   modal, and ALL content text.
   ════════════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Check, X, Eye, EyeOff, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import { createPortal } from "react-dom";
import { ProfilePicture } from "@/components/profile-picture";
import { AvatarEditor } from "@/components/avatar-editor";
import { ProviderGlyph } from "@/components/provider-glyph";
import { Skeleton, Spinner } from "@/components/ig-ui";
import { haptic } from "@/lib/haptics";
import { emailDomain, trackError, trackEvent, withRef } from "@/lib/telemetry";

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function apiBase(): string {
  if (typeof window !== "undefined") {
    const parent = window.location.hostname.match(/(?:^|\.)(tirbeo\.(?:com|app))$/i);
    if (parent) return `${window.location.protocol}//api.${parent[1].toLowerCase()}`;
  }
  return process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://api.tirbeo.com");
}

/** The picked file has to survive the same round trip the account does — a
    5 MB cap keeps a phone's full-resolution export from bloating the row. */
const PHOTO_LIMIT = 5 * 1024 * 1024;

type ExistingPreview = {
  name: string;
  username: string | null;
  photoUrl: string | null;
};

type Pending = {
  email: string;
  name: string;
  photoUrl: string | null;
  provider?: string;
  /** An account already uses this provider email — offer linking, not a duplicate. */
  existingAccount?: boolean;
  /** This provider identity is already connected to a Tirbeo account. */
  existingLink?: boolean;
  /** The account that already owns this email, enough of it to recognise. */
  existing?: ExistingPreview | null;
  /** Accounts-app merge screen for this provider identity, pre-authorized by a
      fresh signed token. Present only when a merge is actually possible. */
  mergeUrl?: string | null;
};

type PendingError = {error: string; retryable?: boolean};

/** One question per token, however many times the screen mounts (dev reloads,
    StrictMode double mounts). The endpoint is stateless; this just keeps the
    noise down and the answer consistent across remounts. */
const pendingQueries = new Map<string, Promise<Pending & Partial<PendingError>>>();
function fetchPending(token: string): Promise<Pending & Partial<PendingError>> {
  const existing = pendingQueries.get(token);
  if (existing) return existing;
  const q = fetch(`${apiBase()}/api/auth/oauth/pending?token=${encodeURIComponent(token)}`, {
    credentials: "include",
  })
    .then((r) => r.json())
    .then((d) => {
      if (d?.error) { pendingQueries.delete(token); return { ...d, error: d.error } as Pending & PendingError; }
      return d as Pending;
    })
    .catch((err) => {
      // The page shows its own retry message; telemetry keeps the cause.
      trackError("oauth-complete.fetch-pending", err);
      pendingQueries.delete(token);
      return { email: "", name: "", photoUrl: null, error: "Tirbeo couldn't be reached. Check your connection and try again.", retryable: true } as Pending & PendingError;
    });
  pendingQueries.set(token, q);
  return q;
}

/** Ask the account service again, ignoring the cached answer. Used when a
    create attempt comes back saying the address was claimed — the form on
    screen is now the wrong question, and the fresh answer carries the merge
    offer for the account that appeared. */
async function recheckPending(token: string): Promise<Pending & Partial<PendingError>> {
  pendingQueries.delete(token);
  return fetchPending(token);
}

/** Where the accounts app lives — it owns sign-in, so "link to my existing
    account" hands the person over there. With a token the pending provider
    identity gets attached as soon as they land in; without one this is the
    plain entry screen, which is the right place for "that isn't me". */
function accountsHost(): string {
  let base = "";
  if (typeof window !== "undefined") {
    const parent = window.location.hostname.match(/(?:^|\.)(tirbeo\.(?:com|app))$/i);
    if (parent) base = `${window.location.protocol}//accounts.${parent[1].toLowerCase()}`;
  }
  if (!base) {
    const fromEnv = process.env.NEXT_PUBLIC_ACCOUNTS_URL;
    base = fromEnv && (process.env.NODE_ENV !== "production" || !/localhost|127\.0\.0\.1/.test(fromEnv))
      ? fromEnv.replace(/\/+$/, "")
      : process.env.NODE_ENV === "development" ? "http://localhost:3002" : "https://accounts.tirbeo.com";
  }
  return base;
}

function accountsLoginUrl(token?: string | null, redirectTo?: string): string {
  const url = new URL(`${accountsHost()}/login`);
  if (token) url.searchParams.set("link_token", token);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/** Restart the provider handshake. Used when this identity is already
    connected to an account: the callback then signs the person straight in
    instead of bringing them back to a create screen. */
function providerStartUrl(provider: string | undefined, redirectTo?: string): string {
  if (!provider) return accountsLoginUrl(null, redirectTo);
  const url = new URL(`${apiBase()}/api/auth/${provider}`);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/** The providers' own capitalisation — "Github" reads like a typo of the brand. */
const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

type LegalKind = "terms" | "privacy";

const LEGAL: Record<LegalKind, { title: string; intro: string; sections: { title: string; body: string }[] }> = {
  terms: {
    title: "Terms of Service",
    intro:
      "By creating an account or using Tirbeo you agree to these terms. They are short on purpose.",
    sections: [
      {
        title: "Your account",
        body: "You are responsible for keeping your credentials private and for what happens under your account. Tell us straight away if you think someone else has it.",
      },
      {
        title: "What you may do with it",
        body: "Tirbeo gives you a limited, non-exclusive, non-transferable licence to use the service as it is meant to be used.",
      },
      {
        title: "Ending it",
        body: "You can close your account at any time from your settings. We can suspend or stop providing the service where an account is used to harm it or the people on it.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "What Tirbeo collects, why it collects it, and what it does not do with it.",
    sections: [
      {
        title: "What we collect",
        body: "What you type into your profile, and what your device tells us — sign-in times, the addresses you connect from, and the browser you used. A provider sign-in also brings your name, email and picture from that provider.",
      },
      {
        title: "Why we keep it",
        body: "To run the account you asked for, to tell you when something signs in that we did not expect, and to answer you when you write to support.",
      },
      {
        title: "What we do not do",
        body: "We do not sell your personal data. A sign-in partner receives only the parameters needed to check who you are, and support staff can look inside an account only when that account said yes to it.",
      },
    ],
  },
};

/* ──────────────────────────────────────────────────────────────
   Page primitives — the accounts auth kit, class for class: one pill
   shape for every action, the indigo accent for the fill, field plates behind a
   label, and no card of its own (the .login-card in globals.css is that).
   ═════════════════════════════════════════════════════════════ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
};

/* The shared `.btn` pill from globals (the landing recipe) — the auth card
   and the settings app are one family, so this page names the classes instead
   of spelling the shape a fourth time. */
const BUTTON_BASE = "btn btn-block relative";

const BUTTON_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

/** Primary — the accounts `.login-cta` recipe: accounts-blue fill, darker on
    press, the disabled plate rather than a faded-out button. On a
    type="submit" inside the card, globals.css adds the gradient + lift. */
function Button({
  loading,
  variant = "secondary",
  size = "lg",
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        BUTTON_BASE,
        BUTTON_SIZE[size],
        variant === "primary" ? "btn-primary" : "btn-secondary",
        className,
      )}
      {...rest}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {loading ? <Spinner size={16} /> : null}
        {children}
      </span>
    </button>
  );
}

/** Inline text action — colour carries the affordance, 48px hit area. */
function TextAction({children, className, ...rest}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "btn-link w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Label above, hint/error below — no box around the control. */
function Field({label, hint, error, required, optional, children, className}: {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label ? (
        <label className="tb-label">
          {label}
          {required ? <span className="text-accent-2"> *</span> : null}
          {optional ? <span className="font-normal text-text-4"> (optional)</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="tb-hint tb-error">{error}</p>
      ) : hint ? (
        <p className="tb-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/* The accounts field plate: a solid fill that warms on hover and lights
   accent-coloured on focus. Height and radius come from globals.css (.login-card input)
   so the plates are the same 58px/16px as the accounts sign-in form. */
const CONTROL =
  "w-full rounded-lg border border-border bg-field px-4 text-[16px] text-fg " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "placeholder:text-placeholder " +
  "hover:bg-field-hover " +
  "focus:border-ig-hover focus:bg-field-focus focus:shadow-[0_0_0_3px_var(--accent-soft-ring)] focus:outline-none " +
  "disabled:opacity-50";

/** Text input — accounts field styling (bg-field plate, rounded-2xl, h-12). */
function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  spellCheck,
  required,
  invalid,
  className,
  id,
  onKeyDown,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  spellCheck?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      required={required}
      aria-invalid={invalid}
      className={cn(
        CONTROL,
        invalid &&
          "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(240,86,106,0.25)]",
        className,
      )}
    />
  );
}

/** Password field — IG control + the reveal toggle. */
function PasswordField({
  value,
  onChange,
  placeholder = "At least 8 characters",
  autoComplete = "new-password",
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: "current-password" | "new-password";
  className?: string;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(CONTROL, "pr-12")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full text-text-4",
          "hover:bg-hover hover:text-fg",
          "transition-colors",
          visible ? "bg-field-focus text-fg" : "",
        )}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** IG consent checkbox — matches accounts ConsentCheck: a hairline square
    that fills the white when on, with a black check mark SVG.

    A span, not a button: the label carries Terms/Privacy buttons, and a
    <button> may not contain another one (invalid HTML, hydration error). */
function Checkbox({checked, onChange, children}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  const toggle = () => {
    haptic("selection");
    onChange(!checked);
  };
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer items-start gap-3 rounded-xl text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-press",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-[1px] grid size-5 shrink-0 place-items-center rounded-[6px] border-2 transition-colors duration-150",
          checked ? "border-accent bg-accent" : "border-track group-hover:border-border-strong",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 24 24" className="size-3.5 text-accent-fg" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-text-2">{children}</span>
    </span>
  );
}

/** The two legal documents, as inline buttons inside the consent label. */
function Agreement({onOpen}: {onOpen: (kind: LegalKind) => void}) {
  const link = "font-semibold text-fg underline underline-offset-2";
  return (
    <>
      I agree to the{" "}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); haptic("light"); onOpen("terms"); }}
        className={link}
      >
        Terms of Service
      </button>{" "}
      and the{" "}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); haptic("light"); onOpen("privacy"); }}
        className={link}
      >
        Privacy Policy
      </button>
      , and confirm the details above are mine.
    </>
  );
}

/** IG toggle row — the indigo accent when on, the track colour when off. */
function ToggleRow({title, sub, on, onChange}: {
  title: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="min-w-0 flex-1 pr-4">
        <span className="block text-[14.5px] font-medium text-fg">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-text-3">{sub}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        /* A switch with no name is announced as just "switch, off" — the label
           sits in a sibling column, so it has to be named explicitly. */
        aria-label={title}
        onClick={() => {
          haptic("light");
          onChange(!on);
        }}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
          on ? "bg-accent" : "bg-track",
        )}
      >
        <span
          className={cn(
            "block size-6 rounded-full bg-accent-fg shadow-[0_1px_3px_rgb(0_0_0/0.35)]",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            on ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </div>
  );
}

/** Username availability badge — shows below the username field. */
function UsernameStatus({state, message}: {
  state: "idle" | "checking" | "available" | "taken" | "reserved" | "invalid" | "error";
  message: string;
}) {
  if (state === "idle" || !message) return null;
  let tone: string;
  let icon: React.ReactNode;
  if (state === "checking") {
    tone = "text-text-3";
    icon = <Spinner size={13} />;
  } else if (state === "available") {
    tone = "text-success-text";
    icon = <Check className="size-[14px]" strokeWidth={3} />;
  } else if (state === "error") {
    // The service failed, not the name. Amber, and it must not block submit.
    tone = "text-warn-text";
    icon = <TriangleAlert className="size-[14px]" strokeWidth={2.5} />;
  } else {
    tone = "text-danger-text";
    icon = <X className="size-[14px]" strokeWidth={3} />;
  }
  return (
    <p className={cn("tb-hint flex items-center gap-1.5 font-medium", tone)}>
      {icon}
      {message}
    </p>
  );
}

/** Skeleton loader while the pending data is fetched — the app's one
    `.skeleton` shimmer, same as every settings page. */
function PanelSkeleton() {
  return (
    <div className="space-y-6" aria-busy={true}>
      <div className="flex flex-col items-center gap-4">
        <span className="skeleton size-28 rounded-full" />
        <span className="skeleton block h-[18px] w-[60%] rounded" />
        <span className="skeleton block h-[13px] w-[80%] rounded" />
      </div>
      <span className="skeleton block h-[48px] rounded-2xl" />
      <span className="skeleton block h-[48px] rounded-2xl" />
      <span className="skeleton block h-[48px] rounded-2xl" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Logo — the accounts BrandMark wordmark: two cuts (dark ink for
   the light canvas, white for the black one), one shown via the
   `.brand-mark` rules in globals.css; `.page-brand` parks it in
   the top-left corner at every width.
   ═════════════════════════════════════════════════════════════ */

function BrandMark({className = ""}: {className?: string}) {
  return (
    <>
      <img
        src="/logo-dark.webp"
        alt="Tirbeo"
        width={600}
        height={200}
        decoding="async"
        className={cn("brand-mark h-[30px] w-auto object-contain", className)}
      />
      <img
        src="/logo-white.webp"
        alt="Tirbeo"
        width={600}
        height={200}
        decoding="async"
        className={cn("brand-mark h-[30px] w-auto object-contain", className)}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Legal modal — the accounts sheet look: dimmed canvas scrim,
   frosted glass plate on a hairline, 22px corners.

   It portals to <body>, outside the .login-page subtree, so it carries
   the .auth-dark pin itself — otherwise a light-theme visitor got a
   white-on-white sheet.
   ═════════════════════════════════════════════════════════════ */

function LegalModal({kind, onClose}: {kind: LegalKind; onClose: () => void}) {
  const doc = LEGAL[kind];
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="auth-dark fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
    >
      {/* Scrim — canvas, dimmed */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-[2px]" />

      {/* Panel — glass plate on a hairline */}
      <div
        className={cn(
          "relative z-[91] flex w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-hairline bg-glass-2 text-fg backdrop-blur-xl sm:max-w-3xl sm:rounded-2xl",
          "shadow-[0_32px_100px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07)]",
        )}
        onClick={(e) => e.stopPropagation()}
        style={{maxHeight: "80dvh"}}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-field text-text-2">
              {kind === "terms" ? (
                <FileText className="size-[18px]" />
              ) : (
                <ShieldCheck className="size-[18px]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[22px] text-fg">{doc.title}</h2>
              <p className="text-[15px] text-text-4">Tirbeo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full border-none bg-transparent text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="space-y-5 py-1">
            {doc.sections.map((section) => (
              <section key={section.title}>
              <h3 className="text-[15px] font-semibold text-fg">{section.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-3">{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-divider p-6">
          <button
            type="button"
            onClick={onClose}
            className={cn(BUTTON_BASE, BUTTON_SIZE.md, "btn-primary")}
          >
            I understand
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────
   Main page
   ═════════════────────────────────────────────────────────── */

function Complete() {
  const params = useSearchParams();
  const signupToken = params.get("signup");
  const consentToken = params.get("consent");
  const finishing = params.get("finish") === "1";
  const redirectTo = params.get("redirect_to");

  const [pending, setPending] = useState<Pending | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadRetryable, setLoadRetryable] = useState(false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [staffAccess, setStaffAccess] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  /* The handle is checked against the live account table the moment the typing
     stops, so a taken name is caught here rather than after the person has
     filled the whole form and pressed the one button. */
  const [usernameState, setUsernameState] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved" | "invalid" | "error"
  >("idle");
  const [usernameMsg, setUsernameMsg] = useState("");

  /* The token is signed and short-lived; this only asks the account service to
     read it back, so the provider's own words (which address, which name) are
     on the screen rather than anything typed in here. */
  useEffect(() => {
    if (!signupToken) return;
    let dead = false;
    fetchPending(signupToken)
      .then((d) => {
        if (dead) return;
        if (d?.error) {
          setLoadError(d.error);
          setLoadRetryable(!!d.retryable);
        } else {
          setPending(d as Pending);
          setName(d.name || "");
          setPhoto(d.photoUrl || null);
        }
      });
    return () => {
      dead = true;
    };
  }, [signupToken]);

  /* Debounced availability probe. A name shorter than 3 characters or one that
     fails the shape rule is answered locally — the endpoint is only worth a
     round trip for something that could actually be taken. */
  useEffect(() => {
    if (!signupToken) return;
    const handle = username.trim().toLowerCase();
    if (!handle) {
      setUsernameState("idle");
      setUsernameMsg("");
      return;
    }
    if (handle.length < 3 || handle.length > 30 || !/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(handle)) {
      setUsernameState("invalid");
      setUsernameMsg("3–30 characters: letters, numbers, - or _.");
      return;
    }
    setUsernameState("checking");
    setUsernameMsg("Checking…");
    let dead = false;
    const timer = setTimeout(() => {
      fetch(`${apiBase()}/api/auth/username-exists`, {
        method: "POST",
        credentials: "include",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({username: handle}),
      })
        .then(async (r) => {
          const d = await r.json().catch(() => null);
          if (dead) return;
          // A failed lookup says nothing about the name. Treating it as
          // "invalid" blamed the person's typing for the service being down.
          if (!r.ok || !d) {
            setUsernameState("error");
            setUsernameMsg("Couldn't check availability — the name is verified when you submit.");
            return;
          }
          if (d.valid === false) {
            setUsernameState("invalid");
            setUsernameMsg("3–30 characters: letters, numbers, - or _.");
          } else if (d?.reserved) {
            setUsernameState("reserved");
            setUsernameMsg("That name is reserved.");
          } else if (d?.taken || d?.exists) {
            setUsernameState("taken");
            setUsernameMsg("That username is already taken.");
          } else if (d?.available) {
            setUsernameState("available");
            setUsernameMsg(`${handle} is available.`);
          } else {
            setUsernameState("error");
            setUsernameMsg("Couldn't check availability — the name is verified when you submit.");
          }
        })
        .catch((err) => {
          trackError("oauth-complete.username-check", err);
          if (!dead) {
            setUsernameState("idle");
            setUsernameMsg("");
          }
        });
    }, 500);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [signupToken, username]);

  const finishTarget = redirectTo || "/settings";
  const providerName = PROVIDER_LABELS[pending?.provider ?? ""] ?? "your provider";

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      haptic("error");
      setError("That file isn't a photo.");
      return;
    }
    if (file.size > PHOTO_LIMIT) {
      haptic("error");
      setError("That image is larger than 5 MB — pick a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditorSrc(String(reader.result));
    reader.onerror = () => setError("Your browser couldn't open that photo.");
    reader.readAsDataURL(file);
  }

  /* Metadata for the auth telemetry: provider and the email's DOMAIN only —
     telemetry never carries the address, the token or the password. */
  function authMeta() {
    return {
      provider: pending?.provider || undefined,
      emailDomain: emailDomain(pending?.email),
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !accepted) return;
    setError("");
    setBusy(true);
    haptic("medium");
    try {
      const path = signupToken ? "/api/auth/oauth/complete" : "/api/auth/oauth-consent";
      const res = await fetch(`${apiBase()}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(
          signupToken
            ? {
                token: signupToken,
                username,
                name: name || undefined,
                password: password || undefined,
                photoUrl: photo || undefined,
                policyAccepted: accepted,
                adminDataAccess: staffAccess,
              }
            : {
                policyAccepted: accepted,
                adminDataAccess: staffAccess,
                consentToken: consentToken || undefined,
              },
        ),
      });
      const d = await res.json().catch(() => ({}));
      /* A closed account is answered with a session and the decision of record
         (blockedAccountResponse in the account service). The settings gate is
         the one place that explains a closure, so hand the person there. */
      if (d?.blocked) {
        window.location.href = "/settings";
        return;
      }
      if (!res.ok || !d?.ok) {
        /* An address claimed while this form was open is not a mistake to
           repeat. Ask again, and show what the person can do with the account
           that turned up — merge or sign in — instead of a dead end. */
        if (d?.accountExists && signupToken) {
          const fresh = await recheckPending(signupToken);
          if (fresh.existingAccount || fresh.existingLink) {
            setPending(fresh);
            trackEvent("auth.login_failed", {
              detail: "account_exists",
              metadata: authMeta(),
            });
            haptic("error");
            setBusy(false);
            return;
          }
        }
        /* The account's reason beats ours: a taken username, a breached
           password, an expired link — each needs a different fix. */
        const reason = d?.error || "Tirbeo couldn't finish this. Please try again.";
        trackEvent("auth.login_failed", {
          detail: signupToken ? "oauth_complete_refused" : "consent_refused",
          metadata: { ...authMeta(), status: res.status },
        });
        // A refusal carrying an event id gets quoted, so support can find it.
        setError(withRef(reason, { data: d }));
        // The server has the last word on the name, so make the field say so
        // and keep "Create account" disabled until it is changed.
        if (d?.usernameTaken) {
          setUsernameState("taken");
          setUsernameMsg("That username is already taken.");
        }
        haptic("error");
        setBusy(false);
        return;
      }
      trackEvent("auth.oauth_complete", {
        detail: signupToken ? "signup" : "consent",
        metadata: authMeta(),
      });
      window.location.href = d.redirect_to || finishTarget;
    } catch (err) {
      trackError("oauth-complete.submit", err);
      trackEvent("auth.login_failed", {
        detail: "network",
        metadata: authMeta(),
      });
      setError("Tirbeo couldn't be reached. Check your connection and try again.");
      haptic("error");
      setBusy(false);
    }
  }

  /* ─────────────────────────────────────────────────────
     Shell — the accounts sign-in surface. `.login-page` paints the
     canvas (flat black, the two-tone split from 1280px up), the
     wordmark rides the top-left corner, `.login-card` is the em-scaled
     column, and the muted legal bar sits under everything. Every rule
     is globals.css, ported from the accounts app — this only assembles
     the same parts in the same order.
     ════════════════════════════════════════════════════ */
  function shell(children: React.ReactNode, opts: {
    wide?: boolean;
    lead?: React.ReactNode;
    kicker?: string;
    title?: React.ReactNode;
    sub?: React.ReactNode;
    footer?: React.ReactNode;
  } = {}) {
    return (
      <div className="login-page">
        <BrandMark className="page-brand" />

        {/* display:contents makes the card a direct child of the page, so the
            centring and the portrait bottom-sheet pin come from .login-page. */}
        <main className="contents">
          <div className="login-card animate-fade-in" data-wide={opts.wide || undefined}>
            {opts.lead || opts.title || opts.kicker || opts.sub ? (
              <header className="login-head">
                {opts.lead ? <div className="mb-4 flex justify-center">{opts.lead}</div> : null}
                {opts.kicker ? <p className="login-kicker mt-0">{opts.kicker}</p> : null}
                {opts.title ? (
                  <h1 className={cn("tb-heading", opts.kicker ? "mt-[0.42em]" : "mt-0")}>{opts.title}</h1>
                ) : null}
                {opts.sub ? <p className="tb-sub mt-[0.7em]">{opts.sub}</p> : null}
              </header>
            ) : null}

            <div className="login-form">
              {children}
              {opts.footer ? <p className="login-terms">{opts.footer}</p> : null}
            </div>
          </div>
        </main>

        <footer className="legal-bar">
          <nav className="legal-links" aria-label="Footer">
            <button type="button" onClick={() => setLegal("terms")}>Terms of Service</button>
            <button type="button" onClick={() => setLegal("privacy")}>Privacy Policy</button>
            <a href="https://tirbeo.com" target="_blank" rel="noreferrer">About</a>
            <a href="https://tirbeo.com/contact" target="_blank" rel="noreferrer">Help</a>
          </nav>
          <p className="legal-meta">
            <span>English</span>
            <span aria-hidden>·</span>
            <span>© 2026 Tirbeo</span>
          </p>
        </footer>

        {legal ? <LegalModal kind={legal} onClose={() => setLegal(null)} /> : null}

        {editorSrc ? (
          <AvatarEditor
            src={editorSrc}
            onCancel={() => setEditorSrc(null)}
            onApply={(dataUrl) => {
              setPhoto(dataUrl);
              setEditorSrc(null);
              haptic("success");
            }}
          />
        ) : null}

        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          aria-label="Choose a profile photo"
          className="sr-only"
          onChange={pickPhoto}
        />
      </div>
    );
  }

  /* ──────────────── Empty-state branch ──────────────── */
  if (!signupToken && !finishing) {
    return shell(
      <Button variant="primary" onClick={() => { window.location.href = finishTarget; }}>
        Back to Tirbeo
      </Button>,
      {
        title: "Nothing to finish",
        sub: "This page completes a Tirbeo sign-in started with Google, GitHub or Discord. Start the sign-in again and you'll land back here.",
        footer: <a href={accountsLoginUrl(null, redirectTo || undefined)}>Sign in another way</a>,
      },
    );
  }

  /* ──────────────── Link expired / service unreachable ────────────────
     Two different failures, and the person needs to know which one they are
     looking at: an expired link means start over, an unreachable service
     means the link is probably fine — just ask again. */
  if (signupToken && loadError) {
    if (loadRetryable) {
      return shell(
        <Button variant="primary" onClick={() => { window.location.reload(); }}>
          Try again
        </Button>,
        {
          title: "Tirbeo can't be reached right now",
          sub: <>{loadError} Your sign-in link is still valid, so this is worth another go rather than starting over.</>,
        },
      );
    }
    return shell(
      <Button variant="primary" onClick={() => { window.location.href = finishTarget; }}>
        Sign in again
      </Button>,
      {
        title: "That sign-in link has expired",
        sub: <>{loadError} The link lasts 15 minutes and is used once, so start the sign-in again — it takes a few seconds.</>,
      },
    );
  }

  /* ──────────────── Loading skeleton ──────────────── */
  if (signupToken && !pending) return shell(<PanelSkeleton />, {wide: true});

  /* ──────────────── Already-exists branch ────────────────
     The email or the provider identity belongs to an account Tirbeo already
     has, so creating a second one is not on the menu — no username field, no
     create button. What is offered is the two moves that keep one profile:
     merge this provider into the account above, or sign in to it first and
     let Tirbeo connect the provider afterwards. */
  if (signupToken && pending && (pending.existingAccount || pending.existingLink)) {
    const who = pending.existing;
    const canMerge = !!pending.mergeUrl;
    return shell(
      <>
        {who ? (
          <div className="flex items-center gap-3 rounded-xl border border-hairline bg-field p-3.5">
            <ProfilePicture photo={who.photoUrl} seed={pending.email} name={who.name || undefined} size={48} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-fg">
                {who.name || who.username || pending.email}
              </span>
              <span className="block truncate text-[13.5px] text-text-3">
                {who.username ? `@${who.username}` : "Already on Tirbeo"}
              </span>
            </div>
            <ShieldCheck className="size-[18px] shrink-0 text-success" aria-hidden />
          </div>
        ) : null}

        {canMerge ? (
          <>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => {
                haptic("medium");
                window.location.href = pending.mergeUrl!;
              }}
            >
              Merge {providerName} into this account
            </Button>
            <p className="tb-hint mt-2 text-center text-[13.5px] text-text-4">
              {providerName} becomes another way to sign in to the account above. Nothing is
              duplicated and nothing is lost.
            </p>
            <Button
              variant="secondary"
              size="md"
              className="mt-4"
              onClick={() => {
                haptic("light");
                window.location.href = accountsLoginUrl(signupToken, redirectTo || undefined);
              }}
            >
              Sign in to that account first
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => {
                haptic("medium");
                window.location.href = providerStartUrl(pending.provider, finishTarget);
              }}
            >
              Sign in with {providerName}
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="mt-4"
              onClick={() => {
                haptic("light");
                window.location.href = accountsLoginUrl(signupToken, redirectTo || undefined);
              }}
            >
              Sign in another way
            </Button>
          </>
        )}

        <TextAction
          className="mt-3"
          onClick={() => {
            haptic("light");
            window.location.href = accountsLoginUrl(null, redirectTo || undefined);
          }}
        >
          Not my account — use a different email
        </TextAction>
      </>,
      {
        wide: true,
        lead: <ProviderGlyph provider={pending.provider} className="size-[64px]" />,
        kicker: "One account only",
        title: pending.existingLink
          ? `${providerName} is already connected to Tirbeo`
          : "You already have a Tirbeo account",
        sub: pending.existingLink ? (
          <>
            {providerName} signed in as <span className="font-medium text-fg">{pending.email}</span>, and
            that identity is already connected to an account. Start the sign-in again and it takes you
            straight in — a second account is never created over an existing one.
          </>
        ) : (
          <>
            {providerName} signed in as <span className="font-medium text-fg">{pending.email}</span>, which
            belongs to an account Tirbeo already knows. Rather than split yourself in two, merge:{" "}
            {providerName} becomes another way into that account.
          </>
        ),
      },
    );
  }

  /* ──────────────── Main form ────────────────
     Signup: the card is the form itself — no marketing column, and on a PC
     the fields split into two. Consent-only finish: same surface, narrower. */
  if (signupToken) {
    return shell(
      <form onSubmit={submit}>
        {/* The face, editable — tapping anywhere on it opens the file picker.
            The dashed ring + accent camera chip are the accounts signup
            recipe (116px ring, 38px chip on its shoulder). */}
        <div className="relative mx-auto mb-5 grid size-[116px] place-items-center rounded-full border-2 border-dashed border-divider bg-field">
          <button
            type="button"
            onClick={() => { haptic("light"); photoRef.current?.click(); }}
            className="relative z-10 block cursor-pointer rounded-full transition-transform hover:scale-[1.03] active:scale-95"
            aria-label="Change photo"
          >
            <ProfilePicture
              photo={photo}
              seed={pending?.email || name || "tirbeo"}
              name={name || undefined}
              size={106}
            />
          </button>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-0 bottom-1 z-20 grid size-[38px] place-items-center rounded-full",
              "border-[3px] border-bg bg-accent-solid text-accent-fg",
              "shadow-[0_6px_14px_-6px_rgba(0,0,0,0.7)]",
            )}
          >
            <Camera className="size-[17px]" strokeWidth={2.25} />
          </span>
        </div>

        <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-5">
          {/* Row 1 — username left, password right */}
          <div>
            <Field label="Username" required>
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="bishnuneupane"
                autoComplete="username"
                spellCheck={false}
                required
                invalid={usernameState === "taken" || usernameState === "reserved" || usernameState === "invalid"}
                id="username-field"
              />
            </Field>

            <div className="mb-2 min-h-[22px]">
              <UsernameStatus state={usernameState} message={usernameMsg} />
            </div>
          </div>

          <div>
            <Field label="Password" optional>
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                id="password-field"
              />
            </Field>
          </div>

          {/* Row 2 — display name spans the full card width */}
          <div className="md:col-span-2">
            <Field label="Display name" optional className="mb-2">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bishnu Neupane"
                autoComplete="name"
                id="display-name-field"
              />
            </Field>
          </div>
        </div>

        {/* Agreement, support toggle, and the create button — full width */}
        <div className="mt-1 border-t border-divider pt-4">
          <Checkbox checked={accepted} onChange={setAccepted}>
            <Agreement onOpen={setLegal} />
          </Checkbox>

          <ToggleRow
            title="Let Tirbeo support see my account"
            sub="For troubleshooting when you ask for help. Optional."
            on={staffAccess}
            onChange={setStaffAccess}
          />
        </div>

        {error ? (
          <p role="alert" className="form-notice form-notice-error mt-3">{error}</p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={
            !accepted
            || busy
            || !username.trim()
            || usernameState === "taken"
            || usernameState === "reserved"
            || usernameState === "invalid"
          }
          className="mt-4"
        >
          {busy ? "Working…" : "Create account"}
        </Button>
      </form>,
      {
        wide: true,
        title: name?.trim() ? `Welcome, ${name.trim().split(/\s+/)[0]}` : "Create your account",
        sub: (
          <>
            {providerName} verified <span className="font-medium text-fg">{pending?.email}</span> — that
            is the email this account gets, and Tirbeo will not make a second one with it. Pick a
            username and you&apos;re in.
          </>
        ),
        footer: (
          <>Already have an account?{" "}
            <a href={accountsLoginUrl(null, redirectTo || undefined)}>Sign in</a>
          </>
        ),
      },
    );
  }

  return shell(
    <form onSubmit={submit}>
      <Checkbox checked={accepted} onChange={setAccepted}>
        <Agreement onOpen={setLegal} />
      </Checkbox>

      <ToggleRow
        title="Let Tirbeo support see my account"
        sub="For troubleshooting when you ask for help. Optional."
        on={staffAccess}
        onChange={setStaffAccess}
      />

      {error ? (
        <p role="alert" className="form-notice form-notice-error mt-3">{error}</p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        loading={busy}
        disabled={!accepted || busy}
        className="mt-4"
      >
        {busy ? "Working…" : "Continue"}
      </Button>
    </form>,
    {
      title: "One thing left",
      sub: "Tirbeo hasn't got your agreement on record yet. Tick it below to keep going.",
    },
  );
}

/* useSearchParams suspends on a cold load, and a blank canvas there reads as a
   dead link. This is the card the page is about to fill in, plated. */
function Splash() {
  return (
    <div className="login-page">
      <div className="login-card" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <header className="login-head">
          <Skeleton className="mx-auto h-[1.15em] w-[62%] rounded-full" />
          <Skeleton className="mx-auto mt-[0.9em] h-[0.85em] w-[84%] rounded-full" />
        </header>
        <div className="login-form space-y-3">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="mt-1 h-[42px] rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={<Splash />}>
      <Complete />
    </Suspense>
  );
}
