"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetActions, cn } from "@/components/ig-ui";
import { OtpInput } from "@/components/otp-input";
import {
  Group,
  LinkRow,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { BackupCodesSheet } from "@/components/backup-codes-sheet";
import { TotpQr } from "@/components/totp-qr";
import { type CodeSet, clearCodes, cooldownLabel, generate } from "@/lib/backup-codes";
import { formatStamp } from "@/lib/dates";
import {
  clearSecret,
  formatKey,
  loadOrCreateSecret,
  provisioningUri,
  verifyCode,
} from "@/lib/totp";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { Check, Copy } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Two-factor authentication.

   One card per group, same vocabulary as the rest of settings. The
   status card and every row are a single tap target — the switch inside
   them is decoration, never the only clickable part. Turning the
   authenticator off asks first, because it also retires the backup
   codes. Email codes show an on switch that can't be moved: a tap there
   answers with an error toast instead of doing nothing.

   Setup is one secret shown two ways — as the QR and as the key you can
   type — and the 6 digits you enter are checked against it before
   two-factor switches on. Finishing issues a set of backup codes and
   reveals it right there, once.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:two-factor";
const RECOVERY_KEY = "tirbeo:recovery-email";

type Prefs = {
  authenticator: boolean;
  requireForActions: boolean;
  alertSuspicious: boolean;
};

const DEFAULT: Prefs = {
  authenticator: true,
  requireForActions: true,
  alertSuspicious: true,
};

export default function TwoFactorPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [authSheet, setAuthSheet] = useState(false);
  const [offSheet, setOffSheet] = useState(false);
  const [codes, setCodes] = useState<CodeSet | null>(null);
  const [account, setAccount] = useState("your Tirbeo account");
  const toast = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setPrefs({ ...DEFAULT, ...(JSON.parse(raw) as Partial<Prefs>) });
      const email = localStorage.getItem(RECOVERY_KEY);
      if (email) setAccount(email);
    } catch {
      /* unreadable blob — keep the defaults */
    }
  }, []);

  // Written straight through to localStorage, not inside the state updater:
  // the backup-codes page reads this key the instant setup finishes.
  function commit(next: Partial<Prefs>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try {
      localStorage.setItem(STORE, JSON.stringify(merged));
    } catch {
      /* private mode — the change still holds for this session */
    }
  }

  // Tapping anywhere on the row lands here — the switch is a visual.
  function toggleAuthenticator(on: boolean) {
    if (on) setAuthSheet(true);
    else setOffSheet(true);
  }

  function turnOff() {
    commit({ authenticator: false });
    clearSecret();
    clearCodes();
    setOffSheet(false);
    toast.error("Authenticator app turned off");
  }

  return (
    <SettingsPage title="Two-factor authentication">
      <SectionTitle
        desc={<>Email codes go to your recovery email and can&apos;t be turned off — it&apos;s the one method that always works, even without an app.</>}
      >
        Methods
      </SectionTitle>
      <Group>
        <ToggleRow
          title="Authenticator app"
          sub="Codes from an app like Google Authenticator."
          on={prefs.authenticator}
          onChange={toggleAuthenticator}
          label="Authenticator app"
        />
        <LinkRow
          title="Backup codes"
          sub={
            prefs.authenticator
              ? "One-time codes, shown once each time you generate them."
              : "Generated automatically when the authenticator app is on."
          }
          href="/settings/backup-codes"
          disabled={!prefs.authenticator}
          blockedHint={() => toast.error("Turn on two-factor to get backup codes")}
        />
        <ToggleRow
          title="Email codes"
          sub="Codes sent to your recovery email."
          on
          disabled
          locked
          blockedHint={() => toast.error("Email codes are always on and can't be turned off")}
        />
      </Group>

      {/* ── Extra security ── */}
      <SectionTitle>Extra security</SectionTitle>
      <Group>
        <ToggleRow
          title="Require 2FA for sensitive actions"
          sub="Ask for a code before changing password, email or payouts."
          on={prefs.requireForActions}
          onChange={(v) => commit({ requireForActions: v })}
          label="Require 2FA for sensitive actions"
        />
        <ToggleRow
          title="Alert on suspicious sign-in"
          sub="Email me if a sign-in looks unusual."
          on={prefs.alertSuspicious}
          onChange={(v) => commit({ alertSuspicious: v })}
          label="Alert on suspicious sign-in"
        />
      </Group>

      {authSheet ? (
        <AuthenticatorSheet
          account={account}
          onClose={() => setAuthSheet(false)}
          onVerified={() => {
            commit({ authenticator: true });
            setAuthSheet(false);
            const result = generate();
            if (result.ok) setCodes(result.fresh);
            else toast.error(`Code limit reached — try again in ${cooldownLabel(result.retryInMs)}`);
          }}
        />
      ) : null}

      {offSheet ? (
        <TurnOffSheet onClose={() => setOffSheet(false)} onConfirm={turnOff} />
      ) : null}

      {codes ? (
        <BackupCodesSheet
          set={codes}
          stamp={formatStamp(codes.createdAt)}
          onDone={() => {
            setCodes(null);
            toast.success("Two-factor is on");
          }}
        />
      ) : null}
    </SettingsPage>
  );
}

