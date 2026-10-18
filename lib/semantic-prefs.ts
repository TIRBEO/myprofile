"use client";

/* ═══════════════════════════════════════════════════════════════════
   The account's own appearance columns

   `/api/preferences` keeps theme, language and timezone in typed columns
   on the account, beside the settings bag this app writes. The columns are
   what every other Tirbeo surface reads, and the bag is what this app's
   first-paint boot scripts read, so a choice belongs in both: this module
   is the write half, and the read half is what a page seeds itself from.

   Nothing here throws at a caller. A settings switch must move the moment
   it is tapped and reconcile afterwards, so the round trip is reported,
   not awaited — the bag write beside it already carries the failure the
   person sees (see lib/remote-store's persist watcher).
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson, apiSend } from "@/lib/api";
import { trackError } from "@/lib/telemetry";

export type SemanticPrefs = {
  theme?: string | null;
  language?: string | null;
  timezone?: string | null;
  dateFormat?: string | null;
  timeFormat?: string | null;
};

export type SemanticPatch = { theme?: string; language?: string };

/** What the server answers when the column has never been written — the value
    it hands out for an account that has chosen nothing. A bag holding anything
    else is the more specific answer, so a default never overwrites it. */
export const SEMANTIC_DEFAULTS: Required<Pick<SemanticPrefs, "theme" | "language">> = {
  theme: "system",
  language: "en",
};

/** The columns, as the account holds them. `null` when the account didn't
    answer, which every caller reads as "the bag stands". */
export async function readSemanticPrefs(): Promise<SemanticPrefs | null> {
  try {
    const reply = await apiJson<{ ok?: boolean; preferences?: SemanticPrefs }>("/api/preferences");
    return reply?.preferences ?? null;
  } catch (err) {
    trackError("semantic-prefs.read", err);
    return null;
  }
}

/** Writes one or both columns. Fire-and-forget by design; a failure is
    reported to the same channel the bag writes use, so the person sees the
    switch didn't stick rather than being told twice. */
export function saveSemanticPrefs(patch: SemanticPatch, onError?: (err: unknown) => void): void {
  void apiSend("/api/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).catch((err: unknown) => {
    trackError("semantic-prefs.write", err);
    onError?.(err);
  });
}
