"use client";

/* ═══════════════════════════════════════════════════════════════════
   Data usage and cookie choices, from the account service

   These four toggles used to live in this browser only (the localStorage
   bag), which meant the answer you gave on a laptop was nobody's answer
   on a phone. The brain now owns the single truth —
   features/preferences/dataUsage.ts, stored under the account's privacy
   blob — and every read and write here goes to `/api/preferences/data-
   usage`. The PUT answers with the full merged set, so the screen settles
   on what the account actually holds, including the rule it enforces:
   marketing cookies cannot stay on once analytics cookies are off.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";

export type DataUsagePrefs = {
  personalised: boolean;
  shareWithPartners: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
};

export function readDataUsage(): Promise<DataUsagePrefs> {
  return apiJson<DataUsagePrefs>("/api/preferences/data-usage");
}

/** Writes a patch and returns the account's FULL merged choices, so the
    caller can adopt the server's answer instead of guessing at it. */
export function saveDataUsage(patch: Partial<DataUsagePrefs>): Promise<DataUsagePrefs> {
  return apiJson<DataUsagePrefs>("/api/preferences/data-usage", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}
