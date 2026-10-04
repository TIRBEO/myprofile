"use client";

/* ═══════════════════════════════════════════════════════════════════
   Connected apps

   The links themselves live on the account: the brain holds which provider
   id is attached to the user row, and the login ledger says when the account
   actually signed in through it. Nothing here is kept in this browser,
   because a record of who can reach your account that only exists on one
   device is a record that can't be trusted from another one.

   What stays local is copy: PROVIDERS is the catalog of what each app is
   offered for and what it would be granted. The account, the dates and the
   on/off state all come from the brain. Connecting is not a flip either —
   POST hands back the provider's own authorisation URL, and the link only
   appears once that round trip has finished.

   Dates are honest: a link that has never been used to sign in reports no
   dates at all rather than a plausible-looking one.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { apiJson, apiSend } from "@/lib/api";
import { withProof, type ReauthProof } from "@/lib/reauth";

export type Provider = {
  id: string;
  name: string;
  /** Short phrase for what the app can see, used in the status card. */
  access: string;
  /** One line under the app's name in the "could connect" list. */
  tagline: string;
  /** What stops working if you disconnect — the confirm sheet's line. */
  loss: string;
  /** The permissions granted, in words a user reads. */
  scopes: string[];
};

export const PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google",
    access: "your name and email",
    tagline: "Sign in with Google and keep your profile in step.",
    loss: "Signing in with Google stops, and Tirbeo can no longer read your profile from it.",
    scopes: ["See your name and photo", "See the email you sign in with"],
  },
  {
    id: "github",
    name: "GitHub",
    access: "your public profile",
    tagline: "Sign in with GitHub and show your pinned repositories.",
    loss: "Signing in with GitHub stops and your pinned repositories come off your profile.",
    scopes: ["See your username and avatar", "Read your public repositories"],
  },
  {
    id: "discord",
    name: "Discord",
    access: "your username and avatar",
    tagline: "Sign in with Discord and link your account.",
    loss: "Signing in with Discord stops and your linked account is removed.",
    scopes: ["See your username and avatar", "See which servers you're in"],
  },
];

export type ConnectedApp = {
  id: string;
  name: string;
  /** The id the provider issued, exactly as the account holds it. Omitted
      from the list page; the detail page still shows it. */
  account: string | null;
  access: string;
  scopes: string[];
  /** When the link was made — the callback's date, or first sign-in if older. */
  connectedAt: number | null;
  /** Most recent sign-in through it, or null. */
  lastUsedAt: number | null;
};

type ConnectionRow = {
  id: string;
  provider: string;
  connected: boolean;
  accountId: string | null;
  /** When the provider was linked (the OAuth callback's connected event). */
  linkedAt: string | null;
  /** First sign-in actually made through it, if any. */
  firstNameUsedAt: string | null;
  lastUsedAt: string | null;
};

function provider(id: string | undefined): Provider | undefined {
  return id ? PROVIDERS.find((p) => p.id === id) : undefined;
}

/** The catalog entry behind a connected app, for pages that show its loss line. */
export function providerFor(id: string | undefined): Provider | undefined {
  return provider(id);
}

function at(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function toApp(row: ConnectionRow, p: Provider): ConnectedApp {
  return {
    id: p.id,
    name: p.name,
    account: row.accountId,
    access: p.access,
    scopes: p.scopes,
    // Prefer the link date the callback filed; a link from before that
    // machinery existed still shows its first real sign-in.
    connectedAt: at(row.linkedAt) ?? at(row.firstNameUsedAt),
    lastUsedAt: at(row.lastUsedAt),
  };
}

/** Every link the account holds, newest use first. An app that has left the
    catalog is dropped rather than rendered as half a row. */
export async function readConnected(): Promise<ConnectedApp[]> {
  const rows = await apiJson<ConnectionRow[]>("/api/integrations");
  // Newest use first; a link that has never signed anyone in keeps its place
  // at the end rather than jumping to the top with a zero.
  const apps = rows
    .filter((row) => row.connected)
    .map((row) => {
      const p = provider(row.provider);
      return p ? toApp(row, p) : null;
    })
    .filter((a): a is ConnectedApp => a !== null);
  return apps.sort(
    (a, b) =>
      (b.lastUsedAt ?? -1) - (a.lastUsedAt ?? -1) ||
      (b.connectedAt ?? -1) - (a.connectedAt ?? -1),
  );
}

/** One connected app by id, for the page that shows nothing but it. */
export async function findConnected(id: string | undefined): Promise<ConnectedApp | null> {
  if (!id) return null;
  const apps = await readConnected();
  return apps.find((app) => app.id === id) ?? null;
}

/** Providers not currently connected — what the "could connect" list offers. */
export function available(apps: ConnectedApp[]): Provider[] {
  const connected = new Set(apps.map((app) => app.id));
  return PROVIDERS.filter((p) => !connected.has(p.id));
}

/**
 * Revokes a link. The brain refuses when it would leave the account with no
 * way to sign in, and that refusal is what reaches the page as an error.
 * Removing a way back in is a sensitive action, so the call carries the proof
 * the shared sheet collected.
 */
export async function disconnect(id: string, proof: ReauthProof = {}): Promise<void> {
  await apiSend("/api/integrations", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withProof({ provider: id }, proof)),
  });
}

/**
 * Starts the authorisation hop. Returns the provider's URL; the caller leaves
 * the app for it, and the link only exists when the round trip lands back here.
 */
export async function connect(id: string): Promise<string> {
  const reply = await apiJson<{ ok: boolean; redirectUrl: string }>("/api/integrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: id }),
  });
  return reply.redirectUrl;
}

/**
 * The links the account holds. `failed` distinguishes "the account service
 * didn't answer" from "there is nothing connected", which the page says out
 * loud rather than showing an empty list.
 */
export function useConnectedApps(): {
  apps: ConnectedApp[] | null;
  failed: boolean;
  refresh: () => void;
} {
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    readConnected()
      .then((next) => {
        if (!live) return;
        setApps(next);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { apps, failed, refresh };
}
