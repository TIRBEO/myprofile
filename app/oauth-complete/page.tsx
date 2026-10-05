"use client";

/* ════════════════════════════════════════════════════════════════════
   OAuth completion screen — Accounts app IG design

   Visual design: mirrors the Tirbeo Accounts app (accounts.tirbeo.com)
   — the Instagram-style quiet dark: canvas #101014 behind a photograph,
   a rgba(18,18,21,0.72) glass plate card with a white/[0.09] hairline,
   text in rgba(255,255,255,0.96) / 0.76 / 0.62 / 0.48, the one #0064c8
   accent for primary button fills only, transparent inputs on a
   white/[0.07] field plate, 52px rounded-xl buttons, the BrandMark
   logo from /logo-opt.png.

   ─────────────────────────────────────────────────────────────
   All logic preserved: API calls (oauth/pending, username-exists,
   oauth/complete, oauth-consent), state management, debounced username
   check, file upload validation, form submission, avatar editor, legal
   modal, and ALL content text. Only the visual design changed.
   ════════════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Check, Loader2, X, Eye, EyeOff, FileText, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { ProfilePicture } from "@/components/profile-picture";
import { AvatarEditor } from "@/components/avatar-editor";
import { haptic } from "@/lib/haptics";

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

/* ════════════════════════════════════════════════════════════════════
   IG quiet dark palette — Account app tokens, pinned here so nothing
   bleeds from the landing ember theme that used to live on this page.
   ════════════════════════════════════════════════════════════════════ */
const C = {
  canvas: "#101014",
  card: "rgba(18, 18, 21, 0.72)",
  cardBorder: "rgba(255, 255, 255, 0.09)",

  ink: "rgba(255, 255, 255, 0.96)",
  secondary: "rgba(255, 255, 255, 0.76)",
  hint: "rgba(255, 255, 255, 0.62)",
  disabled: "rgba(255, 255, 255, 0.48)",
  placeholder: "rgba(255, 255, 255, 0.45)",

  ig: "#0064c8",
  igHover: "#0058b3",
  igPress: "#004f9e",

  fieldBg: "rgba(255, 255, 255, 0.07)",
  fieldBorder: "rgba(255, 255, 255, 0.16)",
  fieldHover: "rgba(255, 255, 255, 0.25)",
  fieldFocusBorder: "rgba(255, 255, 255, 0.35)",
  focusRing: "rgba(255, 255, 255, 0.14)",

  hair: "rgba(255, 255, 255, 0.12)",
  hairStrong: "rgba(255, 255, 255, 0.18)",
  surfaceHover: "rgba(255, 255, 255, 0.08)",

  danger: "#ff7a7a",
  success: "#6fd68a",
} as const;

/* Canvas — IG quiet dark: #101014 behind the photograph (desktop only). */
const BACKDROP_STYLE: React.CSSProperties = { background: C.canvas };

const PHOTO_STYLE: React.CSSProperties = {
  backgroundImage: "url('/background.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  opacity: 1,
  filter: "saturate(1.12) brightness(0.94)",
};

/* IG's soft vignette + top sheen over the photograph. */
const VIGNETTE_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(circle 760px at 50% 40%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)," +
    "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.32) 100%)",
};

/* IG's film grain — fine, neutral. */
const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

type Pending = {
  email: string;
  name: string;
  photoUrl: string | null;
  provider?: string;
  /** An account already uses this provider email — offer linking, not a duplicate. */
  existingAccount?: boolean;
  /** This provider identity is already connected to a Tirbeo account. */
  existingLink?: boolean;
};

/** One question per token, however many times the screen mounts (dev reloads,
    StrictMode double mounts). The endpoint is stateless; this just keeps the
    noise down and the answer consistent across remounts. */
const pendingQueries = new Map<string, Promise<Pending & { error?: string }>>();
function fetchPending(token: string): Promise<Pending & { error?: string }> {
  const existing = pendingQueries.get(token);
  if (existing) return existing;
  const q = fetch(`${apiBase()}/api/auth/oauth/pending?token=${encodeURIComponent(token)}`, {
    credentials: "include",
  })
    .then((r) => r.json())
    .then((d) => {
      if (d?.error) { pendingQueries.delete(token); return { ...d, error: d.error } as Pending & { error: string }; }
      return d as Pending & { error?: string };
    })
    .catch(() => {
      pendingQueries.delete(token);
      return { email: "", name: "", photoUrl: null, error: "Tirbeo couldn't be reached. Check your connection and try again." } as Pending & { error: string };
    });
  pendingQueries.set(token, q);
  return q;
}

