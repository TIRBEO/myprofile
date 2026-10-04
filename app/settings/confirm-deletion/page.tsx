"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/otp-input";
import { Button } from "@/components/ig-ui";
import { Helper, PageSkeleton, PillButton, PillStack, SettingsPage } from "@/components/settings-shell";
import { GRACE_DAYS, finalAt } from "@/lib/delete-account";
import { apiRequestDeletionCode, apiVerifyDeletion } from "@/lib/account-lifecycle";
import { LOCK_HREF } from "@/lib/account-state";
import { formatDate } from "@/lib/dates";
import { useProfile } from "@/lib/profile";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Confirm permanent account deletion

   The last gate, kept to one thing: the code. Two short sentences say what
   happens, the code proves it's really you, and one button schedules the
   close. There is no tick box before this and no sheet after it — the
   delete page already said everything, and this page only asks the one
   question a deletion still needs answered.

   The code is the account's, not this browser's: asking for it sends real
   mail, entering it wrong leaves the account open, and only a code the
   brain spends schedules anything. The schedule comes back from the
   account, and the page you land on runs the clock from that.
   ═══════════════════════════════════════════════════════════════════ */

/** The gap the account enforces between two codes, and the wait this page
    counts while it holds the one it already sent. */
const CODE_SECONDS = 30;

const BLANK_CODE = ["", "", "", "", "", ""];

export default function ConfirmDeletionPage() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(BLANK_CODE);
  const [againIn, setAgainIn] = useState(0);
  /** The masked address the account said it mailed, once it has mailed one.
      Nothing here names an inbox before that. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** A code request or a verify in flight — the buttons that start one are
      disabled until it answers, so nobody presses "delete" twice. */
  const [busy, setBusy] = useState(false);
  /** The account's own words for why nothing happened: no address to mail,
      a code asked for too soon, a code that isn't right. */
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const profile = useProfile();
  /** Kept so the timers a page unmounts mid-countdown can't fire into it. */
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    if (!againIn) return;
    const id = window.setTimeout(() => setAgainIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [againIn]);

  const codeFull = code.every((d) => d);

  if (!profile) return <PageSkeleton title="Confirm deletion" sections={1} />;

  /** Ask the account for a code. This is the only thing that puts mail on its
      way, so it answers with the address that got it. */
  async function request(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setCode(BLANK_CODE);
    try {
      const reply = await apiRequestDeletionCode();
      if (!live.current) return false;
      setSentTo(reply.email || null);
      setAgainIn(CODE_SECONDS);
      toast.info(reply.message);
      return true;
    } catch (err) {
      if (!live.current) return false;
      haptic("error");
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The account couldn’t send the code right now. Nothing was deleted.",
      );
      return false;
    } finally {
      if (live.current) setBusy(false);
    }
  }

  /** Hand the code to the account. Only a code it recognises schedules
      anything; anything else leaves the account exactly as it is, with the
      reason on screen. */
  async function verify() {
    if (!codeFull || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiVerifyDeletion(code.join(""), null);
      if (!live.current) return;
      haptic("heavy");
      toast.info("Deletion scheduled");
      /* The account closes to that one screen the moment this is asked for, so
         that's where this goes — not back to the page it was started from. */
      router.replace(LOCK_HREF.deletion);
    } catch (err) {
      if (!live.current) return;
      haptic("error");
      setCode(BLANK_CODE);
      setError(
        err instanceof Error && err.message ? err.message : "That code couldn’t be checked",
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <SettingsPage title="Confirm deletion">
      <Helper lead>
        This schedules the deletion — it doesn&apos;t run it. Your account closes for good on{" "}
        {formatDate(finalAt())}, and you can cancel any time before that. Enter the 6-digit code we
        email to your sign-in address to prove it&apos;s really you.
      </Helper>

      {sentTo === null ? (
        <PillStack>
          <PillButton
            tone="primary"
            label={busy ? "Sending the code…" : "Email me the code"}
            onClick={() => void request()}
            disabled={busy}
          />
          <PillButton
            tone="outline"
            label="Keep my account"
            onClick={() => router.push("/settings/delete-account")}
          />
        </PillStack>
      ) : (
        <>
          <Helper className="mt-6" lead>
            We sent a code to <span className="font-semibold text-fg">{sentTo}</span>. It works once
            — nothing happens until you enter it below.
          </Helper>

          <div className="mt-6 flex flex-col items-center">
            {/* Six fixed boxes are wider than a 320px column, so they share the
                room evenly and stop at their full size once there is space. */}
            <div className="w-full [&>div]:w-full [&_input]:min-w-0 [&_input]:max-w-12 [&_input]:flex-1">
              <OtpInput value={code} onChange={setCode} />
            </div>
            <Button
              variant="link"
              className="mt-4"
              onClick={() => void request()}
              disabled={againIn > 0 || busy}
            >
              {busy
                ? "Sending…"
                : againIn > 0
                  ? `Resend code in ${againIn}s`
                  : "Didn't get it? Resend code"}
            </Button>
          </div>

          {error ? <Helper tone="danger">{error}</Helper> : null}

          <PillStack>
            <PillButton
              tone="danger"
              disabled={!codeFull || busy}
              onClick={verify}
              label={busy ? "Checking the code…" : "Yes, delete my account"}
              sub={`The account is then on a ${GRACE_DAYS}-day clock you can cancel from the delete page.`}
            />
            <PillButton
              tone="outline"
              onClick={() => {
                setError(null);
                setSentTo(null);
              }}
              label="Keep my account"
            />
          </PillStack>
        </>
      )}
    </SettingsPage>
  );
}
