"use client";

/* ═══════════════════════════════════════════════════════════════════
   OAuth completion screen

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

   The terms and the privacy policy are read here, in a sheet, because the
   person agreeing to them has no account yet and no settings area to
   navigate to. A link that sends them to a page which isn't there would
   make the tick mean nothing.
   ═══════════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Check, Loader2, X } from "lucide-react";
import { Button, Field, IconButton, Input, PasswordField, Sheet, cn } from "@/components/ig-ui";
import { Group, Helper, SectionTitle, ToggleRow } from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import { AvatarEditor } from "@/components/avatar-editor";
import { haptic } from "@/lib/haptics";

function apiBase(): string {
  // On a tirbeo domain, hit api.<parent> so a production sign-up never calls a
  // localhost address; env + local default cover development and other hosts.
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

function LegalSheet({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  const doc = LEGAL[kind];
  return (
    <Sheet
      title={doc.title}
      description={doc.intro}
      onClose={onClose}
      width="lg"
      footer={
        <Button variant="primary" block onClick={onClose}>
          I understand
        </Button>
      }
    >
      <div className="space-y-5 py-1">
        {doc.sections.map((section) => (
          <section key={section.title}>
            <h3 className="text-[14.5px] font-semibold">{section.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{section.body}</p>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/** The agreement itself: a tick box, not a dim button. */
function AgreeRow({
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
        "flex w-full items-start gap-3.5 px-4 py-4 text-left outline-none transition-colors sm:px-5",
        checked ? "bg-accent/8" : "hover:bg-surface-2/50 active:bg-surface-2/70",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-[1px] flex size-[22px] shrink-0 items-center justify-center rounded-lg border transition-colors",
          checked ? "border-accent bg-accent text-accent-fg" : "border-border",
        )}
      >
        {checked ? <Check className="size-[14px]" strokeWidth={3} /> : null}
      </span>
      <span className="text-[14px] leading-relaxed">{children}</span>
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <span className="size-24 animate-pulse rounded-full bg-surface-2" />
        <span className="block h-[18px] w-[60%] animate-pulse rounded-full bg-surface-2" />
        <span className="block h-[13px] w-[80%] animate-pulse rounded-full bg-surface-2/70" />
      </div>
      <span className="block h-[64px] animate-pulse rounded-2xl bg-surface-2" />
      <span className="block h-[64px] animate-pulse rounded-2xl bg-surface-2/70" />
      <span className="block h-[76px] animate-pulse rounded-2xl bg-surface-2/50" />
    </div>
  );
}

/** The line under the username box — the same words the account would answer
    with on submit, shown while there is still time to change the name. */
