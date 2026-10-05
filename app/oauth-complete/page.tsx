"use client";

/* ═══════════════════════════════════════════════════════════════════
   OAuth completion screen

   Visual design: mirrors the tirbeo.com marketing site (apps/landing)
   — the warm ember nebula over near-black #060403, solid #181008 card
   panels with white/14 hairlines, #241812 input slabs, the one orange
   #ff6b2c for actions, Inter type, and the gradient wordmark dot.
   The palette is scoped to this page in hex (not the app's blue
   --accent tokens) so the two themes never bleed into each other.

   ─────────────────────────────────────────────────────────────
   All logic preserved: API calls (oauth/pending, username-exists,
   oauth/complete, oauth-consent), state management, debounced username
   check, file upload validation, form submission, and ALL content
   elements. The page is fully self-contained.
   ═══════════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Check, Loader2, X, Eye, EyeOff } from "lucide-react";
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

/* The landing site's palette, pinned here as constants so every value on
   this page comes from one place (apps/landing app/globals.css). */
const C = {
  canvas: "#060403",
  card: "#181008",
  input: "#241812",
  ink: "#ffffff",
  muted: "#bd9d8a",
  accent: "#ff6b2c",
  accentInk: "#0a0503",
  accentLift: "#ffb36b",
  accentDeep: "#e04e0a",
  danger: "#e5484d",
  hair: "rgba(255,255,255,0.14)",
  hairStrong: "rgba(255,255,255,0.26)",
} as const;

const NEBULA = [
  "radial-gradient(42% 55% at 78% 26%, rgba(255,130,60,0.3), transparent 66%)",
  "radial-gradient(50% 60% at 12% 78%, rgba(220,95,35,0.24), transparent 68%)",
  "radial-gradient(60% 45% at 50% 8%, rgba(120,60,30,0.22), transparent 70%)",
  "radial-gradient(35% 40% at 90% 80%, rgba(80,40,24,0.32), transparent 74%)",
  C.canvas,
].join(", ");

const GRAIN_SVG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

type Pending = {
  email: string;
  name: string;
  photoUrl: string | null;
  provider?: string;
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
   Page primitives — self-contained, landing-themed.
   ═════════════════════════════════════════════════════════════ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary";
};

/** Landing CTA skins — the orange slab for primary, a white/20 ghost for
    secondary; both lift with brightness/scale exactly like the site's. */
function Button({loading, variant = "secondary", children, className, disabled, type = "button", ...rest}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b2c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#181008]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary"
          ? "bg-[#ff6b2c] text-[#0a0503] hover:brightness-110 active:scale-[0.99]"
          : "border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 active:bg-white/15",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin-slow" />
      ) : null}
      {children}
    </button>
  );
}

/** Plain text link — warm muted ink, orange on hover, like the site's nav. */
function TextLink({children, onClick, className}: {children: React.ReactNode; onClick?: () => void; className?: string}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[14px] font-medium text-[#bd9d8a]",
        "hover:text-[#ff6b2c] hover:underline",
        "transition-colors duration-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Label above, hint/error below — no box around the control. */
function Field({label, hint, error, children, className}: {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label ? (
        <label className="block text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#bd9d8a] mb-1.5">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-[#ff9b94]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#bd9d8a]">{hint}</p>
      ) : null}
    </div>
  );
}

/* A field is a slab: the site's --input (#241812) inside a white/14
   hairline, warming to the orange ring while you type. */
const CONTROL =
  "w-full rounded-lg border border-[rgba(255,255,255,0.14)] bg-[#241812] px-3.5 py-2.5 text-[15px] text-white outline-none " +
  "placeholder:text-[#bd9d8a]/55 " +
  "transition duration-150 " +
  "hover:border-[rgba(255,255,255,0.26)] " +
  "focus:border-[#ff6b2c] focus:ring-[3px] focus:ring-[rgba(255,107,44,0.25)] focus:outline-none " +
  "disabled:opacity-50";

/** Text input — landing slab styling. */
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
      className={cn(CONTROL, invalid && "border-[#e5484d] focus:border-[#e5484d] focus:ring-[rgba(229,72,77,0.25)]", className)}
    />
  );
}

/** Password field — CONTROL styling + eye toggle. */
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
        className={cn(CONTROL, "pr-11")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full text-[#bd9d8a]",
          "hover:bg-white/10 hover:text-white",
          "transition-colors",
          visible ? "bg-white/10 text-white" : "",
        )}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** Checkbox — the site's signup box: black/40 slab, orange fill when on. */
