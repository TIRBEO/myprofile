/* ═══════════════════════════════════════════════════════════════════
   The eight screens that address one record

   Every /settings screen that reads a list reads it in the browser, so it
   prerenders and costs no serverless function. These eight are the
   exception: their path carries an id, and each one used to be its own
   file-based route — eight functions on a plan that allows twelve, before
   the two bridge routes and the edge gate have taken their share.

   They are one route now. This file is what says which record a path
   means, and it is deliberately plain data with no "use client" on it: the
   server route reads it to decide whether a path is real (anything it does
   not recognise is a 404, not a blank screen), and the client dispatcher
   reads it again to choose the screen. One answer, asked in both places.
   ═══════════════════════════════════════════════════════════════════ */

export type RecordTarget =
  | { screen: "activity-log"; id: string }
  | { screen: "connected-apps"; id: string }
  | { screen: "devices"; id: string }
  | { screen: "download-data"; id: string }
  | { screen: "login-activity"; id: string }
  | { screen: "recently-deleted"; id: string }
  | { screen: "status-section"; section: string }
  | { screen: "status-item"; section: string; item: string };

type IdScreen = Extract<RecordTarget, { id: string }>["screen"];

/** The sections whose second segment is a record id. `account-status` is
    absent on purpose: its second segment is a section name, not an id. */
const ID_SCREENS = new Set([
  "activity-log",
  "connected-apps",
  "devices",
  "download-data",
  "login-activity",
  "recently-deleted",
] as const satisfies readonly IdScreen[]);

/** Addresses under those same sections that are pages in their own right.
    Next resolves a static page before the catch-all, so nothing breaks while
    both exist — but a table that claims an address another page owns is a trap
    for whoever eventually deletes one of them. */
const PAGES_OF_THEIR_OWN = new Set(["account-status/history", "devices/sign-out"]);

/**
 * Which screen a path under /settings means, or null when it means none of
 * them. The paths are the ones the app has always linked to, so no address
 * changes: `/settings/devices/<id>`, `/settings/account-status/<section>`,
 * `/settings/account-status/<section>/<item>`.
 */
export function recordTarget(segments: readonly string[]): RecordTarget | null {
  if (segments.length === 3 && segments[0] === "account-status" && segments[1] && segments[2]) {
    return { screen: "status-item", section: segments[1], item: segments[2] };
  }
  if (segments.length !== 2) return null;
  const [head, second] = segments;
  if (!head || !second) return null;
  if (PAGES_OF_THEIR_OWN.has(`${head}/${second}`)) return null;
  if (head === "account-status") return { screen: "status-section", section: second };
  if (ID_SCREENS.has(head as IdScreen)) return { screen: head as IdScreen, id: second };
  return null;
}