/** Where the accounts app lives — it owns sign-in, so "link to my existing
    account" hands the person over there with the pending provider token. */
function accountsLoginUrl(token: string, redirectTo?: string): string {
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
  const url = new URL(`${base}/login`);
  url.searchParams.set("link_token", token);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

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
   IG quiet-dark page primitives — canvas-backed shell, glass card,
   the one #0064c8 accent for fills, transparent field plates.
   ═════════════════════════════════════════════════════════════ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary";
};

/** IG action button: 52px, rounded-xl. Primary is the one place the brand
    blue is a fill; secondary is a white/[0.07] hairline ghost. */
const BUTTON_BASE =
  "relative inline-flex w-full select-none items-center justify-center gap-2 overflow-hidden " +
  "rounded-xl font-semibold normal-case tracking-[-0.01em] whitespace-nowrap " +
  "h-[52px] px-6 text-[15px] " +
  "transition-[background-color,color,border-color,opacity,transform] duration-150 " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:active:scale-100";

function Button({loading, variant = "secondary", children, className, disabled, type = "button", ...rest}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        BUTTON_BASE,
        variant === "primary"
          ? cn(
              "bg-ig text-white hover:bg-ig-hover active:bg-ig-press",
              "disabled:bg-white/[0.12] disabled:text-white/40",
            )
          : cn(
              "border border-white/[0.18] bg-transparent text-white/85",
              "hover:border-white/35 hover:bg-white/[0.04] hover:text-white",
            ),
        className,
      )}
      {...rest}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {loading ? <Loader2 className="size-4 animate-spin-slow" /> : null}
        {children}
      </span>
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
        <label className="block text-[14px] font-medium text-white/76 mb-2">
          {label}
          {required ? <span className="text-[#ff7a7a]"> *</span> : null}
          {optional ? <span className="font-normal text-white/45"> (optional)</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-2 text-[14px] leading-relaxed text-[#ff7a7a]">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-[14px] leading-relaxed text-white/62">{hint}</p>
      ) : null}
    </div>
  );
}

/* A field is a plate: white/[0.07] inside a white/[0.16] hairline, warmed to
   white/[0.35] on focus with a soft white/[0.14] ring — IG's quiet input. */
const CONTROL =
  "w-full rounded-xl border border-white/[0.16] bg-white/[0.07] px-4 text-[16px] text-white " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "placeholder:text-white/40 " +
  "hover:border-white/25 " +
  "focus:border-white/70 focus:bg-white/[0.1] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.14)] focus:outline-none " +
  "disabled:opacity-50";

/** Text input — IG field styling (white/[0.07] plate, rounded-xl, h-12). */
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
        "h-12",
        invalid &&
          "border-[#ff7a7a] focus:border-[#ff7a7a] focus:shadow-[0_0_0_3px_rgba(245,124,124,0.25)]",
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
        className={cn(CONTROL, "h-12 pr-12")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full text-white/60",
          "hover:bg-white/[0.06] hover:text-white",
          "transition-colors",
          visible ? "bg-white/[0.08] text-white" : "",
        )}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** IG consent checkbox — matches accounts ConsentCheck: a hairline square
    that fills the white when on, with a black check mark SVG. */
function Checkbox({checked, onChange, children}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => {
        haptic("selection");
        onChange(!checked);
      }}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl text-left transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-[1px] grid size-5 shrink-0 place-items-center rounded-[6px] border-2 transition-colors duration-150",
          checked ? "border-white bg-white" : "border-white/30 group-hover:border-white/60",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 24 24" className="size-3.5 text-black" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-white/80">{children}</span>
    </button>
  );
}

