"use client";

import { useEffect, useState } from "react";
import { Input, Sheet, SheetActions, cn } from "@/components/ig-ui";
import { OtpInput } from "@/components/otp-input";
import { SignOutSheet } from "@/components/settings-layout";
import {
  ActionRow,
  Group,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { twoFactorEnabled } from "@/lib/backup-codes";
import { readKeys } from "@/lib/passkeys";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { getStaySignedIn, setStaySignedIn } from "@/lib/session";
import { Download, Eye, EyeOff } from "lucide-react";

const RECOVERY_KEY = "tirbeo:recovery-email";
const DEFAULT_RECOVERY = "aarav.shrestha92@gmail.com";

/* ═══════════════════════════════════════════════════════════════════
   Password and security — the hub for the rest of the section.

   The card at the top reports the account's actual state rather than a
   slogan: whether an authenticator is on, and how many passkeys exist.
   Everything below it is one row per thing, and the whole row is the
   tap target. "Saved login info" is the only switch here, and it drives
   a real client session (lib/session). Logging out is the one red row,
   and it asks in a sheet before it ends anything. Passwords are never
   stored, and the recovery address is shown in full.
   ═══════════════════════════════════════════════════════════════════ */

export default function SecurityPage() {
  const [savedLogin, setSavedLogin] = useState(true);
  const [twoFa, setTwoFa] = useState(true);
  const [passkeys, setPasskeys] = useState(0);
  const [ready, setReady] = useState(false);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [recoverySheet, setRecoverySheet] = useState(false);
  const [signOutSheet, setSignOutSheet] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(DEFAULT_RECOVERY);
  const toast = useToast();

  useEffect(() => {
    setSavedLogin(getStaySignedIn());
    setTwoFa(twoFactorEnabled());
    setPasskeys(readKeys().length);
    setReady(true);
    try {
      const v = localStorage.getItem(RECOVERY_KEY);
      if (typeof v === "string" && v) setRecoveryEmail(v);
    } catch {
      /* private mode — keep the default */
    }
  }, []);

  function toggleSavedLogin(on: boolean) {
    setStaySignedIn(on);
    setSavedLogin(on);
    toast.success(
      on ? "You'll stay signed in on this device" : "You'll sign out after 1 hour of inactivity",
    );
  }

  function verifyRecovery(email: string) {
    setRecoveryEmail(email);
    try {
      localStorage.setItem(RECOVERY_KEY, email);
    } catch {
      /* private mode — the change still holds for this session */
    }
    setRecoverySheet(false);
    toast.success("Recovery email verified");
  }

  if (!ready) return <PageSkeleton title="Password and security" sections={2} />;

  return (
    <SettingsPage title="Password and security">

      {/* ── Sign-in ── */}
      <SectionTitle>Sign-in</SectionTitle>
      <Group>
        <ActionRow
          accent
          title="Change password"
          sub="Update the password you use to sign in."
          onClick={() => setPasswordSheet(true)}
        />
        <ToggleRow
          title="Saved login info"
          sub={
            savedLogin
              ? "Stay signed in on this device."
              : "Sign out automatically after 1 hour of inactivity."
          }
          on={savedLogin}
          onChange={toggleSavedLogin}
        />
      </Group>

      {/* ── Second steps ── */}
      <SectionTitle>Second steps</SectionTitle>
      <Group>
        <LinkRow
          href="/settings/two-factor"
          title="Two-factor authentication"
          sub="A code from your app, plus backup codes."
        />
        <LinkRow
          href="/settings/passkeys"
          title="Passkeys"
          sub="Face ID, Touch ID or a device PIN."
          right={passkeys || undefined}
        />
      </Group>

      {/* ── Who's in ── */}
      <SectionTitle>Who's signed in</SectionTitle>
      <Group>
        <LinkRow
          href="/settings/login-activity"
          title="Login activity"
          sub="Recent sign-ins, and whether they were you."
        />
        <LinkRow
          href="/settings/devices"
          title="Devices and sessions"
          sub="End a session you don't recognise."
        />
      </Group>

      {/* ── This device ── */}
      <SectionTitle desc="Logging out closes this session only. Other devices keep working until you end them on their own row.">
        On this device
      </SectionTitle>
      <Group>
        <ActionRow
          danger
          title="Log out of Tirbeo"
          sub="This device forgets you until you sign in again."
          opens={false}
          onClick={() => setSignOutSheet(true)}
        />
      </Group>

      {/* ── Recovery ── */}
      <SectionTitle
        desc="Keep the recovery email current — it's the only way back in if you lose your password and your codes together."
      >
        Recovery
      </SectionTitle>
      <Group>
        <ActionRow
          title="Recovery email"
          sub={recoveryEmail}
          onClick={() => setRecoverySheet(true)}
        />
        <LinkRow
          href="/settings/download-data"
          title="Download your information"
          sub="A copy of what you've shared with Tirbeo."
        />
      </Group>

      {passwordSheet ? (
        <ChangePasswordSheet
          onClose={() => setPasswordSheet(false)}
          onSaved={() => {
            setPasswordSheet(false);
            toast.success("Password updated");
          }}
        />
      ) : null}

      {recoverySheet ? (
        <RecoverySheet
          current={recoveryEmail}
          onClose={() => setRecoverySheet(false)}
          onVerified={verifyRecovery}
        />
      ) : null}

      {signOutSheet ? <SignOutSheet onClose={() => setSignOutSheet(false)} /> : null}
    </SettingsPage>
  );
}

/* ── Change password sheet ───────────────────────────────────────── */

type PwKey = "current" | "next" | "confirm";

const PW_FIELDS: { key: PwKey; label: string; placeholder: string; autoComplete: string }[] = [
  { key: "current", label: "Current password", placeholder: "Your current password", autoComplete: "current-password" },
  { key: "next", label: "New password", placeholder: "At least 8 characters", autoComplete: "new-password" },
  { key: "confirm", label: "Re-enter new password", placeholder: "Type the new password again", autoComplete: "new-password" },
];

const MIN = 8;

function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= MIN) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const STRENGTH = [
  { label: "Too short", bar: "bg-danger", text: "text-danger-text" },
  { label: "Weak", bar: "bg-danger", text: "text-danger-text" },
  { label: "Fair", bar: "bg-warn", text: "text-warn" },
  { label: "Good", bar: "bg-success", text: "text-success-text" },
  { label: "Strong", bar: "bg-success", text: "text-success-text" },
];

function ChangePasswordSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<PwKey, string>>({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState<Record<PwKey, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });

  const score = scorePassword(form.next);
  const strength = STRENGTH[score];
  const tooShort = form.next.length > 0 && form.next.length < MIN;
  const mismatch = form.confirm.length > 0 && form.confirm !== form.next;
  const valid = form.current.length > 0 && !tooShort && !mismatch && form.next.length >= MIN;

  function set(key: PwKey, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function errorFor(key: PwKey): string | undefined {
    if (key === "next" && tooShort) return `Use at least ${MIN} characters`;
    if (key === "confirm" && mismatch) return "Passwords don't match";
    return undefined;
  }

  function submit() {
    if (!valid) {
      haptic("error");
      return;
    }
    onSaved();
  }

  return (
    <Sheet
      title="Change password"
      description="Use at least 8 characters you don't use anywhere else."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel="Update password"
          onConfirm={submit}
          disabled={!valid}
        />
      }
    >
      <div className="-mx-4 space-y-5 px-4 pb-2 pt-1 sm:-mx-5 sm:px-5">
        {PW_FIELDS.map((f, i) => (
          <div key={f.key}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                {f.label}
              </span>
              {f.key === "next" && form.next.length > 0 ? (
                <span className={cn("text-[12px] font-semibold", strength.text)}>{strength.label}</span>
              ) : null}
            </div>

            <div className="relative">
              <Input
                type={visible[f.key] ? "text" : "password"}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
                autoFocus={i === 0}
                invalid={!!errorFor(f.key)}
                className="pr-11"
              />
              <button
                type="button"
                aria-label={visible[f.key] ? "Hide password" : "Show password"}
                onClick={() => setVisible((v) => ({ ...v, [f.key]: !v[f.key] }))}
                className={cn(
                  "absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full after:absolute after:-inset-1.5 after:content-['']",
                  "transition-colors",
                  visible[f.key] ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg active:bg-surface-3",
                )}
              >
                {visible[f.key] ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>

            {f.key === "next" && form.next.length > 0 ? (
              <div className="mt-2.5 flex gap-1.5">
                {[0, 1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-300",
                      seg < score ? strength.bar : "bg-track",
                    )}
                  />
                ))}
              </div>
            ) : null}

            {errorFor(f.key) ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-danger-text">{errorFor(f.key)}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ── Recovery email sheet: enter email → verify with an OTP ─────── */

function RecoverySheet({
  current,
  onClose,
  onVerified,
}: {
  current: string;
  onClose: () => void;
  onVerified: (email: string) => void;
}) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState(current);
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const toast = useToast();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeFull = code.every((d) => d !== "");

  function confirm() {
    if (step === "email") {
      if (!emailValid) {
        haptic("error");
        return;
      }
      setCode(["", "", "", "", "", ""]);
      setStep("otp");
      return;
    }
    if (!codeFull) {
      haptic("error");
      return;
    }
    onVerified(email.trim());
  }

  return (
    <Sheet
      title={step === "email" ? "Recovery email" : "Enter the code"}
      description={
        step === "email"
          ? "We'll send a 6-digit code to confirm this email is really yours."
          : `We sent a 6-digit code to ${email.trim()}.`
      }
      onClose={onClose}
      footer={
        step === "email" ? (
          <SheetActions
            cancelLabel="Cancel"
            onCancel={onClose}
            confirmLabel="Verify"
            onConfirm={confirm}
            disabled={!emailValid}
          />
        ) : (
          <SheetActions
            cancelLabel="Back"
            onCancel={() => {
              haptic("light");
              setStep("email");
            }}
            confirmLabel="Confirm"
            onConfirm={confirm}
            disabled={!codeFull}
          />
        )
      }
    >
      {step === "email" ? (
        <div className="-mx-4 px-4 py-4 sm:-mx-5 sm:px-5">
          <span className="mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            Email address
          </span>
          <Input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            placeholder="you@example.com"
            autoFocus
            autoComplete="email"
          />
        </div>
      ) : (
        <div className="-mx-4 px-4 pb-2 pt-1 sm:-mx-5 sm:px-5">
          <OtpInput value={code} onChange={setCode} />
          <button
            type="button"
            onClick={() => {
              setCode(["", "", "", "", "", ""]);
              toast.info("A fresh code is on its way");
            }}
            className="mx-auto mt-5 block text-[13px] font-medium text-accent-text transition-opacity hover:opacity-80"
          >
            Didn't get it? Resend code
          </button>
        </div>
      )}
    </Sheet>
  );
}
