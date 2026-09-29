"use client";

import { useEffect, useState } from "react";
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
import {
  CODE_COUNT,
  type CodeSet,
  RATE_MAX,
  cooldownLabel,
  cooldownMs,
  generate,
  readSets,
  twoFactorEnabled,
} from "@/lib/backup-codes";
import { ago, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";


/* ═══════════════════════════════════════════════════════════════════
   Backup codes — reached from Two-factor, not the sidebar.

   The page never prints a code. Sets appear in a sheet the moment they
   are created and disappear with it, so this screen is status plus a
   record of when each set was made. Lost them? Generate again — the new
   set replaces the old one.
   ═══════════════════════════════════════════════════════════════════ */

export default function BackupCodesPage() {
  const [sets, setSets] = useState<CodeSet[] | null>(null);
  const [twoFaOn, setTwoFaOn] = useState(true);
  const [wait, setWait] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [codes, setCodes] = useState<CodeSet | null>(null);
  const toast = useToast();

  useEffect(() => {
    setTwoFaOn(twoFactorEnabled());
    setSets(readSets());
  }, []);

  // Re-checked on a tick, so the cooldown lifts without a reload.
  useEffect(() => {
    setWait(cooldownMs());
    const id = window.setInterval(() => setWait(cooldownMs()), 30_000);
    return () => window.clearInterval(id);
  }, [sets]);

  const latest = sets?.[0] ?? null;
  const limited = wait > 0;

  function blocked() {
    toast.error(`Code limit reached — try again in ${cooldownLabel(wait)}`);
  }

  function regenerate() {
    const result = generate();
    setConfirming(false);
    if (!result.ok) {
      blocked();
      return;
    }
    setSets(readSets());
    setCodes(result.fresh);
  }

  if (!twoFaOn) {
    return (
      <SettingsPage title="Backup codes">
        <Helper>
          Two-factor is off. Turn the authenticator app on and a set of codes is created for you.
        </Helper>
      </SettingsPage>
    );
  }

  if (!sets) return <PageSkeleton title="Backup codes" />;

  return (
    <SettingsPage title="Backup codes">
      <Helper className="mt-6">
        {latest
          ? `Newest set generated ${formatStamp(latest.createdAt)}, ${ago(latest.createdAt)}.`
          : "Generate a set so you can still sign in without your app."}
      </Helper>

      <SectionTitle
        desc={
          <>
            Codes are shown once, straight after they&apos;re created. Each one can be used once, and
            generating a new set replaces everything before it. Up to {RATE_MAX} sets an hour.
          </>
        }
      >
        Manage
      </SectionTitle>
      <Group>
        <ActionRow
          title={latest ? "Generate new codes" : "Generate codes"}
          sub={
            limited
              ? `Try again in ${cooldownLabel(wait)}.`
              : latest
                ? "The old set stops working."
                : `${CODE_COUNT} one-time codes.`
          }
          /* Red only when it throws a working set away — issuing the very
             first one takes nothing back. */
          danger={Boolean(latest)}
          disabled={limited}
          blockedHint={blocked}
          onClick={() => setConfirming(true)}
        />
      </Group>

      <SectionTitle>History</SectionTitle>
      {sets.length ? (
        <Group>
          {sets.map((set) => (
            <StaticRow
              key={set.id}
              title={formatStamp(set.createdAt)}
              sub={`${ago(set.createdAt)} · ${set.codes.length} one-time codes`}
            />
          ))}
        </Group>
      ) : (
        <Helper className="mt-0">
          Every set you generate is listed here with its date. The codes themselves aren&apos;t kept
          on screen.
        </Helper>
      )}

      {confirming ? (
        <Sheet
          title={latest ? "Generate new codes?" : "Generate backup codes?"}
          description={
            latest
              ? `Your ${CODE_COUNT} current codes stop working, including any you've saved or printed.`
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
    </SettingsPage>
  );
}