/** IG toggle row — #0064c8 when on, white/[0.07] track when off. */
function ToggleRow({title, sub, on, onChange}: {
  title: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="min-w-0 flex-1 pr-4">
        <span className="block text-[14.5px] font-medium text-white/90">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-white/62">{sub}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => {
          haptic("light");
          onChange(!on);
        }}
        className={cn(
          "relative inline-flex h-7 w-[46px] shrink-0 items-center rounded-full border transition-colors duration-200",
          on
            ? "border-transparent bg-[#0064c8]"
            : "border-white/[0.2] bg-white/[0.07]",
        )}
      >
        <span
          className={cn(
            "block size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)]",
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
  state: "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";
  message: string;
}) {
  if (state === "idle" || !message) return null;
  let tone: string;
  let icon: React.ReactNode;
  if (state === "checking") {
    tone = "text-white/62";
    icon = <Loader2 className="size-[13px] animate-spin-slow" />;
  } else if (state === "available") {
    tone = "text-[#6fd68a]";
    icon = <Check className="size-[14px]" strokeWidth={3} />;
  } else {
    tone = "text-[#ff7a7a]";
    icon = <X className="size-[14px]" strokeWidth={3} />;
  }
  return (
    <p className={cn("flex items-center gap-1.5 mt-1 text-[12.5px] font-medium", tone)}>
      {icon}
      {message}
    </p>
  );
}

