"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BlockedView, type Kind } from "./blocked-view";
import { Button, Field, Input } from "@/components/ig-ui";
import { StatementScreen } from "@/components/statement";
import { apiJson } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { trackError, trackEvent } from "@/lib/telemetry";

/* ═══════════════════════════════════════════════════════════════════
   The credential gate in front of the interruption screen.

   A closed account has no session to spend, so before the screen shows any
   detail about the decision — the reason, the date, the reference, the
   buttons that undo it — the visitor proves they own the account with its
   real email and password. Only once the brain has checked both does the
   real BlockedView render, greeted by the account's own face.

   The check is one POST to /api/auth/blocked-verify (sessionless, rate
   limited, and it only answers for an account that is actually closed, so
   it can't be used to probe live accounts). A wrong answer stays on this
   form; there is nothing to bounce to, because the sign-in that would
   normally be the fallback is exactly what refused this account.
   ═══════════════════════════════════════════════════════════════════ */

type Verified = {
  name: string | null;
  photoUrl: string | null;
  username: string;
  status: string;
};

export function BlockedGate({
  kind,
  eventId,
  reason,
  until,
  verifiedSignature,
}: {
  kind: Kind;
  eventId: string | null;
  reason: string | null;
  until: string | null;
  verifiedSignature: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Verified | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    haptic("light");
    try {
      const res = await apiJson<Verified>("/api/auth/blocked-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setProfile(res);
      trackEvent("auth.block_verified", { detail: kind });
    } catch (err) {
      // A 401 here is "those details don't open this account", not a dead
      // session — the message is shown in place and the form stays up.
      setError(err instanceof Error ? err.message : "Could not verify those details.");
      trackError("blocked.verify", err);
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  if (profile) {
    return (
      <BlockedView
        kind={kind}
        eventId={eventId}
        reason={reason}
        until={until}
        verified={verifiedSignature}
        profile={{ name: profile.name, photo: profile.photoUrl, username: profile.username }}
      />
    );
  }

  return (
    <StatementScreen
      title="Confirm it's you"
      lead="This account is closed. Sign in with its email and password to see why, and what can still be done about it."
      blocks={[
        {
          label: "Your account",
          body: (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <p role="alert" className="text-[14px] font-medium text-danger-text">
                  {error}
                </p>
              )}
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoFocus
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                />
              </Field>
              <Button type="submit" block loading={busy} disabled={!email.trim() || !password}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin-slow" /> Checking…
                  </>
                ) : (
                  "Show my account"
                )}
              </Button>
            </form>
          ),
        },
      ]}
      foot="We ask for your password because a closed account has no session left — it is the only way to prove this account is yours before we show the decision on it."
    />
  );
}
