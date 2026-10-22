"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  PasswordField,
  Sheet,
  SheetActions,
} from "@/components/ig-ui";
import { OtpInput } from "@/components/otp-input";
import { haptic } from "@/lib/haptics";
import { ApiError } from "@/lib/api";
import { trackError, trackEvent, withRef } from "@/lib/telemetry";
import {
  ReauthDeclined,
  needsReauth,
  offeredMethods,
  sendReauthCode,
  type ReauthMethod,
  type ReauthProof,
} from "@/lib/reauth";

/* ═══════════════════════════════════════════════════════════════════
   "Confirm it's you" — every door, in order

   One dialog for every action the account service refuses until it gets a
   fresh proof — removing a passkey, regenerating backup codes, signing other
   devices out, disconnecting an app, deleting the account. The service
   answers its refusal with the ordered CHAIN this account must walk — the
   password first, then a code emailed to the sign-in address, then the
   authenticator when "require 2FA for sensitive actions" is switched on —
   and the sheet works down the list one step at a time. Whatever is typed
   is folded into a single proof and handed back at the end; the action runs
   once, with all of it.

   Closing the dialog changes nothing on the account — the action simply
   never ran. A refused proof restarts the walk from the top: the emailed
   code was spent either way, so nothing below the refusal could be reused.
   ═══════════════════════════════════════════════════════════════════ */

const LABEL: Record<ReauthMethod, string> = {
  password: "Password",
  totp: "Authenticator",
  code: "Email code",
  passkey: "Passkey",
};

const PROMPT: Record<ReauthMethod, string> = {
  password: "Your password, not the one you're changing.",
  totp: "The 6 digits your authenticator app shows right now.",
  code: "We'll send a 6-digit code to the address you sign in with.",
  passkey: "Sign in with one of your passkeys again.",
};

/** A reply that means "that proof didn't work", so the dialog can say so in
    place instead of dumping the person back on the page they came from.
    `SECOND_FACTOR_REQUIRED` is the account's "require 2FA" policy speaking:
    everything before the authenticator was right, and the code is what's
    still owed. */
function proofRejection(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  if (!["INVALID_CODE", "INVALID_PASSWORD", "REAUTH_RATE_LIMITED", "SECOND_FACTOR_REQUIRED"].includes(err.code || "")) return null;
  return err.message;
}

const CODE_SECONDS = 30;

