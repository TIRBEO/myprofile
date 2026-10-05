"use client";

/* ═══════════════════════════════════════════════════════════════════
   OAuth completion screen — Glassmorphism redesign

   The API hands off here in two cases:
   • ?signup=<token>   — first social sign-in. The provider vouched for the
     email; nothing else exists yet. The account is written only when this
     form is submitted, so a person who closes the tab after Google is left
     with no Tirbeo row, no consent record and nothing to clean up.
   • ?finish=1&consent=<token> — an existing account signed in while its
     policy consent was never recorded. The session cookie is already set;
     this is the agreement, not a gate on sign-in.

   The password box is optional on purpose: a provider login already works
   without one. Adding a password buys the account a second way in — and
   the brain refuses a password it has seen in a breach list, so the box
   can answer back with a real reason rather than a shrug.

   The terms and the privacy policy are read here, in a modal, because the
   person agreeing to them has no account yet and no settings area to
   navigate to. A link that sends them to a page which isn't there would
   make the tick mean nothing.

   ─────────────────────────────────────────────────────────────
   Visual design: Soft glassmorphism with a pastel gradient
   background. Every surface is a frosted-glass layer with
   backdrop-blur, rounded corners, and a soft shadow. The accent
   is a violet→fuchsia gradient, replacing Instagram's #0064c8
   blue block-for-block. This is an intentional departure from the
   Instagram-derived palette (#000 canvas, #262626 hairlines,
   #0095f6 blue, #ed4956 red) used elsewhere in the app.
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
  // On a tirbeo domain, hit api.<parent> so a production sign-up never calls a
  // localhost address; env + local default cover development and other hosts.
  if (typeof window !== "undefined") {
    const parent = window.location.hostname.match(/(?:^|\\.)(tirbeo\\.(?:com|app))$/i);
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
    intro:
      "What Tirbeo collects, why it collects it, and what it does not do with it.",
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
   Design primitives — self-contained, scoped to this page.
   These replace ig-ui.tsx's Instagram-derived Button / Field /
   Input / Sheet / etc. with a soft glassmorphism language.
   ═══════════════════════════════════════════════════════════ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  icon?: React.ReactNode;
  /** Accessible name for icon-only buttons (maps to aria-label). */
  label?: string;
};

