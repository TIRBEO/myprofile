"use client";

import { useState } from "react";
import { Sheet, SheetActions } from "@/components/ig-ui";
import {
  ActionRow,
  Group,
  Helper,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { BackupCodesSheet } from "@/components/backup-codes-sheet";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { CODE_COUNT, MINTS_PER_HOUR, type RevealedCodes, regenerateCodes, useTwoFactorState } from "@/lib/two-factor";
import { ago, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Backup codes — reached from Two-factor, not the sidebar.

   The page never prints a code. The account service hands out the
   plaintext in the reply that mints a set and keeps only hashes after
   that, so a set is readable exactly once, in the sheet that opens the
   moment it is issued. What survives here is the record of when each set
   was made and how many of its codes are still unspent.

   Whether a code has been used isn't something this browser gets to
   remember: signing in with one marks it spent on the server, and that is
   what this page reads back.
   ═══════════════════════════════════════════════════════════════════ */

export default function BackupCodesPage() {
  const { state, failed, refresh } = useTwoFactorState();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<RevealedCodes | null>(null);
  const toast = useToast();
  const { guard, reauthDialog } = useReauthGuard();

  usePageRefresh(refresh);

  if (failed) {
    return (
      <SettingsPage title="Backup codes">
        <Helper lead tone="danger">
          The account service didn’t answer, so the codes on this account are unknown.{" "}
          <button type="button" className="font-semibold underline" onClick={refresh}>
            Try again
          </button>
          .
        </Helper>
      </SettingsPage>
    );
  }

  if (!state) return <PageSkeleton title="Backup codes" />;

  if (!state.authenticator) {
    return (
      <SettingsPage title="Backup codes">
        <Helper>
          Two-factor is off. Turn the authenticator app on and a set of codes is created for you.
        </Helper>
      </SettingsPage>
    );
  }

  const sets = state.codes.sets;
  const latest = sets[0] ?? null;

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    try {
      // The brain refuses a bare session, so the guard asks once and the retry
      // carries the answer. Cancelled means nothing was generated.
      setCodes(await guard((proof) => regenerateCodes(proof)));
      setConfirming(false);
      refresh();
    } catch (err) {
      // Backing out of the check leaves the old set alone, and the question on
      // screen, so it can be answered again.
      if (wasDeclined(err)) return;
      setConfirming(false);
      toast.error(err instanceof Error ? err.message : "Couldn’t reach the account service");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage title="Backup codes">
      <Helper className="mt-6">
        {latest
          ? `${latest.remaining} of ${latest.total} codes from the set generated ${formatStamp(latest.createdAt)} are still unused — ${ago(latest.createdAt)}.`
          : "Generate a set so you can still sign in without your app."}
      </Helper>

      <SectionTitle
        desc={
          <>
            Codes are shown once, straight after they&apos;re created — the account keeps only an
            unrecoverable copy. Each one can be used once, and generating a new set replaces
            everything before it. No more than {MINTS_PER_HOUR} sets an hour.
          </>
        }
      >
        Manage
      </SectionTitle>
      <Group>
        <ActionRow
          title={latest ? "Generate new codes" : "Generate codes"}
          sub={latest ? "The old set stops working." : `${CODE_COUNT} one-time codes.`}
          /* Red only when it throws a working set away — issuing the very
             first one takes nothing back. */
          danger={Boolean(latest)}
          onClick={() => setConfirming(true)}
        />
      </Group>

      <SectionTitle>History</SectionTitle>
      {sets.length ? (
        <Group>
          {sets.map((set) => (
            <StaticRow
              key={set.createdAt || "undated"}
              title={set.createdAt ? formatStamp(set.createdAt) : "Issued before this log began"}
              sub={
                set.createdAt
                  ? `${ago(set.createdAt)} · ${set.remaining} of ${set.total} unused`
                  : `${set.total} one-time codes, ${set.remaining} unused`
              }
            />
          ))}
        </Group>
      ) : (
        <Helper className="mt-0">
          Every set you generate is listed here with its date and how much of it is left. The codes
          themselves aren&apos;t kept on screen.
        </Helper>
      )}

      {confirming ? (
        <Sheet
          title={latest ? "Generate new codes?" : "Generate backup codes?"}
          description={
            latest
              ? `Your ${latest.remaining} unused codes stop working, including any you've saved or printed.`
              : `${CODE_COUNT} codes you can sign in with if you lose your app.`
          }
          onClose={() => setConfirming(false)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setConfirming(false)}
              confirmLabel="Generate"
              confirmVariant={latest ? "danger" : "primary"}
              onConfirm={regenerate}
              loading={busy}
            />
          }
        />
      ) : null}

      {codes ? (
        <BackupCodesSheet
          set={codes}
          stamp={formatStamp(codes.createdAt)}
          onDone={() => {
            setCodes(null);
            toast.info("You can generate a new set any time");
          }}
        />
      ) : null}

      {reauthDialog}
    </SettingsPage>
  );
}