export function ReauthSheet({
  methods,
  error,
  busy,
  onProof,
  onCancel,
}: {
  /** The ordered chain the service demanded — every step is required. */
  methods: ReauthMethod[];
  /** Seeded when a previous proof was refused; cleared as soon as they type. */
  error: string | null;
  /** The proof was given and the account is spending it — the dialog stays
      up saying "Checking…" rather than vanishing into a silent few seconds. */
  busy: boolean;
  onProof: (proof: ReauthProof) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ReauthProof>({});
  const [password, setPassword] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [sentTo, setSentTo] = useState("");
  const [sending, setSending] = useState(false);
  const [againIn, setAgainIn] = useState(0);
  const [notice, setNotice] = useState(error);

  const method = methods[Math.min(step, methods.length - 1)];
  const code = digits.join("");
  const full = code.length === 6;
  const ready = method === "password" ? password.length > 0 : full;
  const last = step >= methods.length - 1;

  useEffect(() => {
    if (againIn <= 0) return;
    const timer = window.setTimeout(() => setAgainIn((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [againIn]);

  /** Answer this step, then either walk to the next or hand the whole
      collected proof back. The emailed code and the authenticator code are
      different proofs to the service, and it reads them from different
      fields — a mix-up here would spend the wrong one. */
  function advance() {
    if (!ready || busy) return;
    const answer: ReauthProof =
      method === "password" ? { password } : method === "code" ? { reauthCode: code } : { code };
    const merged = { ...answers, ...answer };
    if (!last) {
      setAnswers(merged);
      setStep(step + 1);
      setDigits(["", "", "", "", "", ""]);
      setNotice(null);
      haptic("light");
      return;
    }
    haptic("medium");
    // Which steps were walked — never the answers themselves.
    trackEvent("auth.2fa_submit", {
      detail: "chain_proof",
      metadata: { steps: methods.join(",") },
    });
    onProof(merged);
  }

  async function request() {
    if (sending || againIn > 0) return;
    setSending(true);
    setNotice(null);
    try {
      const reply = await sendReauthCode();
      setSentTo(reply.email);
      setAgainIn(CODE_SECONDS);
      haptic("success");
    } catch (err) {
      trackError("reauth.send-code", err);
      setNotice(
        withRef(
          err instanceof Error && err.message ? err.message : "The code couldn't be sent",
          err,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      title="Confirm it's you"
      description="This one changes your account, so a signed-in browser isn't enough. Verify your identity to continue."
      onClose={busy ? () => {} : onCancel}
      footer={
        <SheetActions
          cancelLabel="Not now"
          onCancel={() => { if (!busy) onCancel(); }}
          confirmLabel={busy ? "Checking…" : last ? "Confirm" : "Continue"}
          disabled={!ready}
          loading={busy}
          onConfirm={advance}
        />
      }
    >
      {methods.length > 1 ? (
        <p
          className="mb-4 text-center text-[12px] font-semibold uppercase tracking-wide text-muted"
          style={{ animation: "ig-fade 450ms ease-out backwards" }}
        >
          Step {step + 1} of {methods.length} · {LABEL[method]}
        </p>
      ) : null}

      {method === "password" ? (
        <Field label="Password" error={notice} hint={PROMPT.password}>
          <PasswordField
            value={password}
            onChange={(next) => {
              setPassword(next);
              setNotice(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && advance()}
            autoFocus
          />
        </Field>
      ) : (
        <Field
          label={method === "code" ? "Code from your email" : "Authenticator code"}
          error={notice}
          hint={PROMPT[method]}
        >
          <OtpInput
            value={digits}
            onChange={(next) => {
              setDigits(next);
              setNotice(null);
            }}
            onEnter={advance}
          />
        </Field>
      )}

      {method === "code" ? (
        <div className="px-4 pb-4 sm:px-5">
          {sentTo ? (
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              Sent to <span className="font-semibold text-fg">{sentTo}</span>. It works once, for
              15 minutes.
            </p>
          ) : null}
          <Button variant="secondary" block loading={sending} disabled={againIn > 0 || busy || sending} onClick={request}>
            {againIn > 0 ? `Resend in ${againIn}s` : sentTo ? "Send a new code" : "Send me a code"}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

/* ── The page side of it ─────────────────────────────────────────── */

type Pending = {
  /** Bumped each time the dialog is (re)opened, so a refused proof remounts
      it — the error seeds the field and the refused answer is wiped. */
  round: number;
  methods: ReauthMethod[];
  error: string | null;
  settle: (proof: ReauthProof | null) => void;
};

/**
 * Wrap a sensitive call and the dialog comes with it:
 *
 *   const { guard, reauthDialog } = useReauthGuard();
 *   await guard((proof) => removePasskey(id, proof));
 *   …
 *   {reauthDialog}
 *
 * `guard` runs the action with no proof first. If the service refuses, it
 * waits for the person to answer, then re-runs the very same call with the
 * proof in the body — which is why `action` must be safe to call twice and
 * must not have touched anything before the refusal. A wrong proof reopens
 * the dialog with the service's own words in it; closing it throws
 * `ReauthDeclined`, which pages report as nothing at all.
 */
export function useReauthGuard() {
  const [pending, setPending] = useState<Pending | null>(null);
  /** The sheet stays open in "Checking…" between the proof being given and
      the retried action answering — the wait is the dialog's business. */
  const [checking, setChecking] = useState(false);
  const round = useRef(0);
  const open = useRef<(methods: ReauthMethod[], error: string | null) => Promise<ReauthProof | null>>(
    async () => null,
  );

  // The dialog is state the *action* needs to see, so the promise lives here
  // and the component only reports what the person typed.
  open.current = (methods, error) => {
    const id = ++round.current;
    return new Promise<ReauthProof | null>((resolve) => {
      setChecking(false);
      setPending({
        round: id,
        methods,
        error,
        settle: (proof) => {
          // Settling hands the proof to the guard but keeps the sheet up,
          // busy, until the retried action says what happened.
          resolve(proof);
          setChecking(proof !== null);
        },
      });
    });
  };

  const guard = useCallback(async <T,>(action: (proof: ReauthProof) => Promise<T>): Promise<T> => {
    let proof: ReauthProof = {};
    let ask: { methods: ReauthMethod[]; error: string | null } = { methods: ["password", "code"], error: null };
    for (;;) {
      try {
        const out = await action(proof);
        setPending(null);
        setChecking(false);
        return out;
      } catch (err) {
        if (needsReauth(err)) {
          // First refusal: the service itself says which proofs this account has.
          ask = { methods: offeredMethods(err), error: null };
        } else {
          const complaint = proofRejection(err);
          // A refused proof belongs to this dialog, so it comes back to this
          // dialog. Anything else is the action's own problem.
          if (!complaint || !Object.keys(proof).length) {
            setPending(null);
            setChecking(false);
            throw err;
          }
          trackEvent("auth.reauth_failed", {
            detail: "proof_refused",
            metadata: { code: err instanceof ApiError ? err.code : undefined },
          });
          ask = { ...ask, error: complaint };
          // The account's 2FA policy refusing the authenticator link: the
          // chain itself doesn't change, only the news that this step went
          // wrong. The walk restarts at the top — the emailed code was spent
          // or never reached, so nothing can be carried over.
        }
      }
      const answer = await open.current(ask.methods, ask.error);
      if (!answer) {
        // Walking away is an answer too — the action never ran.
        setPending(null);
        setChecking(false);
        trackEvent("auth.reauth_declined", { detail: "sheet_closed" });
        throw new ReauthDeclined();
      }
      proof = answer;
    }
  }, []);

  return {
    guard,
    reauthDialog: pending ? (
      <ReauthSheet
        key={pending.round}
        methods={pending.methods}
        error={pending.error}
        busy={checking}
        onProof={(proof) => pending.settle(proof)}
        onCancel={() => pending.settle(null)}
      />
    ) : null,
  };
}