/** Gradient pill button — violet → fuchsia, full-width by default. */
function GlassButton({
  loading,
  icon,
  children,
  className,
  disabled,
  onClick,
  type = "button",
  label,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5",
        "text-[15px] font-semibold text-white",
        "bg-gradient-to-r from-violet-500 to-fuchsia-500",
        "shadow-lg shadow-violet-200/40",
        "transition-all duration-200",
        "hover:brightness-110 hover:shadow-xl hover:shadow-violet-300/40",
        "active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-violet-400/50",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : icon ? (
        <span className="flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

/** Soft gradient link button for the legal text links. */
function GlassLink({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[14px] font-medium text-violet-600",
        "hover:text-fuchsia-600 hover:underline",
        "transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Frosted-glass input — rounded-2xl, soft border, pastel focus ring. */
function GlassInput({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label ? (
        <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-rose-500 font-medium">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function GlassTextInput({
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
        "w-full rounded-2xl border bg-white/60 px-4 py-3 text-[15px] text-slate-800",
        "placeholder:text-slate-400/70",
        "transition-all duration-200",
        "border-white/30",
        "focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:border-transparent",
        "focus:bg-white/80",
        invalid && "border-rose-400 focus:ring-rose-300/50",
        className,
      )}
    />
  );
}

function GlassPasswordField({
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
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          "w-full rounded-2xl border bg-white/60 px-4 py-3 pr-12 text-[15px] text-slate-800",
          "placeholder:text-slate-400/70",
          "transition-all duration-200",
          "border-white/30",
          "focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:border-transparent",
          "focus:bg-white/80",
          className,
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          "absolute top-1/2 right-3 -translate-y-1/2 rounded-xl p-1.5 text-slate-400",
          "hover:bg-white/40 hover:text-slate-600 transition-colors",
        )}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** Custom rounded checkbox — fills with gradient when checked. */
function GlassCheckbox({
  checked,
  onChange,
  children,
}: {
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
        "group flex w-full items-start gap-3.5 rounded-2xl px-4 py-3.5 text-left",
        "transition-all duration-200",
        checked
          ? "bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 border border-violet-200/50"
          : "hover:bg-white/40 border border-white/30",
      )}
    >
      <span
        className={cn(
          "mt-[2px] flex size-[24px] shrink-0 items-center justify-center",
          "rounded-xl border-2 transition-all duration-200",
          checked
            ? "border-violet-500 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
            : "border-slate-300 bg-white/70",
        )}
      >
        {checked ? <Check className="size-[13px]" strokeWidth={3} /> : null}
      </span>
      <span className="text-[14px] leading-relaxed text-slate-700">{children}</span>
    </button>
  );
}

/** Toggle row for the staff-access option. */
function GlassToggleRow({
  title,
  sub,
  on,
  onChange,
}: {
  title: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/30 bg-white/30 px-4 py-3.5">
      <div className="min-w-0 flex-1 pr-4">
        <span className="block text-[14.5px] font-medium text-slate-700">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-500">{sub}</span>
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
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
          "transition-colors duration-200",
          on ? "bg-gradient-to-r from-violet-500 to-fuchsia-500" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "block size-[20px] rounded-full bg-white shadow",
            "transition-transform duration-200 ease-out",
            on ? "translate-x-[2px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </div>
  );
}

/** Username availability badge — shows below the username field. */
function UsernameStatus({
  state,
  message,
}: {
  state: "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";
  message: string;
}) {
  if (state === "idle" || !message) return null;
  let tone: string;
  let icon: React.ReactNode;
  if (state === "checking") {
    tone = "text-slate-500";
    icon = <Loader2 className="size-[13px] animate-spin" />;
  } else if (state === "available") {
    tone = "text-emerald-600";
    icon = <Check className="size-[14px]" strokeWidth={3} />;
  } else {
    tone = "text-rose-500";
    icon = <X className="size-[14px]" strokeWidth={3} />;
  }
  return (
    <p className={cn("flex items-center gap-1.5 px-1 pt-1.5 pb-2 text-[12.5px] font-medium", tone)}>
      {icon}
      {message}
    </p>
  );
}

/** Skeleton loader while the pending data is fetched. */
function PanelSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <span className="size-28 animate-pulse rounded-full bg-slate-200/60" />
        <span className="block h-[18px] w-[60%] animate-pulse rounded-full bg-slate-200/60" />
        <span className="block h-[13px] w-[80%] animate-pulse rounded-full bg-slate-200/50" />
      </div>
      <span className="block h-[64px] animate-pulse rounded-2xl bg-slate-200/60" />
      <span className="block h-[64px] animate-pulse rounded-2xl bg-slate-200/55" />
      <span className="block h-[76px] animate-pulse rounded-2xl bg-slate-200/45" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Legal modal — a frosted-glass overlay, replaces Sheet
   ═══════════════════════════════════════════════════════════ */

function LegalModal({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
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
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={cn(
          "relative z-[91] w-full max-w-lg",
          "rounded-3xl border border-white/30 bg-white/40",
          "backdrop-blur-xl",
          "shadow-2xl shadow-black/15",
          "flex flex-col",
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "80dvh" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-[22px] font-bold text-slate-800">{doc.title}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{doc.intro}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="space-y-5 py-1">
            {doc.sections.map((section) => (
              <section key={section.title}>
                <h3 className="text-[15px] font-semibold text-slate-700">{section.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6">
          <GlassButton onClick={onClose} className="w-full">
            I understand
          </GlassButton>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-xl p-1.5 text-slate-400 hover:bg-white/30 hover:text-slate-600 transition-colors"
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
   ═══════════════════════════════════════════════════════════ */

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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: handle }),
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
        headers: { "content-type": "application/json" },
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
     Shell — frosted-glass page wrapper
     ════════════════════════════════════════════════════ */
  function shell(children: React.ReactNode) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 px-4 py-8">
        <div className="w-full max-w-[460px]">
          {/* Logo */}
          <p className="mb-6 text-center text-[16px] font-extrabold tracking-[-0.02em] text-slate-800">
            Tirbeo <span className="font-bold text-slate-400">MyProfile</span>
          </p>

          {/* Frosted-glass card */}
          <div
            className={cn(
              "rounded-[28px] border border-white/30 bg-white/25",
              "backdrop-blur-xl shadow-[0_30px_80px_-20px_rgb(0_0_0/0.06)]",
              "px-6 py-7 sm:px-8 sm:py-8",
            )}
          >
            {children}
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
        <h1 className="text-[22px] font-bold text-slate-800">Nothing to finish</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
          This page completes a Tirbeo sign-in started with Google, GitHub or Discord. Start the{" "}
          sign-in again and you&apos;ll land back here.
        </p>
        <GlassButton className="mt-6 w-full" onClick={() => { window.location.href = finishTarget; }}>
          Back to Tirbeo
        </GlassButton>
      </>,
    );
  }

  /* ──────────────── Expired branch ──────────────── */
  if (signupToken && loadError) {
    return shell(
      <>
        <h1 className="text-[22px] font-bold text-slate-800">That sign-in link has expired</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
          {loadError} The link lasts 15 minutes and is used once, so start the sign-in again — it takes a few seconds.
        </p>
        <GlassButton className="mt-6 w-full" onClick={() => { window.location.href = finishTarget; }}>
          Sign in again
        </GlassButton>
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
        {/* Floating halo behind the avatar */}
        <div className="absolute inset-0 z-0 mx-auto -my-2 h-[128px] w-[128px] rounded-full bg-gradient-to-br from-violet-200/40 via-fuchsia-200/30 to-pink-200/40 blur-2xl" />
        <div className="relative z-10">
          <ProfilePicture
            photo={photo}
            seed={pending?.email || name || "tirbeo"}
            name={name || undefined}
            size={104}
            ring
          />
        </div>
        <GlassButton
          label="Change profile photo"
          icon={<Camera className="size-[17px]" strokeWidth={2.25} />}
          onClick={() => { haptic("light"); photoRef.current?.click(); }}
          className="absolute -right-1 -bottom-1 size-9 rounded-full p-0 shadow-lg shadow-violet-200/30"
        />
      </div>

      <h1 className="mt-5 text-center text-[24px] font-bold tracking-[-0.025em] text-slate-800">
        {signupToken ? "Create your Tirbeo account" : "One thing left"}
      </h1>

      <p className="mx-auto mt-2 max-w-[36ch] text-center text-[14px] leading-relaxed text-slate-500">
        {signupToken ? (
          <>
            Signed in with {providerName} as <span className="font-medium text-slate-700">{pending?.email}</span>
            {" · "}
            <button
              type="button"
              onClick={() => { haptic("light"); photoRef.current?.click(); }}
              className="font-medium text-violet-600 hover:text-fuchsia-600 hover:underline"
            >
              change photo
            </button>
          </>
        ) : (
          "Tirbeo hasn't got your agreement on record yet. Tick it below to keep going."
        )}
      </p>

      <form onSubmit={submit} className="mt-7">
        {signupToken ? (
          <section>
            <h2 className="mb-4 text-[15px] font-semibold text-slate-600">Your profile</h2>
            <div className="space-y-4">
              <GlassInput
                label="Username"
                hint={
                  username
                    ? undefined
                    : "This is your profile address — 3–30 characters: letters, numbers, - or _."
                }
              >
                <GlassTextInput
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourname"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  invalid={usernameState === "taken" || usernameState === "reserved" || usernameState === "invalid"}
                />
              </GlassInput>
              <UsernameStatus state={usernameState} message={usernameMsg} />

              <GlassInput label="Display name" hint="How your name appears. You can change it later.">
                <GlassTextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </GlassInput>

              <GlassInput
                label="Password"
                hint={`Optional — ${providerName} already gets you in. Adding a password gives the account a second way in, and lets you change it later without going back through ${providerName}.`}
              >
                <GlassPasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </GlassInput>
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-4 text-[15px] font-semibold text-slate-600">Agreement</h2>
          <div className="space-y-3">
            <GlassCheckbox checked={accepted} onChange={setAccepted}>
              I agree to the <span className="font-semibold text-slate-800">Terms of Service</span> and the{" "}
              <span className="font-semibold text-slate-800">Privacy Policy</span>, and confirm the details above are
              mine.
            </GlassCheckbox>
            <GlassToggleRow
              title="Let Tirbeo support see my account"
              sub="For troubleshooting when you ask for help. Optional."
              on={staffAccess}
              onChange={setStaffAccess}
            />
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <GlassLink onClick={() => { haptic("light"); setLegal("terms"); }}>Read the terms</GlassLink>
            <span aria-hidden className="text-slate-300">·</span>
            <GlassLink onClick={() => { haptic("light"); setLegal("privacy"); }}>Read the privacy policy</GlassLink>
          </div>
        </section>

        <div className="mt-4">
          {error ? (
            <p className="rounded-xl border border-rose-200/50 bg-rose-50/60 px-3.5 py-2.5 text-[13.5px] text-rose-700">
              {error}
            </p>
          ) : !accepted ? (
            <p className="text-[13.5px] text-slate-500">Tick that line to finish.</p>
          ) : null}
        </div>

        <GlassButton
          type="submit"
          loading={busy}
          disabled={!accepted || busy || (signupToken ? usernameState !== "available" : false)}
          className="mt-3 w-full"
        >
          {busy ? "Working…" : signupToken ? "Create account" : "Continue"}
        </GlassButton>

        {signupToken ? (
          <p className="mt-3 text-center text-[12.5px] leading-relaxed text-slate-500">
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
