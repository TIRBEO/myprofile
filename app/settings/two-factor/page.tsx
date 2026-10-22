"use client";

import { useState } from "react";
import { Button, Input, Sheet, SheetActions, cn } from "@/components/ig-ui";
import { OtpInput } from "@/components/otp-input";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { BackupCodesSheet } from "@/components/backup-codes-sheet";
import { TotpQr } from "@/components/totp-qr";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import {
  CODE_COUNT,
  PREF_KEYS,
  type RevealedCodes,
  type TwoFactorState,
  confirmSetup,
  disableAuthenticator,
  startSetup,
  useTwoFactorState,
} from "@/lib/two-factor";
import { formatKey, secretFromUri } from "@/lib/totp";
import { formatStamp } from "@/lib/dates";
import { persistNow, setStoredLocal } from "@/lib/remote-store";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { trackError, trackEvent, withRef } from "@/lib/telemetry";
import { usePageRefresh } from "@/lib/page-refresh";
import { Check, Copy } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Two-factor authentication.

   One card per group, same vocabulary as the rest of settings. The status
   card and every row are a single tap target — the switch inside them is
   decoration, never the only clickable part.

   The account service owns all of it: the secret, the codes, and whether
   the authenticator is on. Because switching it on or off changes how the
   real sign-in works, both are step-up actions: the shared "Confirm it's
   you" sheet (components/reauth-sheet) asks for whatever this account can
   actually offer, and turning off asks for a live code from the app as
   well. A set of backup codes arrives in the same reply that switched the
   authenticator on, is shown there once, and is never readable again.
   ═══════════════════════════════════════════════════════════════════ */