function Checkbox({checked, onChange, children}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => {
        haptic("selection");
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          haptic("selection");
          onChange(!checked);
        }
      }}
      className="mb-4 flex w-full cursor-pointer items-start gap-3 transition-colors"
    >
      <span
        className={cn(
          "mt-[2px] flex size-[20px] shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150",
          checked
            ? "border-[#ff6b2c] bg-[#ff6b2c] text-[#0a0503]"
            : "border-[rgba(255,255,255,0.4)] bg-black/40 hover:border-[rgba(255,255,255,0.6)]",
        )}
      >
        {checked ? <Check className="size-[13px]" strokeWidth={3} /> : null}
      </span>
      <span className="text-[14.5px] leading-relaxed text-white/90">{children}</span>
    </div>
  );
}

/** Toggle row — ember orange when on, the site's input slab when off. */
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
        <span className="mt-0.5 block text-[13px] leading-relaxed text-[#bd9d8a]">{sub}</span>
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
          on ? "border-transparent bg-[#ff6b2c]" : "border-[rgba(255,255,255,0.2)] bg-[#241812]",
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
    tone = "text-[#bd9d8a]";
    icon = <Loader2 className="size-[13px] animate-spin-slow" />;
  } else if (state === "available") {
    tone = "text-[#6ee7a8]";
    icon = <Check className="size-[14px]" strokeWidth={3} />;
  } else {
    tone = "text-[#ff9b94]";
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
      <span className="block h-[48px] animate-pulse rounded-lg bg-white/10" />
      <span className="block h-[48px] animate-pulse rounded-lg bg-white/10" />
      <span className="block h-[48px] animate-pulse rounded-lg bg-white/10" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Logo — the site's wordmark: colossal Inter Black, tight tracking,
   and the one brand flourish — the gradient period.
   ═════════════════════════════════════════════════════════════ */

function Logo() {
  return (
    <div className="mb-8 flex items-center justify-center">
      <span className="text-[34px] font-black leading-none tracking-[-0.045em] text-white">
        Tirbeo<span aria-hidden style={{
          background: "linear-gradient(135deg, #ffb36b, #ff6b2c 55%, #e04e0a)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}>.</span>
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Legal modal — the card's own skin with the gradient top strip.
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
      {/* Scrim — the canvas color, dimmed */}
      <div className="absolute inset-0 bg-[rgba(6,4,3,0.75)] backdrop-blur-[2px]" />

      {/* Panel — #181008, gradient top strip, matching the card */}
      <div
        className={cn(
          "relative z-[91] w-full max-w-lg",
          "rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[#181008] text-white",
          "flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.6)]",
        )}
        onClick={(e) => e.stopPropagation()}
        style={{maxHeight: "80dvh"}}
      >
        <div
          className="h-1.5 w-full rounded-t-2xl"
          style={{background: "linear-gradient(90deg, #ffb36b, #ff6b2c 55%, #e04e0a)"}}
        />

        <div className="px-6 pt-6 pb-4">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white">{doc.title}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#bd9d8a]">{doc.intro}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="space-y-5 py-1">
            {doc.sections.map((section) => (
              <section key={section.title}>
                <h3 className="text-[15px] font-semibold text-white">{section.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#bd9d8a]">{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.1)] p-6">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex min-h-[48px] w-full items-center justify-center rounded-lg border border-white/20 bg-white/5",
              "px-4 text-center text-[15px] font-semibold text-white/90",
              "transition hover:bg-white/10 active:bg-white/15",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b2c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#181008]",
            )}
          >
            I understand
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded p-2 text-[#bd9d8a] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="size-[19px]" strokeWidth={2} />
        </button>
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
    fetch(`${apiBase()}/api/auth/oauth/pending?token=${encodeURIComponent(signupToken)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (dead) return;
        if (d?.error) setLoadError(d.error);
        else {
          setPending(d as Pending);
          setName(d.name || "");
          setPhoto(d.photoUrl || null);
        }
      })
      .catch(() => !dead && setLoadError("Tirbeo couldn't be reached. Check your connection and try again."));
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
     Shell — the landing site's ember canvas: nebula gradient,
     film grain, one warm card floating on it.
     ════════════════════════════════════════════════════ */
  function shell(children: React.ReactNode) {
    return (
      <main
        className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-8"
        style={{background: NEBULA, backgroundAttachment: "fixed"}}
      >
        {/* Film grain — the site's printed texture, same SVG noise. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{backgroundImage: GRAIN_SVG, opacity: 0.28, mixBlendMode: "overlay"}}
        />

        <div className="relative z-10 w-full max-w-[420px]">
          <Logo />

          {/* Card — the site's #181008 panel with a white/14 hairline. */}
          <div
            className="rounded-[20px] border border-[rgba(255,255,255,0.14)] bg-[#181008] p-7 sm:p-9"
            style={{boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,107,44,0.04)"}}
          >
            {children}
          </div>

          <p className="mt-5 text-center text-[12px] tracking-[0.02em] text-[#bd9d8a]/70">
            Built in public from Kathmandu
          </p>
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
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Nothing to finish</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#bd9d8a]">
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
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">That sign-in link has expired</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#bd9d8a]">
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

  /* ──────────────── Main form ──────────────── */
  return shell(
    <>
      {/* The face, editable — the provider's thumbnail is a starting point, not
          a verdict. The camera badge opens the file picker; the crop happens in
          the sheet the editor draws. */}
      <div className="relative mx-auto w-fit">
        <div className="relative z-10">
          <ProfilePicture
            photo={photo}
            seed={pending?.email || name || "tirbeo"}
            name={name || undefined}
            size={104}
            ring
          />
        </div>
        <button
          type="button"
          onClick={() => { haptic("light"); photoRef.current?.click(); }}
          className={cn(
            "absolute -right-1 -bottom-1 size-9 rounded-full",
            "flex items-center justify-center",
            "bg-[#ff6b2c] text-[#0a0503] hover:brightness-110",
            "border-2 border-[#181008]",
            "transition",
          )}
          aria-label="Change photo"
        >
          <Camera className="size-[17px]" strokeWidth={2.25} />
        </button>
      </div>

      <h1 className="mt-5 text-center text-[24px] font-bold tracking-[-0.025em] text-white">
        {signupToken ? "Create your Tirbeo account" : "One thing left"}
      </h1>

      <p className="mx-auto mt-2 max-w-[36ch] text-center text-[14px] leading-relaxed text-[#bd9d8a]">
        {signupToken ? (
          <>
            Signed in with {providerName} as <span className="font-medium text-white">{pending?.email}</span>
            {" · "}
            <button
              type="button"
              onClick={() => { haptic("light"); photoRef.current?.click(); }}
              className="font-medium text-[#ff6b2c] hover:brightness-110 hover:underline transition"
            >
              change photo
            </button>
          </>
        ) : (
          "Tirbeo hasn't got your agreement on record yet. Tick it below to keep going."
        )}
      </p>

      <form onSubmit={submit} className="mt-8">
        {signupToken ? (
          <section>
            {/* Profile section with divider */}
            <div className="mb-6">
              <Field
                label="Username"
                hint={username
                  ? undefined
                  : "This is your profile address — 3–30 characters: letters, numbers, - or _."}
              >
                <TextInput
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. bishnu.n"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  invalid={usernameState === "taken" || usernameState === "reserved" || usernameState === "invalid"}
                  id="username-field"
                />
              </Field>

              <UsernameStatus state={usernameState} message={usernameMsg} />

              <Field
                label="Display name"
                hint="How your name appears. You can change it later."
              >
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bishnu Neupane"
                  autoComplete="name"
                  id="display-name-field"
                />
              </Field>

              <Field
                label="Password"
                hint={
                  <>
                    Optional — {providerName} already gets you in. Adding a password gives the
                    account a second way in, and lets you change it later without going back through {providerName}.
                  </>
                }
              >
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  id="password-field"
                />
              </Field>
            </div>
          </section>
        ) : null}

        {/* Agreement section */}
        <section className="mb-6">
          <div className="mb-5 border-t border-[rgba(255,255,255,0.08)] pt-5">
            <Checkbox checked={accepted} onChange={setAccepted}>
              I agree to the <span className="font-semibold text-white">Terms of Service</span> and the{" "}
              <span className="font-semibold text-white">Privacy Policy</span>, and confirm the details above are
              mine.
            </Checkbox>

            <ToggleRow
              title="Let Tirbeo support see my account"
              sub="For troubleshooting when you ask for help. Optional."
              on={staffAccess}
              onChange={setStaffAccess}
            />
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <TextLink onClick={() => { haptic("light"); setLegal("terms"); }}>Read the terms</TextLink>
            <span aria-hidden className="text-[#bd9d8a]/40">·</span>
            <TextLink onClick={() => { haptic("light"); setLegal("privacy"); }}>Read the privacy policy</TextLink>
          </div>
        </section>

        <div className="mt-4">
          {error ? (
            <p className="rounded-lg border border-[rgba(229,72,77,0.3)] bg-[rgba(229,72,77,0.08)] px-4 py-3 text-[13.5px] text-[#ff9b94]">
              {error}
            </p>
          ) : !accepted ? (
            <p className="text-[13.5px] text-[#bd9d8a]">Tick that line to finish.</p>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={!accepted || busy || (signupToken ? usernameState !== "available" : false)}
          className="mt-3"
        >
          {busy ? "Working…" : signupToken ? "Create account" : "Continue"}
        </Button>

        {signupToken ? (
          <p className="mt-3 text-center text-[12.5px] leading-relaxed text-[#bd9d8a]/80">
            Nothing is created until you press that. Close this page and the account is never made.
          </p>
        ) : null}
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
