"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  PasswordField,
  Segmented,
  Sheet,
  SheetActions,
} from "@/components/ig-ui";
import { OtpInput } from "@/components/otp-input";
import { haptic } from "@/lib/haptics";
import { ApiError } from "@/lib/api";
import {
  ReauthDeclined,
  needsReauth,
  offeredMethods,
  sendReauthCode,
  type ReauthMethod,
  type ReauthProof,
} from "@/lib/reauth";

/* ═══════════════════════════════════════════════════════════════════
   "Confirm it's you"

   One dialog for every action the account service refuses until it gets a
   fresh proof — removing a passkey, regenerating backup codes, signing other
   devices out, disconnecting an app, deleting the account. Before this each
   screen guessed at a password box (which an account signed in through Google
   has never had), so the honest answer was a field that could not be filled.

   What appears here is decided by the service, not by the page: a refusal
   arrives carrying the doors *this* account can open, and only those are
   offered. Closing the dialog changes nothing on the account — the action
   simply never ran.
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
    place instead of dumping the person back on the page they came from. */
function proofRejection(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  if (!["INVALID_CODE", "INVALID_PASSWORD", "REAUTH_RATE_LIMITED"].includes(err.code || "")) return null;
  return err.message;
}

const CODE_SECONDS = 30;

export function ReauthSheet({
  methods,
  error,
  onProof,
  onCancel,
}: {
  methods: ReauthMethod[];
  /** Seeded when a previous proof was refused; cleared as soon as they type. */
  error: string | null;
  onProof: (proof: ReauthProof) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<ReauthMethod>(methods[0]);
  const [password, setPassword] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [sentTo, setSentTo] = useState("");
  const [sending, setSending] = useState(false);
  const [againIn, setAgainIn] = useState(0);
  const [notice, setNotice] = useState(error);

  const code = digits.join("");
  const full = code.length === 6;
  const ready = method === "password" ? password.length > 0 : full;

  useEffect(() => {
    if (againIn <= 0) return;
    const timer = window.setTimeout(() => setAgainIn((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [againIn]);

  function choose(next: ReauthMethod) {
    setMethod(next);
    setNotice(null);
    setDigits(["", "", "", "", "", ""]);
    setPassword("");
  }

  function submit() {
    if (!ready) return;
    haptic("medium");
    if (method === "password") return onProof({ password });
    // The emailed code and the authenticator code are different proofs to the
    // service, and it reads them from different fields — a mix-up here would
    // spend the wrong one.
    onProof(method === "code" ? { reauthCode: code } : { code });
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
      setNotice(err instanceof Error && err.message ? err.message : "The code couldn't be sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      title="Confirm it's you"
      description="This one changes your account, so a signed-in browser isn't enough. Verify your identity to continue."
      onClose={onCancel}
      footer={
        <SheetActions
          cancelLabel="Not now"
          onCancel={onCancel}
          confirmLabel="Confirm"
          disabled={!ready}
          onConfirm={submit}
        />
      }
    >
      <div className="-mx-4 px-4 pb-2 sm:-mx-5 sm:px-5">
        {methods.length > 1 ? (
          <Segmented
            label="How would you like to verify?"
            value={method}
            onChange={choose}
            options={methods.map((m) => ({ value: m, label: LABEL[m] }))}
          />
        ) : null}
      </div>

      {method === "password" ? (
        <Field label="Password" error={notice} hint={PROMPT.password}>
          <PasswordField
            value={password}
            onChange={(next) => {
              setPassword(next);
              setNotice(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
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
          <Button variant="secondary" block loading={sending} disabled={againIn > 0} onClick={request}>
            {againIn > 0 ? `Resend in ${againIn}s` : sentTo ? "Send a new code" : "Send me a code"}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

/* ── The page side of it ─────────────────────────────────────────── */

type Pending = {
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
  const open = useRef<(methods: ReauthMethod[], error: string | null) => Promise<ReauthProof | null>>(
    async () => null,
  );

  // The dialog is state the *action* needs to see, so the promise lives here
  // and the component only reports what the person typed.
  open.current = (methods, error) =>
    new Promise<ReauthProof | null>((resolve) => {
      setPending({
        methods,
        error,
        settle: (proof) => {
          setPending(null);
          resolve(proof);
        },
      });
    });

  const guard = useCallback(async <T,>(action: (proof: ReauthProof) => Promise<T>): Promise<T> => {
    let proof: ReauthProof = {};
    let ask: { methods: ReauthMethod[]; error: string | null } = { methods: ["password", "code"], error: null };
    for (;;) {
      try {
        return await action(proof);
      } catch (err) {
        if (needsReauth(err)) {
          // First refusal: the service itself says which proofs this account has.
          ask = { methods: offeredMethods(err), error: null };
        } else {
          const complaint = proofRejection(err);
          // A refused proof belongs to this dialog, so it comes back to this
          // dialog. Anything else is the action's own problem.
          if (!complaint || !Object.keys(proof).length) throw err;
          ask = { ...ask, error: complaint };
        }
      }
      const answer = await open.current(ask.methods, ask.error);
      if (!answer) throw new ReauthDeclined();
      proof = answer;
    }
  }, []);

  return {
    guard,
    reauthDialog: pending ? (
      <ReauthSheet
        methods={pending.methods}
        error={pending.error}
        onProof={(proof) => pending.settle(proof)}
        onCancel={() => pending.settle(null)}
      />
    ) : null,
  };
}
