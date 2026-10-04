"use client";

/* ═══════════════════════════════════════════════════════════════════
   Two-factor, from the account service

   The secret, the codes and the on/off switch all live on the brain:
   it is the only thing that ever verifies a code at sign-in, so a copy
   kept in this browser would be a second, disagreeing truth. What comes
   back from the brain is state — plus plaintext codes exactly twice, in
   the reply that minted them. Hold those in memory for the reveal sheet
   and never write them down: not to localStorage, not to a variable that
   outlives the sheet.

   Every call here is a sensitive action, so the brain asks for proof of
   identity beyond the session cookie. Turning the app off is the one call
   that needs a live code anyway, so it pays for itself; the rest ride on
   the shared "Confirm it's you" sheet (lib/reauth.ts) and take a proof as
   an argument.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { apiJson, apiSend } from "@/lib/api";
import { type ReauthProof } from "@/lib/reauth";

export const CODE_COUNT = 8;

/** What the account service allows: see backupCodesRegenerateHandler. */
export const MINTS_PER_HOUR = 3;

/** A set as the brain reports it: minted together, some of it spent. */
export type CodeSetSummary = {
  createdAt: number;
  total: number;
  remaining: number;
};

export type TwoFactorState = {
  /** The authenticator app is enrolled *and* confirmed. */
  authenticator: boolean;
  requireForActions: boolean;
  alertSuspicious: boolean;
  codes: {
    total: number;
    remaining: number;
    sets: CodeSetSummary[];
  };
};

/** A set caught in the act of being shown. Lives only in component state. */
export type RevealedCodes = {
  codes: string[];
  createdAt: number;
};

type CodesReply = {
  enabled: boolean;
  totpEnabled: boolean;
  count: number;
  remaining: number;
  sets: { createdAt: string | null; total: number; remaining: number }[];
};

type SettingsReply = { ok: boolean; settings: Record<string, unknown> };

/** The two switches on the two-factor page, kept in the account's settings. */
const PREF_KEYS = {
  requireForActions: "twoFactorRequireForActions",
  alertSuspicious: "twoFactorAlertSuspicious",
} as const;

const PREF_DEFAULTS = { requireForActions: true, alertSuspicious: true };

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function readTwoFactor(): Promise<TwoFactorState> {
  const [codes, stored] = await Promise.all([
    apiJson<CodesReply>("/api/security/backup-codes/list"),
    apiJson<SettingsReply>("/api/settings").catch((): SettingsReply => ({ ok: false, settings: {} })),
  ]);
  const prefs = stored.settings ?? {};
  return {
    authenticator: !!codes.totpEnabled,
    requireForActions: asBool(prefs[PREF_KEYS.requireForActions], PREF_DEFAULTS.requireForActions),
    alertSuspicious: asBool(prefs[PREF_KEYS.alertSuspicious], PREF_DEFAULTS.alertSuspicious),
    codes: {
      total: codes.count ?? 0,
      remaining: codes.remaining ?? 0,
      sets: (codes.sets ?? []).map((set) => ({
        createdAt: set.createdAt ? Date.parse(set.createdAt) : 0,
        total: set.total,
        remaining: set.remaining,
      })),
    },
  };
}

/** One switch at a time, so a row that fails reverts on its own. */
export async function saveTwoFactorPrefs(
  next: Partial<Pick<TwoFactorState, "requireForActions" | "alertSuspicious">>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (next.requireForActions !== undefined) body[PREF_KEYS.requireForActions] = next.requireForActions;
  if (next.alertSuspicious !== undefined) body[PREF_KEYS.alertSuspicious] = next.alertSuspicious;
  if (!Object.keys(body).length) return;
  await apiSend("/api/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings: body }),
  });
}

/** Step one of turning it on. Returns the provisioning URI the QR carries. */
export async function startSetup(proof: ReauthProof = {}): Promise<string> {
  const reply = await apiJson<{ uri: string }>("/api/security/totp/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proof),
  });
  return reply.uri;
}

/** Turns the authenticator on and mints a set — the only time it is readable. */
export async function confirmSetup(code: string): Promise<RevealedCodes> {
  const reply = await apiJson<{ ok: boolean; backupCodes: string[] }>("/api/security/totp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return { codes: reply.backupCodes ?? [], createdAt: Date.now() };
}

/**
 * Turning it off retires every set, so it asks twice: the live code (or a
 * backup code, for someone who's lost the app), because the code proves a
 * second factor is in your hand, and whatever the shared sheet offers, because
 * the account service refuses a bare session cookie.
 */
export type DisableFactor = { code?: string; backupCode?: string };

export async function disableAuthenticator(factor: DisableFactor, proof: ReauthProof = {}): Promise<void> {
  await apiSend("/api/security/totp/disable", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...proof, ...factor }),
  });
}

/** A fresh set, replacing everything before it. Readable until you leave. */
export async function regenerateCodes(proof: ReauthProof = {}): Promise<RevealedCodes> {
  const reply = await apiJson<{ ok: true; codes: string[] }>("/api/security/backup-codes/regenerate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proof),
  });
  return { codes: reply.codes ?? [], createdAt: Date.now() };
}

/**
 * The state both security screens read. `refresh` re-fetches after a write;
 * `set` is for an optimistic flip of one of the two switches, which the page
 * rolls back if the save comes back failing.
 */
export function useTwoFactorState(): {
  state: TwoFactorState | null;
  failed: boolean;
  refresh: () => void;
  set: (next: TwoFactorState) => void;
} {
  const [state, setState] = useState<TwoFactorState | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    readTwoFactor()
      .then((next) => {
        if (!live) return;
        setState(next);
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
  return { state, failed, refresh, set: setState };
}