/* ── Turn-off confirmation ───────────────────────────────────────
   Losing the app also retires the backup codes, so the consequences
   are listed before the switch flips.                             */

function TurnOffSheet({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet
      title="Turn off the authenticator app?"
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Keep it on"
          onCancel={onClose}
          confirmLabel="Turn off"
          confirmVariant="danger"
          onConfirm={onConfirm}
        />
      }
    >
      <ul className="-mx-4 space-y-2.5 px-5 text-[14px] leading-relaxed text-muted sm:-mx-5">
        <li>· Sign-ins stop asking for a code from your app.</li>
        <li>· Your current backup codes stop working.</li>
        <li>· Email codes stay on.</li>
      </ul>
    </Sheet>
  );
}

/* ── Authenticator setup sheet: scan → enter code ────────────────── */

function AuthenticatorSheet({
  account,
  onClose,
  onVerified,
}: {
  account: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  // One secret, two views: the QR carries it, the key prints it.
  const [secret] = useState(loadOrCreateSecret);
  const [step, setStep] = useState<"qr" | "otp">("qr");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const codeFull = code.every((d) => d !== "");
  const uri = provisioningUri(secret, account);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      /* clipboard blocked — the key is still readable on screen */
    }
  }

  async function confirm() {
    if (!codeFull || checking) return;
    setChecking(true);
    const matched = await verifyCode(secret, code.join(""));
    setChecking(false);
    if (matched) {
      onVerified();
      return;
    }
    haptic("error");
    setWrong(true);
    setCode(["", "", "", "", "", ""]);
  }

  return (
    <Sheet
      title="Set up authenticator app"
      description={
        step === "qr"
          ? "Scan this with your app, or type the setup key in by hand."
          : "Type the 6-digit code your app is showing right now."
      }
      onClose={onClose}
      footer={
        step === "qr" ? (
          <SheetActions cancelLabel="Cancel" onCancel={onClose} confirmLabel="Next" onConfirm={() => setStep("otp")} />
        ) : (
          <SheetActions
            cancelLabel="Back"
            onCancel={() => {
              setStep("qr");
              setWrong(false);
            }}
            confirmLabel="Confirm"
            onConfirm={confirm}
            disabled={!codeFull}
            loading={checking}
          />
        )
      }
    >
      {step === "qr" ? (
        <div className="-mx-4 flex flex-col items-center px-5 py-2 sm:-mx-5">
          <TotpQr value={uri} />
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-muted">
            Scans into any authenticator app. The key below is the same code the QR carries.
          </p>
          <div className="mt-5 w-full rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Setup key</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="break-all font-mono text-[14.5px] font-semibold tracking-[0.08em] text-fg">
                {formatKey(secret)}
              </span>
              <button
                type="button"
                onClick={copyKey}
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fg transition hover:brightness-110 active:brightness-95"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="-mx-4 px-5 pb-2 pt-1 sm:-mx-5">
          <OtpInput value={code} onChange={(next) => { setWrong(false); setCode(next); }} />
          <p
            className={cn(
              "mt-4 text-center text-[13px] leading-relaxed",
              wrong ? "text-danger-text" : "text-muted",
            )}
          >
            {wrong
              ? "That code didn't match. Codes change every 30 seconds — try the one showing now."
              : "The code rotates every 30 seconds, so send it right after it appears."}
          </p>
        </div>
      )}
    </Sheet>
  );
}
