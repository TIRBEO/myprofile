"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, IconButton, Input, Sheet, SheetActions, cn } from "@/components/ig-ui";
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
import { useTwoFactorState } from "@/lib/two-factor";
import { readKeys } from "@/lib/passkeys";
import { ApiError } from "@/lib/api";
import {
  changePassword,
  readSecurityStatus,
  sendRecoveryCode,
  verifyRecoveryEmail,
} from "@/lib/security";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import { getStaySignedIn, setStaySignedIn } from "@/lib/session";
import { Download, Eye, EyeOff } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Password and security — the hub for the rest of the section.

   The card at the top reports the account's actual state rather than a
   slogan: whether an authenticator is on, and how many passkeys exist.
   Everything below it is one row per thing, and the whole row is the
   tap target. "Saved login info" is the only switch here, and it drives
   a real client session (lib/session). Logging out is the one red row,
   and it asks in a sheet before it ends anything. Passwords are never
   stored, and the recovery address is the account's own — read from the
   brain, and marked unconfirmed until a code says whoever typed it can
   actually read the mail.
   ═══════════════════════════════════════════════════════════════════ */

export default function SecurityPage() {
  const [savedLogin, setSavedLogin] = useState(true);
  const [passkeys, setPasskeys] = useState(0);
  const [ready, setReady] = useState(false);
  const { state: twoFactor } = useTwoFactorState();
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [recoverySheet, setRecoverySheet] = useState(false);
  const [signOutSheet, setSignOutSheet] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  // "The account wouldn't answer" is not the same fact as "the account has no
  // recovery address", and printing the second when the first happened would
  // tell a person to add an address they already have.
  const [statusUnknown, setStatusUnknown] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setReady(false);
    setSavedLogin(getStaySignedIn());
    // Both counts and states are the account's, so the page waits for the
    // pair of them rather than showing "0 passkeys / password set" and
    // correcting itself a moment later.
    Promise.allSettled([
      readKeys()
        .then((keys) => setPasskeys(keys.length))
        .catch(() => setPasskeys(0)),
      readSecurityStatus()
        .then((status) => {
          setStatusUnknown(false);
          setHasPassword(status.hasPassword);
          setRecoveryEmail(status.recoveryEmail);
          setRecoveryVerified(status.recoveryEmailVerified);
        })
        .catch(() => {
          /* An address the account never told us is not one we can print, so the
             row says it couldn't be read rather than guessing at it. */
          setStatusUnknown(true);
        }),
    ]).then(() => setReady(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(load);

  function toggleSavedLogin(on: boolean) {
    setStaySignedIn(on);
    setSavedLogin(on);
    toast.success(
      on ? "You'll stay signed in on this device" : "You'll sign out after 1 hour of inactivity",
    );
  }

  function verifyRecovery(email: string) {
    setRecoveryEmail(email);
    setRecoveryVerified(true);
    setRecoverySheet(false);
    toast.success("Recovery email confirmed");
  }

  if (!ready) return <PageSkeleton title="Password and security" sections={2} />;

  return (
    <SettingsPage title="Password and security">

      {/* ── Sign-in ── */}
      <SectionTitle>Sign-in</SectionTitle>
      <Group>
        <ActionRow
          accent
          title={hasPassword ? "Change password" : "Set a password"}
          sub={
            hasPassword
              ? "Update the password you use to sign in."
              : "This account signs in with a provider. A password gives you a second way in."
          }
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
          right={twoFactor ? (twoFactor.authenticator ? "On" : "Off") : undefined}
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
          sub={
            recoveryEmail ??
            (statusUnknown
              ? "Couldn’t be read from your account right now."
              : "Not set — add one so a lost password isn't a lost account.")
          }
          right={recoveryEmail && !recoveryVerified ? "Not confirmed" : undefined}
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
          hasPassword={hasPassword}
          onClose={() => setPasswordSheet(false)}
          onSaved={() => {
            setPasswordSheet(false);
            setHasPassword(true);
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

function ChangePasswordSheet({
  hasPassword,
  onClose,
  onSaved,
}: {
  hasPassword: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<PwKey, string>>({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState<Record<PwKey, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The account only asks for this when "require 2FA for sensitive actions" is
     on. We don't know that up front — the brain tells us by refusing the first
     attempt — so the code field appears in place rather than always being there
     for accounts that will never use it. */
  const [needs2FA, setNeeds2FA] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [useBackup, setUseBackup] = useState(false);
  const [backup, setBackup] = useState("");

  // An account made through a provider has no current password to type, and
  // demanding one would be a wall with no door in it.
  const fields = hasPassword ? PW_FIELDS : PW_FIELDS.filter((f) => f.key !== "current");

  const score = scorePassword(form.next);
  const strength = STRENGTH[score];
  const tooShort = form.next.length > 0 && form.next.length < MIN;
  const mismatch = form.confirm.length > 0 && form.confirm !== form.next;
  const codeFull = code.every((d) => d !== "");
  const factorReady = !needs2FA || (useBackup ? backup.trim().length > 0 : codeFull);
  const valid =
    (!hasPassword || form.current.length > 0) &&
    !tooShort &&
    !mismatch &&
    form.next.length >= MIN &&
    factorReady;

  function set(key: PwKey, value: string) {
    setError(null);
    setForm((f) => ({ ...f, [key]: value }));
  }

  function errorFor(key: PwKey): string | undefined {
    if (key === "next" && tooShort) return `Use at least ${MIN} characters`;
    if (key === "confirm" && mismatch) return "Passwords don't match";
    return undefined;
  }

  async function submit() {
    if (!valid || busy) {
      if (!valid) haptic("error");
      return;
    }
    setBusy(true);
    setError(null);
    const factor = needs2FA
      ? useBackup
        ? { backupCode: backup.trim() }
        : { code: code.join("") }
      : {};
    try {
      await changePassword(form.current, form.next, factor);
      onSaved();
    } catch (err) {
      haptic("error");
      const refused =
        err instanceof ApiError &&
        (err.code === "SECOND_FACTOR_REQUIRED" || err.data?.requires2FA === true);
      const badCode = err instanceof ApiError && err.code === "INVALID_CODE";
      if (refused || badCode) {
        /* The brain wants a second factor (first refusal) or rejected the one we
           just sent (a wrong/expired code). Either way the field stays up and the
           code is cleared so the next one can be typed fresh. */
        setNeeds2FA(true);
        setCode(["", "", "", "", "", ""]);
        setError(
          badCode
            ? "That code wasn’t accepted. Try the one showing right now."
            : "Enter the 6-digit code from your authenticator app to continue.",
        );
      } else {
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : "The password couldn’t be updated. Nothing has changed — try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={hasPassword ? "Change password" : "Set a password"}
      description="Use at least 8 characters you don't use anywhere else."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel={busy ? "Updating" : hasPassword ? "Update password" : "Set password"}
          onConfirm={submit}
          disabled={!valid}
          loading={busy}
        />
      }
    >
      <div className="-mx-4 space-y-5 px-4 pb-2 pt-1 sm:-mx-5 sm:px-5">
        {fields.map((f, i) => (
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
              <IconButton
                label={visible[f.key] ? "Hide password" : "Show password"}
                icon={visible[f.key] ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                onClick={() => setVisible((v) => ({ ...v, [f.key]: !v[f.key] }))}
                className={cn(
                  "absolute right-1.5 top-1/2 size-8 -translate-y-1/2 after:absolute after:-inset-1.5 after:content-['']",
                  visible[f.key] ? "bg-surface-2" : "text-muted",
                )}
              />
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

        {needs2FA ? (
          <div className="mt-6 border-t border-divider pt-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                {useBackup ? "Backup code" : "Authenticator code"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setUseBackup((v) => !v);
                }}
                className="text-[12.5px] font-medium text-accent"
              >
                {useBackup ? "Use app code" : "Use a backup code"}
              </button>
            </div>
            {useBackup ? (
              <Input
                value={backup}
                onChange={(e) => {
                  setError(null);
                  setBackup(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="8-character backup code"
                autoComplete="one-time-code"
                maxLength={8}
                className="font-mono tracking-[0.15em]"
              />
            ) : (
              <OtpInput
                value={code}
                onChange={(next) => {
                  setError(null);
                  setCode(next);
                }}
              />
            )}
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Your account asks for a second factor before a password changes. Codes refresh every
              30 seconds, so send the one showing right now.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="text-[13px] leading-relaxed text-danger-text">{error}</p>
        ) : null}
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
  current: string | null;
  onClose: () => void;
  onVerified: (email: string) => void;
}) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState(current ?? "");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  // Whether the last code actually left the mail system. The sheet says
  // "we sent a code" on the strength of it, and nothing else does.
  const [delivered, setDelivered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeFull = code.every((d) => d !== "");

  function refused(err: unknown, fallback: string) {
    haptic("error");
    setError(err instanceof ApiError && err.message ? err.message : fallback);
  }

  async function sendCode(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const ok = await sendRecoveryCode(email.trim());
      setDelivered(ok);
      setCode(["", "", "", "", "", ""]);
      setStep("otp");
      return ok;
    } catch (err) {
      refused(err, "The code couldn’t be sent. Nothing has changed — try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (step === "email") {
      if (!emailValid) {
        haptic("error");
        return;
      }
      await sendCode();
      return;
    }
    if (!codeFull || busy) {
      if (!codeFull) haptic("error");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyRecoveryEmail(email.trim(), code.join(""));
      onVerified(email.trim());
    } catch (err) {
      haptic("error");
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : "That code wasn’t accepted. Ask for a fresh one and try again.",
      );
      setCode(["", "", "", "", "", ""]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={step === "email" ? "Recovery email" : "Enter the code"}
      description={
        step === "email"
          ? "We'll send a 6-digit code to confirm this email is really yours."
          : delivered
            ? `We sent a 6-digit code to ${email.trim()}.`
            : `Tirbeo couldn’t get the code to ${email.trim()} out the door. The address is stored as unconfirmed — you can ask for the code again, or check the address.`
      }
      onClose={onClose}
      footer={
        step === "email" ? (
          <SheetActions
            cancelLabel="Cancel"
            onCancel={onClose}
            confirmLabel={busy ? "Sending" : "Send code"}
            onConfirm={confirm}
            disabled={!emailValid}
            loading={busy}
          />
        ) : (
          <SheetActions
            cancelLabel="Back"
            onCancel={() => {
              haptic("light");
              setError(null);
              setStep("email");
            }}
            confirmLabel="Confirm"
            onConfirm={confirm}
            disabled={!codeFull}
            loading={busy}
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
            onChange={(e) => {
              setError(null);
              setEmail(e.target.value);
            }}
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
          {error ? (
            <p className="mt-4 text-[13px] leading-relaxed text-danger-text">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="-mx-4 px-4 pb-2 pt-1 sm:-mx-5 sm:px-5">
          <OtpInput
            value={code}
            onChange={(next) => {
              setError(null);
              setCode(next);
            }}
          />
          {error ? (
            <p className="mt-4 text-[13px] leading-relaxed text-danger-text">{error}</p>
          ) : null}
          <Button
            variant="link"
            className="mt-5 w-full"
            disabled={busy}
            onClick={async () => {
              if (await sendCode()) toast.info("A fresh code is on its way");
            }}
          >
            Didn't get it? Resend code
          </Button>
        </div>
      )}
    </Sheet>
  );
}
