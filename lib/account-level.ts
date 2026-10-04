"use client";

/* ═══════════════════════════════════════════════════════════════════
   The account's status level, from the account service

   A single whole number every account carries. 0 is not an absent value
   — it is the decision-free state, "nothing flagged on your account",
   and the brain answers 0 (never null, never 404) for every account that
   has none. Only an admin raises it; this screen can read it, not move
   it. One read path: GET /api/user/account-status on the brain.
   ═══════════════════════════════════════════════════════════════════ */

import { apiJson } from "@/lib/api";

export type AccountLevel = {
  /** 0 = nothing has been decided about this account. */
  level: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export function readAccountLevel(): Promise<AccountLevel> {
  return apiJson<AccountLevel>("/api/user/account-status");
}
