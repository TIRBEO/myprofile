"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/otp-input";
import { Sheet, SheetActions, cn } from "@/components/ig-ui";
import {
  Group,
  Helper,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
  SheetGroup,
  StaticRow,
} from "@/components/settings-shell";
import { GRACE_DAYS, finalAt, schedule } from "@/lib/delete-account";
import { LOCK_HREF } from "@/lib/account-state";
import { formatDate } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { Check } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Confirm permanent account deletion

   The last screen, and deliberately not a popup — a dialog you can tap
   past by accident is the wrong shape for something that can't be
   undone. Two gates stand between here and the schedule: reading what
   goes, then the code sent to the sign-in email. Only the final red
   button acts, and it asks once more in a sheet first. Neither the
   agreement nor the code is stored; the resulting schedule is, and the
   page you land back on runs the countdown.
   ═══════════════════════════════════════════════════════════════════ */

/** Where the delete code goes: the full address on file, unmasked. */
const SIGN_IN_EMAIL = "a.shrestha97@gmail.com";
const CODE_SECONDS = 30;

const AGREES = [
  {
    title: "Your profile and everything on it goes",
    sub: "Your profile, your saved choices, every device session and the account itself.",
  },
  {
    title: "You get the time before it happens",
    sub: `Nothing is deleted for the first ${GRACE_DAYS} days. Signing in cancels it.`,
  },
];

export default function ConfirmDeletionPage() {
  const router = useRouter();
  const [step, setStep] = useState<"agree" | "code">("agree");
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [againIn, setAgainIn] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!againIn) return;
    const id = window.setTimeout(() => setAgainIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [againIn]);

  const codeFull = code.every((d) => d);
  const closeDay = finalAt();

  function next() {
    if (!agreed) {
      haptic("error");
      return;
    }
    haptic("medium");
    setAgainIn(CODE_SECONDS);
    setStep("code");
    window.scrollTo({ top: 0 });
  }

  function send() {
    setCode(["", "", "", "", "", ""]);
    setAgainIn(CODE_SECONDS);
    toast.info(`A fresh code is on its way to ${SIGN_IN_EMAIL}`);
  }

  function verify() {
    if (!codeFull) {
      haptic("error");
      return;
    }
    setConfirm(false);
    haptic("heavy");
    schedule();
    toast.error("Deletion scheduled");
    /* The account closes to that one screen the moment this is asked for, so
       that's where this goes — not back to the page it was started from. */
    router.replace(LOCK_HREF.deletion);
  }

  return (
    <SettingsPage title="Confirm permanent account deletion">
      {step === "agree" ? (
        <>
          <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
            This can&apos;t be undone — deleting removes your account, your profile and everything
            saved to it. Read each line below, then agree to continue.
          </p>

          <SectionTitle>What you&apos;re agreeing to</SectionTitle>
          <Group>
            {AGREES.map((line) => (
              <StaticRow key={line.title} title={line.title} sub={line.sub} />
            ))}
            <StaticRow
              title="Final date"
              sub="When the account stops existing rather than just hiding."
              right={formatDate(closeDay)}
            />
          </Group>

          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            onClick={() => {
              haptic("selection");
              setAgreed((v) => !v);
            }}
            className={cn(
 "mt-6 flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left outline-none transition-colors sm:px-5",
              agreed ? "border-danger bg-danger/8" : "border-border bg-surface",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[22px] shrink-0 items-center justify-center rounded-md border transition-colors",
                agreed ? "border-danger bg-danger text-white" : "border-border",
              )}
            >
              {agreed ? <Check className="size-[14px]" strokeWidth={3} /> : null}
            </span>
            <span className="text-[14.5px] font-semibold">Yes, I agree. Delete my account.</span>
          </button>
          {!agreed ? (
            <Helper>You have to tick that line before the next step opens.</Helper>
          ) : null}

          <PillStack>
            <PillButton
              tone="primary"
              disabled={!agreed}
              onClick={next}
              label="Continue to the code"
            />
            <PillButton
              tone="outline"
              onClick={() => router.push("/settings/delete-account")}
              label="Cancel and keep my account"
            />
          </PillStack>
        </>
      ) : (
        <>
          <SectionTitle
            desc={`We sent a 6-digit code to ${SIGN_IN_EMAIL}. Entering it proves this is really your account.`}
          >
            Enter the code
          </SectionTitle>
          <div className="flex flex-col items-center">
            {/* Six fixed boxes are wider than a 320px column, so they share the
                room evenly and stop at their full size once there is space. */}
            <div className="w-full [&>div]:w-full [&_input]:min-w-0 [&_input]:max-w-12 [&_input]:flex-1">
              <OtpInput value={code} onChange={setCode} />
            </div>
            <button
              type="button"
              onClick={send}
              disabled={againIn > 0}
              className="mt-6 text-[13px] font-medium text-accent-text transition-opacity hover:opacity-80 disabled:text-muted"
            >
              {againIn > 0 ? `Resend code in ${againIn}s` : "Didn't get it? Resend code"}
            </button>
          </div>

          <PillStack>
            <PillButton
              tone="danger"
              disabled={!codeFull}
              onClick={() => {
                haptic("heavy");
                setConfirm(true);
              }}
              label="Delete my account"
              sub="Your account, your profile and everything saved to it."
            />
            <PillButton
              tone="outline"
              onClick={() => setStep("agree")}
              label="Back"
            />
          </PillStack>
          <Helper>
            Nothing is deleted yet. Scheduling puts the account on a {GRACE_DAYS}-day clock you can
            stop from the delete page.
          </Helper>

          {confirm ? (
            <Sheet
              title="Delete your account for good?"
              description={`This is the last step. The account stops existing on ${formatDate(closeDay)}.`}
              onClose={() => setConfirm(false)}
              footer={
                <SheetActions
                  cancelLabel="Not now"
                  onCancel={() => setConfirm(false)}
                  confirmLabel="Delete my account"
                  confirmVariant="danger"
                  onConfirm={verify}
                />
              }
            >
              <SheetGroup>
                <StaticRow
                  title="You stop being able to sign in"
                  sub="Your sessions end and the app locks you out."
                  right="Right away"
                />
                <StaticRow
                  title="Your username is freed"
                  sub="Anyone can claim the handle after this."
                  right={formatDate(closeDay)}
                />
                <StaticRow
                  title="Everything is deleted for good"
                  sub={`Past ${formatDate(closeDay)} nothing can be restored.`}
                />
              </SheetGroup>
            </Sheet>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}
