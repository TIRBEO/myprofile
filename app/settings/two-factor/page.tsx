"use client";

import { useState } from "react";
import { Button, Sheet, SheetActions, cn } from "@/components/ig-ui";
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
  type RevealedCodes,
  type TwoFactorState,
  confirmSetup,
  disableAuthenticator,
  saveTwoFactorPrefs,
  startSetup,
  useTwoFactorState,
} from "@/lib/two-factor";
import { formatKey, secretFromUri } from "@/lib/totp";
import { formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
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
    if (next) void beginSetup();
    else setOffSheet(true);
  }

  /** Proof first, secret second: a pending setup that nobody authorised would
      sit on the account row as a half-installed authenticator. */
  async function beginSetup() {
    try {
      setUri(await guard((proof) => startSetup(proof)));
    } catch (err) {
      if (wasDeclined(err)) return;
      haptic("error");
      toast.error(err instanceof Error ? err.message : "Couldn’t reach the account service");
    }
  }

  async function savePref(next: Partial<Pick<TwoFactorState, "requireForActions" | "alertSuspicious">>) {
    const prev = state!;
    set({ ...prev, ...next });
    try {
      await saveTwoFactorPrefs(next);
    } catch (err) {
      set(prev);
      toast.error(err instanceof Error ? err.message : "Couldn’t save that change");
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
          sub="Ask for a code before changing password, email or payouts."
          on={state.requireForActions}
          onChange={(v) => savePref({ requireForActions: v })}
          label="Require 2FA for sensitive actions"
        />
        <ToggleRow
          title="Alert on suspicious sign-in"
          sub="Email me if a sign-in looks unusual."
          on={state.alertSuspicious}
          onChange={(v) => savePref({ alertSuspicious: v })}
          label="Alert on suspicious sign-in"
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
   Losing the app also retires the backup codes, so the consequences are
   listed before anything is asked for. The code from the app is the proof
   the account service wanted — a stronger answer than a password, and the
   sheet only asks once.                                 */

function TurnOffSheet({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const [stage, setStage] = useState<"warn" | "proof">("warn");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { guard, reauthDialog } = useReauthGuard();
  const ready = code.every((d) => d !== "");

  async function confirm() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await guard((proof) => disableAuthenticator(code.join(""), proof));
      onConfirm();
    } catch (err) {
      haptic("error");
      // Walking away from the extra question changes nothing — the sheet stays
      // up with the code already typed.
      if (!wasDeclined(err)) setError(err instanceof Error ? err.message : "Couldn’t reach the account service");
      setCode(["", "", "", "", "", ""]);
    } finally {
      setBusy(false);
    }
  }

  if (stage === "warn") {
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
            onConfirm={() => setStage("proof")}
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

  return (
    <>
      <Sheet
        title="Confirm it’s you"
        description="Turning the authenticator off is a change an intruder would want to make, so it wants a code from the app you’re about to switch off."
        onClose={onClose}
        footer={
          <SheetActions
            cancelLabel="Back"
            onCancel={() => setStage("warn")}
            confirmLabel="Turn off"
            confirmVariant="danger"
            onConfirm={confirm}
            disabled={!ready}
            loading={busy}
          />
        }
      >
        <div className="-mx-4 space-y-5 px-5 pb-2 pt-1 sm:-mx-5">
          <div>
            <FieldLabel>Code from your app</FieldLabel>
            <OtpInput value={code} onChange={(next) => { setError(null); setCode(next); }} />
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
  const [step, setStep] = useState<"qr" | "otp">("qr");
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
    try {
      // The code IS the proof here, so this call goes straight through.
      onVerified(await confirmSetup(code.join("")));
    } catch (err) {
      haptic("error");
      setError(err instanceof Error ? err.message : "Couldn’t verify that code");
      setCode(["", "", "", "", "", ""]);
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      /* clipboard blocked — the key is still readable on screen */
    }
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
              setError(null);
            }}
            confirmLabel="Confirm"
            onConfirm={confirm}
            disabled={!codeFull}
            loading={busy}
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
      ) : (
        <div className="-mx-4 px-5 pb-2 pt-1 sm:-mx-5">
          <OtpInput value={code} onChange={(next) => { setError(null); setCode(next); }} />
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
      )}
    </Sheet>
  );
}
