"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/otp-input";
import { Button, Sheet, SheetActions } from "@/components/ig-ui";
import { Group, Helper, PageSkeleton, PillButton, PillStack, SettingsPage, SheetGroup, StaticRow } from "@/components/settings-shell";
import { GRACE_DAYS, countdownLabel } from "@/lib/delete-account";
import { apiCancelDeletion, apiRequestDeletionCode, apiVerifyDeletion, useAccountState } from "@/lib/account-lifecycle";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { formatDate } from "@/lib/dates";
import { trackError, trackEvent, withRef } from "@/lib/telemetry";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Delete account

   Four short sentences about what deleting means, the date it becomes
   final, and one red button. The button doesn't delete anything — it opens
   the last step, which is the emailed code, as a sheet on top of this page.

   It used to be a page of its own, and that was wrong twice over. An address
   whose meaning depends on a step you may not have taken can be typed cold,
   and a cold type landed on "Email me the code" — a real deletion code in
   someone's inbox, from a page two clicks' worth of warnings away. And once
   a deletion was scheduled this page became the way back: one clean card
   with the date and the cancel.

   So the warning is here, in the sheet, under the button that asked for it.
   The brain's rate limit and its one-shot code are what gate the deletion;
   a URL never was, and isn't any more.
   ═══════════════════════════════════════════════════════════════════ */

/** The gap the account enforces between two codes, and the wait this sheet
    counts while it holds the one it already sent. */
const CODE_SECONDS = 30;

const BLANK_CODE = ["", "", "", "", "", ""];

