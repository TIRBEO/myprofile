"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { cn, Sheet, SheetActions } from "@/components/ig-ui";
import { ActionRow, Group, Helper, PageSkeleton, PillButton, PillStack, SectionTitle, SettingsPage, StaticRow, TILE } from "@/components/settings-shell";
import { type ConnectedApp, disconnect, findConnected, providerFor } from "@/lib/connected-apps";
import { ago, formatDate, formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   One connected app, in full

   Tapping a tile opens a page rather than a sheet: there is a grant list
   to read, and that deserves the whole screen. The account and the dates
   are fields under it. Disconnecting is the only decision here, and it
   asks once in a sheet before it does anything.
   ═══════════════════════════════════════════════════════════════════ */

export default function ConnectedAppDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [app, setApp] = useState<ConnectedApp | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setApp(findConnected(params.id));
  }, [params.id]);

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

  function eject() {
    setConfirming(false);
    disconnect(target.id);
    haptic("success");
    toast.error(`Disconnected ${target.name}`);
    router.push("/settings/connected-apps");
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
          the two questions this page is really checked for. */}
      <Group>
        <StaticRow title="Signed in as" sub={app.account} />
        <StaticRow title="Connected" sub={`${formatDate(app.connectedAt)} · ${ago(app.connectedAt)}`} />
        <StaticRow title="Last used" sub={`${formatStamp(app.lastUsedAt)} · ${ago(app.lastUsedAt)}`} />
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
              confirmLabel="Yes, disconnect"
              confirmVariant="danger"
              onConfirm={eject}
            />
          }
        />
      ) : null}
    </SettingsPage>
  );
}
