"use client";

import { useState } from "react";
import { cn, Sheet, SheetActions } from "@/components/ig-ui";
import {
  Helper,
  LIVE,
  PageSkeleton,
  ROW,
  SectionTitle,
  SettingsPage,
  SUB,
  TITLE,
} from "@/components/settings-shell";
import {
  type ConnectedApp,
  type Provider,
  available,
  connect,
  disconnect,
  providerFor,
  useConnectedApps,
} from "@/lib/connected-apps";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { endSession, loginUrl } from "@/lib/session";
import { ago, formatDate } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Connected apps — the accounts you can sign in to Tirbeo with.

   One clean row per connected provider: its name, one human line that says
   how long it has been a way in and when it was last used, the short list
   of what it can see, and a single Disconnect at the end of the row. The
   provider account id is not printed here — it is noise on a settings
   screen and the detail page still carries it.

   Everything is read off the account rather than this browser, so what you
   see is what the app actually holds. Connecting is a trip out to the
   provider and back; disconnecting asks once in a sheet, then proves it's
   you through the shared reauth sheet, because removing a way back in is a
   sensitive action.
   ═══════════════════════════════════════════════════════════════════ */

export default function ConnectedAppsPage() {
  const { apps, failed, refresh } = useConnectedApps();
  const [opening, setOpening] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ConnectedApp | null>(null);
  const [busy, setBusy] = useState(false);
  const { guard, reauthDialog } = useReauthGuard();
  const toast = useToast();

  usePageRefresh(refresh);

  async function doConnect(provider: Provider) {
    setOpening(provider.id);
    try {
      window.location.assign(await connect(provider.id));
    } catch (err: any) {
      setOpening(null);
      toast.error(err?.message || `Couldn't start connecting ${provider.name}.`);
    }
  }

  async function doDisconnect() {
    const target = confirming;
    if (!target || busy) return;
    setBusy(true);
    try {
      // The guard runs the revoke, and when the account service refuses it
      // asks how to prove it's you and tries the same call again.
      await guard((proof) => disconnect(target.id, proof));
      haptic("success");
      toast.success(`Disconnected ${target.name}`);
      // Losing the provider that signed you in ends the visit: revoke this
      // session too and hand the browser to the accounts login, which is the
      // only way back in now.
      endSession();
      window.location.replace(loginUrl());
    } catch (err: any) {
      // Backing out of the check leaves the link connected and says nothing.
      if (!wasDeclined(err)) toast.error(err?.message || `Couldn't disconnect ${target.name}.`);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <SettingsPage title="Connected apps">
        <Helper lead tone="danger">
          The account service didn’t answer, so this page can’t say which apps hold access to you.
          Nothing changed —{" "}
          <button type="button" className="font-semibold underline" onClick={refresh}>
            Try again
          </button>
          .
        </Helper>
      </SettingsPage>
    );
  }

  if (apps === null) return <PageSkeleton title="Connected apps" />;

  const others = available(apps);

  return (
    <SettingsPage title="Connected apps">
      {apps.length ? (
        <div className="list-divide">
          {apps.map((app) => (
            <ConnectedRow key={app.id} app={app} onDisconnect={() => setConfirming(app)} />
          ))}
        </div>
      ) : (
        <Helper lead>
          Nothing is connected. Every sign-in here goes through your own password, code or passkey.
        </Helper>
      )}

      {others.length ? (
        <>
          <SectionTitle>{apps.length ? "You could also connect" : "Available to connect"}</SectionTitle>
          <div className="list-divide">
            {others.map((provider) => (
              <AvailableRow
                key={provider.id}
                provider={provider}
                busy={opening === provider.id}
                disabled={!!opening}
                onConnect={() => doConnect(provider)}
              />
            ))}
          </div>
        </>
      ) : null}

      {confirming ? (
        <Sheet
          title={`Disconnect ${confirming.name}?`}
          description={
            providerFor(confirming.id)?.loss ??
            `${confirming.name} will no longer be able to reach Tirbeo. Your Tirbeo account stays.`
          }
          onClose={() => (busy ? undefined : setConfirming(null))}
          footer={
            <SheetActions
              cancelLabel="Keep it"
              onCancel={() => setConfirming(null)}
              confirmLabel={busy ? "Disconnecting…" : "Disconnect"}
              confirmVariant="danger"
              loading={busy}
              onConfirm={doDisconnect}
            />
          }
        />
      ) : null}

      {reauthDialog}
    </SettingsPage>
  );
}

/** One connected provider as a row: its name, one human line saying since
    when and last used, the short list of what it can see, and the single
    Disconnect. The provider account id is deliberately not shown. */
function ConnectedRow({ app, onDisconnect }: { app: ConnectedApp; onDisconnect: () => void }) {
  const since = app.connectedAt
    ? `Signed in with ${app.name} since ${formatDate(app.connectedAt)}`
    : `Signed in with ${app.name}`;
  const used = app.lastUsedAt ? `last used ${ago(app.lastUsedAt)}` : "not used to sign in yet";
  return (
    <div className={cn(ROW, "items-start")}>
      <Monogram name={app.name} />
      <span className="min-w-0 flex-1">
        <span className={TITLE}>{app.name}</span>
        <span className={SUB}>{`${since} · ${used}`}</span>
        <span className={SUB}>{`Can see: ${app.scopes.join(", ").toLowerCase()}`}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          haptic("light");
          onDisconnect();
        }}
        className="shrink-0 rounded-full border border-border px-3.5 py-1.5 text-[13.5px] font-semibold text-danger-text outline-none transition-colors hover:bg-danger/10 active:bg-danger/15"
      >
        Disconnect
      </button>
    </div>
  );
}

/** One app that could be granted access: same row, different control. Connect
    sends the browser to the provider, so the label says so while it happens. */
function AvailableRow({
  provider,
  busy,
  disabled,
  onConnect,
}: {
  provider: Provider;
  busy: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic("light");
        onConnect();
      }}
      className={cn(ROW, LIVE, disabled && "opacity-60")}
    >
      <Monogram name={provider.name} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[15px] font-medium">{provider.name}</span>
        <span className={SUB}>{provider.tagline}</span>
      </span>
      <span
        aria-hidden
        className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-accent px-3.5 text-[13.5px] font-semibold text-accent-fg"
      >
        {busy ? "Opening…" : "Connect"}
      </span>
    </button>
  );
}

/** The app's initial on a raised square. Every app gets the same mark, so
    the list reads as a set of apps rather than a set of icons. */
function Monogram({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-[14px] font-bold text-fg/80"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
