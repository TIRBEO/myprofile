"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/ig-ui";
import {
  LIVE,
  PageSkeleton,
  ROW,
  SectionTitle,
  SettingsPage,
  StaticRow,
  SUB,
  TITLE,
} from "@/components/settings-shell";
import {
  type ConnectedApp,
  type DisconnectEvent,
  type Provider,
  available,
  connect,
  readConnected,
  readHistory,
} from "@/lib/connected-apps";
import { ago } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Connected apps — the accounts you can sign in to Tirbeo with.

   One rounded, hairline-bordered panel per subject, sitting on the black
   canvas under a plain small label. Inside: a tile, the app's name, one
   muted line holding every detail it owed you (account, last used, what
   it was granted), and the control at the right. That's the whole page —
   no per-app cards, no chip piles, no prose between the sections.
   Revoking still happens on the app's own page, because it is a decision
   with consequences rather than a switch.
   ═══════════════════════════════════════════════════════════════════ */

export default function ConnectedAppsPage() {
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [others, setOthers] = useState<Provider[]>([]);
  const [history, setHistory] = useState<DisconnectEvent[]>([]);
  const toast = useToast();

  useEffect(() => {
    reload();
  }, []);

  function reload() {
    setApps(readConnected());
    setOthers(available());
    setHistory(readHistory());
  }

  if (apps === null) return <PageSkeleton title="Connected apps" />;

  function doConnect(provider: Provider) {
    const r = connect(provider.id);
    if (!r.ok) {
      toast.error("You can't connect any more apps right now.");
      return;
    }
    reload();
    toast.success(`Connected ${provider.name}`);
  }

  return (
    <SettingsPage title="Connected apps">
      {apps.length ? (
        <>
          <SectionTitle>Connected</SectionTitle>
          <div className="grouped list-divide">
            {apps.map((app) => (
              <ConnectedRow key={app.id} app={app} />
            ))}
          </div>
        </>
      ) : null}

      {others.length ? (
        <>
          <SectionTitle>{apps.length ? "You could also connect" : "Available to connect"}</SectionTitle>
          <div className="grouped list-divide">
            {others.map((provider) => (
              <AvailableRow
                key={provider.id}
                provider={provider}
                onConnect={() => doConnect(provider)}
              />
            ))}
          </div>
        </>
      ) : null}

      {history.length ? (
        <>
          <SectionTitle>Disconnected recently</SectionTitle>
          <div className="grouped list-divide">
            {history.map((event) => (
              <StaticRow
                key={event.id}
                title={event.name}
                sub={`Revoked from this device ${ago(event.at)}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </SettingsPage>
  );
}

/** One granted app as a row: the tile it's known by, then one muted line
    holding the account, when it last reached Tirbeo, and what it was
    allowed to see. Opening it is where the disconnect sits. */
function ConnectedRow({ app }: { app: ConnectedApp }) {
  return (
    <Link
      href={`/settings/connected-apps/${app.id}`}
      onClick={() => haptic("light")}
      className={cn(ROW, LIVE)}
    >
      <Monogram name={app.name} />
      <span className="min-w-0 flex-1">
        <span className={TITLE}>{app.name}</span>
        <bdi className={SUB}>
          {app.account} · Last used {ago(app.lastUsedAt)} · {app.scopes.join(", ")}
        </bdi>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-muted" strokeWidth={2} />
    </Link>
  );
}

/** One app that could be granted access: same row, different control —
    Connect acts in place, so the row ends in the word itself. */
function AvailableRow({
  provider,
  onConnect,
}: {
  provider: Provider;
  onConnect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onConnect();
      }}
      className={cn(ROW, LIVE)}
    >
      <Monogram name={provider.name} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[15px] font-medium">{provider.name}</span>
        <span className={SUB}>{provider.tagline}</span>
      </span>
      <span className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-fg">
        Connect
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
