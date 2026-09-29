"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ig-ui";
import { Group, Helper, LinkRow, PageSkeleton, PillButton, PillStack, SectionTitle, SettingsPage, SheetGroup, StaticRow } from "@/components/settings-shell";
import {
  GRACE_DAYS,
  type DeletionPlan,
  cancel,
  countdownLabel,
  finalAt,
  readPlan,
  remaining,
} from "@/lib/delete-account";
import { formatDate } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { Download } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Delete account

   The door, not the switch. What you can do instead, then what actually
   happens as one flat list, then one red button — and that button asks
   once in a sheet before it walks you to the last gate, because agreeing
   to lose an account shouldn't be a popup you can tap past. Once a
   deletion is scheduled this page becomes the way back: the date, a
   countdown that runs on its own, and the cancel.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeleteAccountPage() {
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<DeletionPlan | null>(null);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setPlan(readPlan());
    setReady(true);
  }, []);

  if (!ready) return <PageSkeleton title="Delete account" sections={2} />;

  const closeDay = plan ? plan.finalAt : finalAt();
  const pending = plan ? !remaining(plan.finalAt).done : false;

  function doCancel() {
    setPlan(cancel());
    toast.info("Deletion cancelled");
  }

  function goToLastStep() {
    setConfirm(false);
    router.push("/settings/confirm-deletion");
  }

  return (
    <SettingsPage title="Delete account">
      {plan ? (
        <>
          <Helper lead tone="danger">
            {pending
              ? `Your account closes on ${formatDate(plan.finalAt)}, with about ${countdownLabel(
                  plan.finalAt,
                )} left on the window. Cancelling below stops it.`
              : "This account was set to close, and that date has passed. Sign in to start again, or talk to support if you believe this is wrong."}
          </Helper>

          <SectionTitle>Scheduled</SectionTitle>
          <Group>
            <StaticRow
              title="Becomes final"
              sub="When your account is permanently closed."
              right={formatDate(plan.finalAt)}
            />
            <CountdownRow finalAtValue={plan.finalAt} />
          </Group>
          <PillStack>
            <PillButton
              label="Cancel deletion and keep my account"
              onClick={doCancel}
            />
          </PillStack>
        </>
      ) : (
        <>
          <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
            Deleting is the one thing you can&apos;t take back — it removes your account, your
            profile and everything saved to it. There are two softer doors first.
          </p>

          <SectionTitle>If you&apos;d rather not delete</SectionTitle>
          <Group>
            <LinkRow
              href="/settings/deactivate"
              danger
              title="Deactivate for a while"
              sub="Hide your profile and keep everything until you return."
            />
            <LinkRow
              href="/settings/security"
              title="Change the email you sign in with"
              sub="Switch to another address and keep the account."
            />
            <LinkRow
              href="/settings/download-data"
              title="Download your data"
              sub="Keep a copy of your details and settings first."
            />
          </Group>

          <SectionTitle>What happens when you delete</SectionTitle>
          <Group>
            <StaticRow
              title="You stop being able to sign in"
              sub="Your sessions end and the app locks you out."
              right="Right away"
            />
            <StaticRow
              title="You can change your mind"
              sub={`Cancel any time within the ${GRACE_DAYS}-day window.`}
              right={`Until ${formatDate(closeDay)}`}
            />
            <StaticRow
              title="Your username is freed"
              sub="Anyone can claim the handle after this."
              right={formatDate(closeDay)}
            />
            <StaticRow
              title="Everything is deleted for good"
              sub="Past this date nothing can be restored."
              right={formatDate(closeDay)}
            />
          </Group>
          <Helper>
            A copy of your data that you downloaded to another device stays on that device after
            deletion.
          </Helper>

          <SectionTitle desc="Two steps at the last gate: agree to what you've just read, then enter the code we send to your sign-in email.">
            Delete your account
          </SectionTitle>
          <PillStack>
            <PillButton
              tone="danger"
              onClick={() => {
                haptic("heavy");
                setConfirm(true);
              }}
              label="Delete my account"
              sub={`Your account, your profile and everything saved to it. Starts a ${GRACE_DAYS}-day window you can cancel within.`}
            />
          </PillStack>

          {/* The prompt asks the question a deletion really has two answers
              to. Deactivating is offered on the same surface as deleting, in
              the same breath, because most people who reach this button want
              the first one and can't remember the word for it. */}
          {confirm ? (
            <Sheet
              title="Delete your account?"
              description={`${GRACE_DAYS} days from now your profile, your details and everything saved to them are removed for good. If you only want a break, deactivating hides the account and keeps all of it.`}
              onClose={() => setConfirm(false)}
              footer={
                <div className="flex flex-col gap-2">
                  <PillButton
                    label="Deactivate instead"
                    sub="Hide the account, keep everything, turn it back on any time."
                    href="/settings/deactivate"
                    tone="primary"
                  />
                  <PillButton
                    label="Delete my account"
                    sub={`Starts the ${GRACE_DAYS}-day window, then one last confirmation.`}
                    tone="danger"
                    onClick={goToLastStep}
                  />
                  <PillButton label="Cancel" tone="outline" onClick={() => setConfirm(false)} />
                </div>
              }
            >
              <SheetGroup>
                <StaticRow
                  title="You stop being able to sign in"
                  sub="Your sessions end and the app locks you out."
                  right="Right away"
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

/* ── Live countdown, ticking on its own so the page doesn't ──────── */

function CountdownRow({ finalAtValue }: { finalAtValue: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const r = remaining(finalAtValue);
  const label = r.done
    ? "now"
    : r.days > 0
      ? `${r.days}d ${r.hours}h ${r.minutes}m ${r.seconds}s`
      : r.hours > 0
        ? `${r.hours}h ${r.minutes}m ${r.seconds}s`
        : `${r.minutes}m ${r.seconds}s`;
  return (
    <StaticRow
      title="Time left to cancel"
      sub="This keeps counting down while the page is open."
      right={label}
    />
  );
}