export default function TwoFactorPage() {
  const { state, failed, refresh, set } = useTwoFactorState();
  /* The provisioning URI doubles as "setup is underway": the sheet only exists
     once the service has minted a secret, which happens after the proof. */
  const [uri, setUri] = useState<string | null>(null);
  const [offSheet, setOffSheet] = useState(false);
  const [codes, setCodes] = useState<RevealedCodes | null>(null);
  /* One write in flight at a time: a second optimistic flip while the first
     persist is still on the wire races the account's answer. */
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { guard, reauthDialog } = useReauthGuard();

  usePageRefresh(refresh);

  if (failed) {
    return (
      <SettingsPage title="Two-factor authentication">
        <Helper lead tone="danger">
          The account service didn’t answer, so nothing here is known to be true.{" "}
          <button type="button" className="font-semibold underline" onClick={refresh}>
            Try again
          </button>
          .
        </Helper>
      </SettingsPage>
    );
  }

  if (!state) return <PageSkeleton title="Two-factor authentication" />;

  const on = state.authenticator;
  const codesLeft = state.codes.remaining;

  // Tapping anywhere on the row lands here — the switch is a visual.
  function toggleAuthenticator(next: boolean) {
    if (busy) return;
    if (next) void beginSetup();
    else setOffSheet(true);
  }

  /** Proof first, secret second: a pending setup that nobody authorised would
      sit on the account row as a half-installed authenticator. */
  async function beginSetup() {
    setBusy(true);
    try {
      setUri(await guard((proof) => startSetup(proof)));
      trackEvent("settings.2fa_setup_started");
    } catch (err) {
      if (wasDeclined(err)) return;
      trackError("two-factor.start-setup", err);
      haptic("error");
      toast.error(withRef(err instanceof Error ? err.message : "Couldn’t reach the account service", err));
    } finally {
      setBusy(false);
    }
  }

  /** Extra-security switches ride the account's settings write path: the
      optimistic bag write lets the store roll a refused value back and name
      it on the hub's failure channel, the awaited persistNow lets this toast
      report what the account actually answered. Requiring 2FA for actions is
      the policy column — the brain still refuses it without an enrolled
      factor, and the row can't move until the authenticator is on. */
  async function savePref(next: Partial<Pick<TwoFactorState, "requireForActions" | "alertSuspicious">>) {
    if (busy) return;
    const prev = state!;
    setBusy(true);
    set({ ...prev, ...next });
    try {
      for (const [field, value] of Object.entries(next) as [keyof typeof PREF_KEYS, boolean][]) {
        const key = PREF_KEYS[field];
        setStoredLocal(key, value);
        await persistNow(key, value);
      }
      trackEvent("settings.2fa_pref_changed", { metadata: { ...next } });
    } catch (err) {
      set(prev);
      trackError("two-factor.save-pref", err);
      toast.error(withRef(err instanceof Error ? err.message : "Couldn’t save that change", err));
    } finally {
      setBusy(false);
    }
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
          on={on}
          onChange={toggleAuthenticator}
          label="Authenticator app"
          busy={busy}
        />
        <LinkRow
          title="Backup codes"
          sub={
            on
              ? codesLeft
                ? `${codesLeft} of ${state.codes.total} still unused.`
                : "Every code in the current set is spent."
              : "Turn on the authenticator app to get a set."
          }
          href="/settings/backup-codes"
          disabled={!on}
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
          sub={
            on
              ? "Ask for a code from your app as well as the password before sensitive actions — changing your password, removing a passkey, signing out everywhere, deleting the account."
              : "Needs the authenticator app on first — requiring a code you can't produce would lock you out."
          }
          on={state.requireForActions}
          onChange={(v) => savePref({ requireForActions: v })}
          label="Require 2FA for sensitive actions"
          disabled={!on}
          busy={busy}
          blockedHint={() => toast.error("Turn on the authenticator app first")}
        />
        <ToggleRow
          title="Alert on suspicious sign-in"
          sub="Email me when a sign-in comes from a device we haven't seen before. A new IP on a known device won't."
          on={state.alertSuspicious}
          onChange={(v) => savePref({ alertSuspicious: v })}
          label="Alert on suspicious sign-in"
          busy={busy}
        />
      </Group>

      {uri ? (
        <AuthenticatorSheet
          uri={uri}
          onClose={() => setUri(null)}
          onVerified={(fresh) => {
            setUri(null);
            setCodes(fresh);
            refresh();
          }}
        />
      ) : null}

      {offSheet ? (
        <TurnOffSheet
          onClose={() => setOffSheet(false)}
          onConfirm={() => {
            setOffSheet(false);
            refresh();
            toast.success("Authenticator app turned off");
          }}
        />
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

      {reauthDialog}
    </SettingsPage>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </span>
  );
}

/* ── Turn-off confirmation: a live code ───────────────────────────
   One sheet: losing the app also retires the backup codes, so the
   consequences are listed at the top and the proof goes right under them.
   The code from the app is the answer the account service wanted — stronger
   than a password — and the sheet only asks once.
   ───────────────────────────────────────────────────────────────── */

function TurnOffSheet({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [useBackup, setUseBackup] = useState(false);
  const [backup, setBackup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { guard, reauthDialog } = useReauthGuard();
  const ready = useBackup ? backup.trim().length > 0 : code.every((d) => d !== "");

  async function confirm() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    // The code about to be spent — as a method name, never the code.
    trackEvent(useBackup ? "auth.backup_code_used" : "auth.2fa_submit", {
      detail: "2fa_disable",
    });
    try {
      await guard((proof) =>
        disableAuthenticator(useBackup ? { backupCode: backup.trim() } : { code: code.join("") }, proof),
      );
      trackEvent("settings.2fa_disabled", { metadata: { via: useBackup ? "backup_code" : "totp" } });
      onConfirm();
    } catch (err) {
      haptic("error");
      // Walking away from the extra question changes nothing — the sheet stays
      // up with the code already typed.
      if (!wasDeclined(err)) {
        trackError("two-factor.disable", err);
        setError(withRef(err instanceof Error ? err.message : "Couldn’t reach the account service", err));
      }
      setCode(["", "", "", "", "", ""]);
      setBackup("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet
        title="Turn off the authenticator app?"
        description="Turning it off is a change an intruder would want to make, so it wants a code from the app you’re about to switch off — or one of your backup codes."
        onClose={onClose}
        footer={
          <SheetActions
            cancelLabel="Keep it on"
            onCancel={onClose}
            confirmLabel="Turn off"
            confirmVariant="danger"
            onConfirm={confirm}
            disabled={!ready}
            loading={busy}
          />
        }
      >
        <ul className="-mx-4 space-y-2.5 px-5 text-[14px] leading-relaxed text-muted sm:-mx-5">
          <li>· Sign-ins stop asking for a code from your app.</li>
          <li>· Your current backup codes stop working.</li>
          <li>· Email codes stay on.</li>
        </ul>

        <div className="-mx-4 mt-5 space-y-5 border-t border-divider px-5 pb-2 pt-5 sm:-mx-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel>{useBackup ? "Backup code" : "Code from your app"}</FieldLabel>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setUseBackup((v) => !v);
                }}
                className="btn btn-secondary"
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
                onKeyDown={(e) => e.key === "Enter" && confirm()}
                placeholder="8-character backup code"
                autoComplete="one-time-code"
                maxLength={8}
                className="font-mono tracking-[0.15em]"
              />
            ) : (
              <OtpInput value={code} onChange={(next) => { setError(null); setCode(next); }} onEnter={confirm} />
            )}
          </div>
          {error ? <p className="text-[13px] leading-relaxed text-danger-text">{error}</p> : null}
        </div>
      </Sheet>
      {reauthDialog}
    </>
  );
}

/* ── Authenticator setup: scan → enter code ───────────────────────── */

function AuthenticatorSheet({
  uri,
  onClose,
  onVerified,
}: {
  uri: string;
  onClose: () => void;
  onVerified: (codes: RevealedCodes) => void;
}) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeFull = code.every((d) => d !== "");
  // The QR and the key below it are the same secret, which the service minted.
  const secret = secretFromUri(uri);

  async function confirm() {
    if (!codeFull || busy) return;
    setBusy(true);
    setError(null);
    trackEvent("auth.2fa_submit", { detail: "2fa_setup_confirm" });
    try {
      // The code IS the proof here, so this call goes straight through.
      const fresh = await confirmSetup(code.join(""));
      trackEvent("settings.2fa_enabled", { metadata: { codesMinted: fresh.codes.length } });
      onVerified(fresh);
    } catch (err) {
      haptic("error");
      trackError("two-factor.confirm-setup", err);
      setError(withRef(err instanceof Error ? err.message : "Couldn’t verify that code", err));
      setCode(["", "", "", "", "", ""]);
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch (err) {
      trackError("two-factor.copy-key", err);
      /* clipboard blocked — the key is still readable on screen */
    }
  }

  return (
    <Sheet
      title="Set up authenticator app"
      description="Scan this with your app or type the setup key in, then send the 6-digit code it is showing right now."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel="Turn on two-factor"
          onConfirm={confirm}
          disabled={!codeFull}
          loading={busy}
        />
      }
    >
      <div className="-mx-4 flex flex-col items-center px-5 py-2 sm:-mx-5">
          <TotpQr value={uri} />
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-muted">
            Scans into any authenticator app. The key below is the same code the QR carries.
          </p>
          <div className="mt-5 w-full rounded-lg bg-surface-2 px-4 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Setup key</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="break-all font-mono text-[14.5px] font-semibold tracking-[0.08em] text-fg">
                {formatKey(secret)}
              </span>
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                onClick={copyKey}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
      </div>
      <div className="-mx-4 px-5 pb-2 pt-5 sm:-mx-5">
          <OtpInput value={code} onChange={(next) => { setError(null); setCode(next); }} onEnter={confirm} />
          <p
            className={cn(
              "mt-4 text-center text-[13px] leading-relaxed",
              error ? "text-danger-text" : "text-muted",
            )}
          >
            {error
              ? `${error} Codes change every 30 seconds — try the one showing now.`
              : `The code rotates every 30 seconds, so send it right after it appears. A correct code switches two-factor on and issues ${CODE_COUNT} backup codes.`}
          </p>
      </div>
    </Sheet>
  );
}