/** Skeleton loader while the pending data is fetched. */
function PanelSkeleton() {
  return (
    <div className="space-y-6" aria-busy={true}>
      <div className="flex flex-col items-center gap-4">
        <span className="size-28 animate-pulse rounded-full bg-white/10" />
        <span className="block h-[18px] w-[60%] animate-pulse rounded bg-white/10" />
        <span className="block h-[13px] w-[80%] animate-pulse rounded bg-white/5" />
      </div>
      <span className="block h-[48px] animate-pulse rounded-xl bg-white/10" />
      <span className="block h-[48px] animate-pulse rounded-xl bg-white/10" />
      <span className="block h-[48px] animate-pulse rounded-xl bg-white/10" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Logo — IG BrandMark: logo-opt.png + word.
   ═════════════════════════════════════════════════════════════ */

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/logo-opt.png"
        alt=""
        decoding="async"
        className="h-[30px] w-auto object-contain"
      />
      <span className="font-semibold tracking-[-0.035em] text-white text-[24px]">
        Tirbeo
      </span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   Legal modal — the IG glass card: canvas-dim scrim, transparent
   rgba(18,18,21,0.72) plate with a white/[0.09] hairline.
   ═════════════════════════════════════════════════════════════ */

function LegalModal({kind, onClose}: {kind: LegalKind; onClose: () => void}) {
  const doc = LEGAL[kind];
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
    >
      {/* Scrim — canvas #101014, dimmed */}
      <div className="absolute inset-0 bg-[#101014]/75 backdrop-blur-[2px]" />

      {/* Panel — IG glass card: transparent plate, white/[0.09] hairline */}
      <div
        className={cn(
          "relative z-[91] flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl glass text-fg sm:max-w-3xl sm:rounded-3xl",
          "shadow-[0_32px_100px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07),inset_0_0_80px_rgba(0,0,0,0.55)]",
          "backdrop-blur-[40px] backdrop-saturate-150 max-sm:backdrop-blur-none max-sm:backdrop-saturate-100",
        )}
        onClick={(e) => e.stopPropagation()}
        style={{maxHeight: "80dvh"}}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/12 text-white/70">
              {kind === "terms" ? (
                <FileText className="size-[18px]" />
              ) : (
                <ShieldCheck className="size-[18px]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[22px] text-white/90">{doc.title}</h2>
              <p className="text-[15px] text-white/45">Tirbeo</p>
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
              <h3 className="text-[15px] font-semibold text-white">{section.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-white/70">{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-divider p-6">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              BUTTON_BASE,
              "bg-ig text-white hover:bg-ig-hover active:bg-ig-press",
              "disabled:bg-white/[0.12] disabled:text-white/40",
            )}
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
    "idle" | "checking" | "available" | "taken" | "reserved" | "invalid"
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
        if (d?.error) setLoadError(d.error);
        else {
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
        .then((r) => r.json())
        .then((d) => {
          if (dead) return;
          if (d?.reserved) {
            setUsernameState("reserved");
            setUsernameMsg("That name is reserved.");
          } else if (d?.taken || d?.exists) {
            setUsernameState("taken");
            setUsernameMsg("That username is already taken.");
          } else if (d?.available) {
            setUsernameState("available");
            setUsernameMsg(`${handle} is available.`);
          } else {
            setUsernameState("invalid");
            setUsernameMsg("3–30 characters: letters, numbers, - or _.");
          }
        })
        .catch(() => {
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

  const finishTarget = redirectTo || "/";
  const providerName = pending?.provider
    ? pending.provider.charAt(0).toUpperCase() + pending.provider.slice(1)
    : "your provider";

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
      if (!res.ok || !d?.ok) {
        /* The account's reason beats ours: a taken username, a breached
           password, an expired link — each needs a different fix. */
        setError(d?.error || "Tirbeo couldn't finish this. Please try again.");
        haptic("error");
        setBusy(false);
        return;
      }
      window.location.href = d.redirect_to || finishTarget;
    } catch {
      setError("Tirbeo couldn't be reached. Check your connection and try again.");
      haptic("error");
      setBusy(false);
    }
  }

  /* ─────────────────────────────────────────────────────
     Shell — the IG quiet dark: #101014 canvas behind the
     photograph, a glass-plate card with a white/[0.09] hairline,
     film grain, BrandMark at the top.
     ════════════════════════════════════════════════════ */
  function shell(children: React.ReactNode, wide = false) {
    return (
      <main
        className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-8"
        style={BACKDROP_STYLE}
      >
        {/* Photograph (desktop only) — the accounts app sf-bg backdrop */}
        <div className="absolute inset-0 hidden sm:block" style={PHOTO_STYLE} />

        {/* IG's soft vignette + top sheen over the photograph */}
        <div className="absolute inset-0 hidden sm:block" style={VIGNETTE_STYLE} />

        {/* Film grain — the IG texture, neutral opacity */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden sm:block"
          style={{backgroundImage: GRAIN_SVG, opacity: 0.035, backgroundSize: "160px 160px"}}
        />

        <div className={cn("relative z-10 w-full", wide ? "max-w-[560px]" : "max-w-[560px]")}>
          {/* Card — IG glass plate: rgba(18,18,21,0.72), white/[0.09] hairline */}
          <div
            className={cn(
              "animate-fade-in relative w-full rounded-3xl border border-white/[0.09] bg-black/75 p-6 sm:p-8",
              "shadow-[0_32px_100px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07),inset_0_0_80px_rgba(0,0,0,0.55)]",
              "max-sm:backdrop-blur-none max-sm:backdrop-saturate-100",
              "backdrop-blur-[40px] backdrop-saturate-150",
              "w-full",
              wide && "md:px-10 md:py-10",
            )}
          >
            {wide ? children : (
              <>
                <a
                  href="/"
                  aria-label="Tirbeo home"
                  className="mb-8 flex justify-center py-1 transition-opacity duration-200 hover:opacity-80"
                >
                  <BrandMark />
                </a>
                {children}
              </>
            )}
          </div>
        </div>

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
      </main>
    );
  }

  /* ──────────────── Empty-state branch ──────────────── */
  if (!signupToken && !finishing) {
    return shell(
      <>
        <h1 className="tb-heading">Nothing to finish</h1>
        <p className="tb-sub mt-1.5">
          This page completes a Tirbeo sign-in started with Google, GitHub or Discord. Start the sign-in again and you'll land back here.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => { window.location.href = finishTarget; }}>
          Back to Tirbeo
        </Button>
      </>,
    );
  }

  /* ──────────────── Expired branch ──────────────── */
  if (signupToken && loadError) {
    return shell(
      <>
        <h1 className="tb-heading">That sign-in link has expired</h1>
        <p className="tb-sub mt-1.5">
          {loadError} The link lasts 15 minutes and is used once, so start the sign-in again — it takes a few seconds.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => { window.location.href = finishTarget; }}>
          Sign in again
        </Button>
      </>,
    );
  }

  /* ──────────────── Loading skeleton ──────────────── */
  if (signupToken && !pending) return shell(<PanelSkeleton />);

  /* ──────────────── Existing-account branch ────────────────
     The email or the provider identity already belongs to an account.
     Creating a second one is the wrong answer — hand over to the accounts
     app, and after sign-in the pending provider gets linked to it. */
  if (signupToken && pending && (pending.existingAccount || pending.existingLink)) {
    return shell(
      <><h1 className="tb-heading">You already have a Tirbeo account</h1>
        <p className="tb-sub mt-1.5">
          {providerName} signed in as{" "}
          <span className="font-medium text-white">{pending.email}</span>, and that
          belongs to an account Tirbeo already knows. Rather than make a second one,
          sign in and Tirbeo will connect {providerName} to it — so next time this
          button gets you straight in.
        </p>
        <Button
          variant="primary"
          className="mt-6"
          onClick={() => {
            haptic("medium");
            window.location.href = accountsLoginUrl(signupToken, redirectTo || undefined);
          }}
        >
          Sign in &amp; connect {providerName}
        </Button>
        <button
          type="button"
          onClick={() => { haptic("light"); window.location.href = finishTarget; }}
          className="mt-4 block w-full text-center text-[13.5px] text-white/55 hover:text-white/96 transition-colors"
        >
          Not my account — go back
        </button>
      </>,
    );
  }

  /* ──────────────── Main form ────────────────
     Signup: no marketing column — the card is the form itself, and on a
     PC the fields split into two columns. Consent-only finish: the narrow
     card with its headline. */
  if (signupToken) {
    return shell(
      <form onSubmit={submit}>
        {/* The face, editable — tapping anywhere on it opens the file picker. */}
        <div className="relative mx-auto w-fit">
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
              size={88}
              ring
            />
          </button>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-1 -bottom-1 z-20 size-9 rounded-full",
              "flex items-center justify-center",
              "bg-[#0064c8] text-white",
              "border-[3px] border-[#101014]",
            )}
          >
            <Camera className="size-[17px]" strokeWidth={2.25} />
          </span>
        </div>

        <h1 className="mt-4 text-center text-[21px] font-semibold tracking-[-0.025em] text-white/96">
          {name?.trim() ? `Welcome, ${name.trim().split(/\s+/)[0]}` : "Create account"}
        </h1>

        <div className="mt-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8">
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

            <div className="min-h-[20px]">
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
        <div className="mt-1 border-t border-white/[0.08] pt-5">
          <Checkbox checked={accepted} onChange={setAccepted}>
            I agree to the{" "}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); haptic("light"); setLegal("terms"); }}
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              Terms of Service
            </button>{" "}
            and the{" "}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); haptic("light"); setLegal("privacy"); }}
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              Privacy Policy
            </button>
            , and confirm the details above are mine.
          </Checkbox>

          <ToggleRow
            title="Let Tirbeo support see my account"
            sub="For troubleshooting when you ask for help. Optional."
            on={staffAccess}
            onChange={setStaffAccess}
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-[#ff7a7a]/25 bg-[rgba(245,124,124,0.06)] px-4 py-3 text-[13.5px] text-[#ff7a7a]">
            {error}
          </p>
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
          className="mt-3"
        >
          {busy ? "Working…" : "Create account"}
        </Button>
      </form>,
      true,
    );
  }

  return shell(
    <>
      <h1 className="tb-heading">One thing left</h1>
      <p className="tb-sub mt-1.5">
        Tirbeo hasn&apos;t got your agreement on record yet. Tick it below to keep going.
      </p>

      <form onSubmit={submit} className="mt-6">
        <Checkbox checked={accepted} onChange={setAccepted}>
          I agree to the{" "}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic("light"); setLegal("terms"); }}
            className="font-semibold text-white underline-offset-2 hover:underline"
          >
            Terms of Service
          </button>{" "}
          and the{" "}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic("light"); setLegal("privacy"); }}
            className="font-semibold text-white underline-offset-2 hover:underline"
          >
            Privacy Policy
          </button>
          , and confirm the details above are mine.
        </Checkbox>

        <ToggleRow
          title="Let Tirbeo support see my account"
          sub="For troubleshooting when you ask for help. Optional."
          on={staffAccess}
          onChange={setStaffAccess}
        />

        {error ? (
          <p className="mt-4 rounded-xl border border-[#ff7a7a]/25 bg-[rgba(245,124,124,0.06)] px-4 py-3 text-[13.5px] text-[#ff7a7a]">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={!accepted || busy}
          className="mt-3"
        >
          {busy ? "Working…" : "Continue"}
        </Button>
      </form>
    </>,
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <Complete />
    </Suspense>
  );
}