function UsernameStatus({
  state,
  message,
}: {
  state: "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";
  message: string;
}) {
  if (state === "idle" || !message) return null;
  const tone =
    state === "available"
      ? "text-success-text"
      : state === "checking"
        ? "text-muted"
        : "text-danger-text";
  return (
    <p className={cn("flex items-center gap-1.5 px-4 pb-3 text-[12.5px] font-medium sm:px-5", tone)}>
      {state === "checking" ? (
        <Loader2 className="size-[13px] animate-spin" />
      ) : state === "available" ? (
        <Check className="size-[14px]" strokeWidth={2.6} />
      ) : (
        <X className="size-[14px]" strokeWidth={2.6} />
      )}
      {message}
    </p>
  );
}

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
      .catch(() => !dead && setLoadError("Tirbeo couldn’t be reached. Check your connection and try again."));
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
      setError("That file isn’t a photo.");
      return;
    }
    if (file.size > PHOTO_LIMIT) {
      haptic("error");
      setError("That image is larger than 5 MB — pick a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditorSrc(String(reader.result));
    reader.onerror = () => setError("Your browser couldn’t open that photo.");
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
        setError(d?.error || "Tirbeo couldn’t finish this. Please try again.");
        haptic("error");
        setBusy(false);
        return;
      }
      window.location.href = d.redirect_to || finishTarget;
    } catch {
      setError("Tirbeo couldn’t be reached. Check your connection and try again.");
      haptic("error");
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10 text-fg">
      <div className="w-full max-w-[440px]">
        <p className="mb-6 text-center text-[15px] font-extrabold tracking-[-0.02em]">
          Tirbeo <span className="font-bold text-muted">MyProfile</span>
        </p>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_14px_36px_-24px_rgb(0_0_0/0.4)] sm:px-6">
          {children}
        </div>
      </div>
      {legal ? <LegalSheet kind={legal} onClose={() => setLegal(null)} /> : null}
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

  if (!signupToken && !finishing) {
    return shell(
      <>
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">Nothing to finish</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          This page completes a Tirbeo sign-in started with Google, GitHub or Discord. Start the
          sign-in again and you&apos;ll land back here.
        </p>
        <Button variant="primary" className="mt-6 w-full" onClick={() => { window.location.href = finishTarget; }}>
          Back to Tirbeo
        </Button>
      </>,
    );
  }

  if (signupToken && loadError) {
    return shell(
      <>
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">That sign-in link has expired</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {loadError} The link lasts 15 minutes and is used once, so start the sign-in again — it
          takes a few seconds.
        </p>
        <Button variant="primary" className="mt-6 w-full" onClick={() => { window.location.href = finishTarget; }}>
          Sign in again
        </Button>
      </>,
    );
  }

  if (signupToken && !pending) return shell(<PanelSkeleton />);

  return shell(
    <>
      {/* The face, editable — the provider's thumbnail is a starting point, not
          a verdict. The camera badge opens the file picker; the crop happens in
          the sheet the editor draws. */}
      <div className="relative mx-auto w-fit">
        <ProfilePicture
          photo={photo}
          seed={pending?.email || name || "tirbeo"}
          name={name || undefined}
          size={104}
          ring
        />
        <IconButton
          label="Change profile photo"
          onClick={() => { haptic("light"); photoRef.current?.click(); }}
          icon={<Camera className="size-[16px]" strokeWidth={2.25} />}
          className="absolute -right-0.5 -bottom-0.5 size-9 border-[3px] border-surface bg-accent text-accent-fg shadow-sm hover:bg-accent-hover"
        />
      </div>
      <h1 className="mt-4 text-center text-[22px] font-bold tracking-[-0.025em]">
        {signupToken ? "Create your Tirbeo account" : "One thing left"}
      </h1>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-center text-[14px] leading-relaxed text-muted">
        {signupToken ? (
          <>
            Signed in with {providerName} as <span className="font-medium text-fg">{pending?.email}</span>
            {" · "}
            <button type="button" onClick={() => { haptic("light"); photoRef.current?.click(); }} className="text-accent-text hover:underline">
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
            <SectionTitle>Your profile</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <Group>
                <Field
                  label="Username"
                  hint={username ? undefined : "This is your profile address — 3–30 characters: letters, numbers, - or _."}
                >
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="yourname"
                    autoComplete="username"
                    spellCheck={false}
                    required
                    invalid={usernameState === "taken" || usernameState === "reserved" || usernameState === "invalid"}
                  />
                </Field>
                {username ? <UsernameStatus state={usernameState} message={usernameMsg} /> : null}
                <Field label="Display name" hint="How your name appears. You can change it later.">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </Field>
                <Field
                  label="Password"
                  hint={`Optional — ${providerName} already gets you in. Adding a password gives the account a second way in, and lets you change it later without going back through ${providerName}.`}
                >
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </Field>
              </Group>
            </div>
          </section>
        ) : null}

        <section className="mt-9">
          <SectionTitle>Agreement</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <Group>
              <AgreeRow checked={accepted} onChange={setAccepted}>
                I agree to the <span className="font-semibold">Terms of Service</span> and the{" "}
                <span className="font-semibold">Privacy Policy</span>, and confirm the details above are
                mine.
              </AgreeRow>
              <ToggleRow
                title="Let Tirbeo support see my account"
                sub="For troubleshooting when you ask for help. Optional."
                on={staffAccess}
                onChange={setStaffAccess}
              />
            </Group>
          </div>
          <div className="mt-2.5 flex items-center gap-1 pl-1">
            <Button variant="link" onClick={() => { haptic("light"); setLegal("terms"); }}>
              Read the terms
            </Button>
            <span aria-hidden className="text-muted">·</span>
            <Button variant="link" onClick={() => { haptic("light"); setLegal("privacy"); }}>
              Read the privacy policy
            </Button>
          </div>
        </section>

        <div className="mt-4">
          {error ? (
            <Helper tone="danger">{error}</Helper>
          ) : !accepted ? (
            <Helper>Tick that line to finish.</Helper>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="mt-2 w-full"
          disabled={!accepted || busy || (signupToken ? usernameState !== "available" : false)}
        >
          {busy ? "Working…" : signupToken ? "Create account" : "Continue"}
        </Button>
        {signupToken ? (
          <p className="mt-3 text-center text-[12.5px] leading-relaxed text-muted">
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
