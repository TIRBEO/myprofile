"use client";

import { useEffect, useState } from "react";

import { cn, Sheet, SheetActions } from "@/components/ig-ui";
import { ActionRow, Group, Helper, PageSkeleton, PillButton, PillStack, SectionTitle, SettingsPage, StaticRow, TILE } from "@/components/settings-shell";
import { type ConnectedApp, disconnect, findConnected, providerFor } from "@/lib/connected-apps";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { endSession, loginUrl } from "@/lib/session";
import { ago, formatDate, formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   One connected app, in full

   Tapping a tile opens a page rather than a sheet: there is a grant list
   to read, and that deserves the whole screen. The account and the dates
   are fields under it, and they are the account's own — the id the
   provider issued and the sign-ins the ledger actually holds, so a link
   that has never been used says that instead of a date it made up.
   Disconnecting is the only decision here, and it asks once in a sheet
   before it does anything.
   ═══════════════════════════════════════════════════════════════════ */

export default function ConnectedAppDetailPage({ id }: { id: string }) {
  const toast = useToast();
  const [app, setApp] = useState<ConnectedApp | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { guard, reauthDialog } = useReauthGuard();

  useEffect(() => {
    let live = true;
    setApp(undefined);
    setFailed(false);
    findConnected(id)
      .then((next) => live && setApp(next))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id, nonce]);

  if (failed) {
    return (
      <SettingsPage title="Connected app">
        <Helper lead tone="danger">
          The account service didn’t answer, so nothing here is known to be true. Nothing was
          changed —{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setNonce((n) => n + 1)}
          >
            Try again
          </button>
          .
        </Helper>
      </SettingsPage>
    );
  }

  if (app === undefined) return <PageSkeleton title="Connected app" />;

  if (!app) {
    return (
      <SettingsPage title="Connected app">
        <Helper lead>
          That app isn&apos;t connected. It has been disconnected, or it was never allowed here, so
          there&apos;s nothing left to show.
        </Helper>
        <PillStack>
          <PillButton label="Back to connected apps" href="/settings/connected-apps" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const target = app;
  const catalog = providerFor(app.id);
  const loss =
    catalog?.loss ?? `${app.name} will no longer be able to reach Tirbeo. Your Tirbeo account stays.`;

  async function eject() {
    setBusy(true);
    try {
      // Revoking a way back in is a sensitive action, so the call goes through
      // the guard: refused, it asks how to prove it's you and tries again.
      await guard((proof) => disconnect(target.id, proof));
      haptic("success");
      toast.success(`Disconnected ${target.name}`);
      // Losing the provider that signed you in ends the visit: revoke this
      // session too and hand the browser to the accounts login, which is the
      // only way back in now.
      endSession();
      window.location.replace(loginUrl());
    } catch (err: any) {
      setBusy(false);
      // Backing out of the check leaves the link connected, and the question on
      // screen, so it can be answered again.
      if (wasDeclined(err)) return;
      setConfirming(false);
      toast.error(err?.message || `Couldn't disconnect ${target.name}.`);
    }
  }

  return (
    <SettingsPage title={app.name}>
      {/* ── The app, and the one line that says what it can do here ── */}
      <section className="mt-6 flex items-center gap-3.5">
        <span aria-hidden className={cn(TILE, "text-[24px] font-bold")}>
          {app.name.charAt(0).toUpperCase()}
        </span>
        <p className="min-w-0 text-[14.5px] leading-snug text-muted">
          It can see {app.access}.
        </p>
      </section>

      <SectionTitle
        desc={
          <>
            These are the only lines Tirbeo shares with {app.name}. Nothing else about you leaves
            this app.
          </>
        }
      >
        What it was granted
      </SectionTitle>
      <Group>
        {app.scopes.map((scope) => (
          <StaticRow key={scope} title={scope} />
        ))}
      </Group>

      {/* The dates were one sentence under the grants; as fields they answer
          the two questions this page is really checked for. Both come off the
          sign-in ledger, so a link nobody has used yet says so. */}
      <Group>
        {app.account ? <StaticRow title="Signed in as" sub={app.account} /> : null}
        {app.lastUsedAt ? (
          <>
            <StaticRow
              title="First signed in with it"
              sub={`${formatDate(app.connectedAt ?? app.lastUsedAt)} · ${ago(app.connectedAt ?? app.lastUsedAt)}`}
            />
            <StaticRow title="Last used" sub={`${formatStamp(app.lastUsedAt)} · ${ago(app.lastUsedAt)}`} />
          </>
        ) : (
          <StaticRow title="Used to sign in" sub="Not once since it was linked" />
        )}
      </Group>

      <SectionTitle desc="Tirbeo forgets the grant straight away. Reconnecting later starts it over from the beginning.">
        Revoke access
      </SectionTitle>
      <Group>
        <ActionRow
          danger
          title={`Disconnect ${app.name}`}
          sub={`Your Tirbeo account stays — only ${app.name} loses access.`}
          opens={false}
          onClick={() => setConfirming(true)}
        />
      </Group>

      {confirming ? (
        <Sheet
          title={`Disconnect ${app.name}?`}
          description={loss}
          onClose={() => setConfirming(false)}
          footer={
            <SheetActions
              cancelLabel="Keep it"
              onCancel={() => setConfirming(false)}
              confirmLabel={busy ? "Disconnecting…" : "Yes, disconnect"}
              confirmVariant="danger"
              loading={busy}
              onConfirm={eject}
            />
          }
        />
      ) : null}

      {reauthDialog}
    </SettingsPage>
  );
}
