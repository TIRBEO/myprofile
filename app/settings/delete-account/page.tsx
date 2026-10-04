"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Group, Helper, PageSkeleton, PillButton, PillStack, SettingsPage, StaticRow } from "@/components/settings-shell";
import { GRACE_DAYS, countdownLabel } from "@/lib/delete-account";
import { apiCancelDeletion, useAccountState } from "@/lib/account-lifecycle";
import { formatDate } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Delete account

   Four short sentences about what deleting means, the date it becomes
   final, and one red button. The button doesn't delete anything — it walks
   you to the last step, which is the emailed code. Once a deletion is
   scheduled this page becomes the way back: one clean card with the date
   and the cancel.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeleteAccountPage() {
  const { state, loading } = useAccountState();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  /* The schedule is read from the account, so this page and the lock screen
     can never disagree about whether a deletion is running. */
  const finalAt =
    state?.deletionPending && state.deletionFinalAt ? Date.parse(state.deletionFinalAt) : null;

  if (loading) return <PageSkeleton title="Delete account" sections={2} />;

  async function doCancel() {
    setBusy(true);
    try {
      await apiCancelDeletion();
      haptic("success");
      toast.info("Deletion cancelled — your account stays open");
    } catch {
      toast.error("Couldn't cancel the deletion — please try again");
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
                ? "The window has run out. Sign in to start again, or contact support@tirbeo.app if you believe this is wrong."
                : `You can cancel any time before that — ${countdownLabel(finalAt)} left on the window. Nothing has been deleted yet.`
            }
          />
        </Group>
        {!over ? (
          <PillStack>
            <PillButton
              label="Cancel deletion and keep my account"
              onClick={doCancel}
              disabled={busy}
            />
          </PillStack>
        ) : null}
      </SettingsPage>
    );
  }

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
          sub={`Starts the ${GRACE_DAYS}-day window. The last step is a code to your sign-in email.`}
          onClick={() => {
            haptic("heavy");
            router.push("/settings/confirm-deletion");
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
    </SettingsPage>
  );
}