export default function DeleteAccountPage() {
  const { state, loading } = useAccountState();
  const [busy, setBusy] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();

  /* The schedule is read from the account, so this page and the lock screen
     can never disagree about whether a deletion is running. */
  const finalAt =
    state?.deletionPending && state.deletionFinalAt ? Date.parse(state.deletionFinalAt) : null;

  if (loading) return <PageSkeleton title="Delete account" sections={2} />;

  async function doCancel() {
    if (busy) return;
    setBusy(true);
    try {
      await apiCancelDeletion();
      trackEvent("settings.account_deletion_cancelled", { detail: "delete_account_page" });
      haptic("success");
      toast.info("Deletion cancelled — your account stays open");
    } catch (err) {
      trackError("delete-account.cancel", err);
      toast.error(
        withRef(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't cancel the deletion — please try again",
          err,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (finalAt !== null) {
    const over = Date.now() >= finalAt;
    return (
      <SettingsPage title="Delete account">
        <Group>
          <StaticRow
            title={over ? "This close has become final" : `Your account closes on ${formatDate(finalAt)}`}
            sub={
              over
                ? "The window has run out. Sign in to start again, or contact support@tirbeo.com if you believe this is wrong."
                : `You can cancel any time before that — ${countdownLabel(finalAt)} left on the window. Nothing has been deleted yet.`
            }
          />
        </Group>
        {!over ? (
          <PillStack>
            <PillButton
              label={busy ? "Cancelling…" : "Cancel deletion and keep my account"}
              onClick={doCancel}
              disabled={busy}
            />
          </PillStack>
        ) : null}
      </SettingsPage>
    );
  }

  /* Before there is a request, the account has no date to give, so this is the
     window the page promised rather than the one the server set. */
  const closeDay = Date.now() + GRACE_DAYS * 86_400_000;

  return (
    <SettingsPage title="Delete account">
      <Helper lead>
        Deleting your account is permanent. Your profile, your details and everything saved to it
        are removed, and every device is signed out. You&apos;ll have {GRACE_DAYS} days to change
        your mind — after {formatDate(closeDay)}, nothing can be restored, not even by support.
      </Helper>

      <Helper className="mt-4">
        Only want a break? Deactivating keeps everything and you can come back any time. Taking a
        copy first is easy too:{" "}
        <Link href="/settings/download-data" className="font-semibold underline">
          download your data
        </Link>
        .
      </Helper>

      <PillStack>
        <PillButton
          tone="danger"
          label="Delete my account"
          sub={`Starts the ${GRACE_DAYS}-day window. The last steps are a code to your sign-in email and a confirmation it's you.`}
          onClick={() => {
            haptic("heavy");
            setDeletionOpen(true);
          }}
        />
        <PillButton
          tone="outline"
          label="Deactivate instead"
          sub="Nothing is removed — the profile just hides until you sign in again."
          onClick={() => {
            haptic("light");
            router.push("/settings/deactivate");
          }}
        />
      </PillStack>

      {/* Rendered conditionally so closing it costs nothing: the code and the
          countdown are gone with the sheet, and starting again starts at the
          warning. */}
      {deletionOpen ? (
        <DeletionSheet closeDay={closeDay} onClose={() => setDeletionOpen(false)} />
      ) : null}
    </SettingsPage>
  );
}

/* ── The last step ────────────────────────────────────────────────
   One sheet. The warning is everything the button's one line couldn't hold,
   and the code joins it underneath as soon as one has actually been asked
   for — no second screen, and nothing is deleted by reading. Going back is
   just closing the sheet; the code that was already sent stays sent — asking
   for a second one inside the wait is the account's problem, not this
   sheet's.
   ───────────────────────────────────────────────────────────────── */

function DeletionSheet({ closeDay, onClose }: { closeDay: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { guard, reauthDialog } = useReauthGuard();
  const [sent, setSent] = useState(false);
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
  /** Kept so the timers a sheet unmounts mid-countdown can't fire into it.
      Re-armed on every mount: Strict Mode runs mount → cleanup → mount on the
      same instance, and a cleanup-only effect would leave this false forever
      — every awaited reply then looked like a dead sheet and was dropped,
      which is how a 200 "code sent" left the button spinning in "Sending…". */
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  useEffect(() => {
    if (!againIn) return;
    const id = window.setTimeout(() => setAgainIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [againIn]);

  const codeFull = code.every((d) => d);

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
      setSent(true);
      setAgainIn(CODE_SECONDS);
      trackEvent("settings.deletion_code_requested");
      toast.info(reply.message);
      return true;
    } catch (err) {
      if (!live.current) return false;
      haptic("error");
      trackError("delete-account.request-code", err);
      setError(
        withRef(
          err instanceof Error && err.message
            ? err.message
            : "The account couldn’t send the code right now. Nothing was deleted.",
          err,
        ),
      );
      return false;
    } finally {
      if (live.current) setBusy(false);
    }
  }

  /** Hand the code to the account. Only a code it recognises schedules
      anything — and the code alone isn't the whole answer: the account also
      wants a fresh proof it's really the person (password, authenticator or
      emailed code), which `guard` collects in its own dialog when the first
      attempt comes back refused. Anything else leaves the account exactly as
      it is, with the reason on the sheet. */
  async function verify() {
    if (!codeFull || busy) return;
    setBusy(true);
    setError(null);
    try {
      await guard((proof) => apiVerifyDeletion(code.join(""), null, proof));
      if (!live.current) return;
      trackEvent("settings.account_deletion_requested");
      haptic("heavy");
      toast.info("Deletion scheduled");
      /* The account closes to the countdown the moment this is asked for, and
         the gate puts that screen up over whatever address this was on. */
      router.replace("/settings");
    } catch (err) {
      if (!live.current) return;
      // Walking away from the proof changes nothing — the sheet stays open
      // with the code typed, ready to try again.
      if (wasDeclined(err)) {
        setBusy(false);
        return;
      }
      haptic("error");
      trackError("delete-account.verify", err);
      setCode(BLANK_CODE);
      setError(
        withRef(
          err instanceof Error && err.message ? err.message : "That code couldn’t be checked",
          err,
        ),
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <Sheet
      title="Before you go"
      description="Nothing is deleted by opening this, and nothing is deleted by the button at the bottom of it. Read these three lines first."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Not now"
          onCancel={onClose}
          onConfirm={() => {
            if (sent) void verify();
            else {
              haptic("heavy");
              void request();
            }
          }}
          confirmLabel={
            busy
              ? sent
                ? "Checking the code…"
                : "Sending the code…"
              : sent
                ? "Yes, delete my account"
                : "Email me the code"
          }
          confirmVariant="danger"
          disabled={sent && !codeFull}
          loading={busy}
        />
      }
    >
      <SheetGroup>
        <StaticRow
          title="What is removed"
          sub="Your profile, your details and everything saved to the account. Every device is signed out, including this one."
        />
        <StaticRow
          title="When it becomes final"
          sub={`About ${formatDate(closeDay)} — ${GRACE_DAYS} days from the moment the code is spent. Cancel inside that window and the account comes back exactly as it was.`}
        />
        <StaticRow
          title="After that"
          sub="Nothing can be restored — not by you, not by support. If you want a copy of anything, close this and download your data first."
        />
      </SheetGroup>

      {/* The code joins the same surface once the account has actually mailed
          one, so the whole job happens on one sheet instead of two screens. */}
      {sent ? (
        <div className="-mx-4 mt-2 border-t border-divider px-5 pb-2 pt-5 sm:-mx-5">
          <Helper>
            {sentTo ? (
              <>
                We sent a code to <span className="font-semibold text-fg">{sentTo}</span>. It works
                once.
              </>
            ) : (
              "We sent a 6-digit code to the address you sign in with. It works once."
            )}
          </Helper>
          <div className="mt-4 [&>div]:w-full [&_input]:min-w-0 [&_input]:max-w-12 [&_input]:flex-1">
            <OtpInput value={code} onChange={setCode} onEnter={verify} />
          </div>
          <Button
            variant="link"
            className="mt-3"
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
      ) : null}

      {error ? <Helper tone="danger">{error}</Helper> : null}

      {/* The proof the account asked for, on its own sheet above this one —
          only the doors this account can actually open. */}
      {reauthDialog}
    </Sheet>
  );
}
