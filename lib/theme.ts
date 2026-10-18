"use client";

/* ── Theme ────────────────────────────────────────────────────────
   Three choices, and the default is the one that asks for nothing: follow
   the device. A pinned Midnight or Daylight wins over the device.

   The dark scheme is Apple's grouped ladder: a #1c1c1e ground, #2c2c2e
   plates sitting *above* it, #38383a hairlines between the rows. The light
   one is #f2f2f7 behind white plates. Both are ink-first — the foreground
   carries the contrast (white text on the plate, near-black on white) and
   one blue (#0A84FF dark, #007AFF light) marks everything you can press.

   The palette itself lives in globals.css keyed off <html data-theme>,
   so applying it is a single attribute write — no inline var churn.  */

import { getStored, pushSetting } from "@/lib/remote-store";
import { SEMANTIC_DEFAULTS, readSemanticPrefs, saveSemanticPrefs } from "@/lib/semantic-prefs";

export type ThemeId = "system" | "dark" | "light";

export type ThemeDef = {
  id: ThemeId;
  label: string;
  description: string;
  /** Fixed scheme for previews. */
  scheme: "dark" | "light";
  /** Swatches for the miniature preview window. */
  swatch: { bg: string; bar: string; card: string; line: string; ink: string };
};

export const THEME_KEY = "tirbeo:theme";
/** Set only by a tap on this device's Appearance screen — the flag that says
    "this device was told", which remote writes must not overrule. */
const CHOICE_KEY = "tirbeo:theme:local";

/** The palette each tile is a picture of. These are literals on purpose: the
    tile has to show the scheme it is *offering*, not the one `<html>` is
    currently wearing, so it cannot read the live custom properties.
    `lib/tokens.test.ts` pins them against globals.css, because a
    picture of the app that quietly stops being the app is the exact drift
    the miniature was built to avoid. */
const DARK_SWATCH = { bg: "#1c1c1e", bar: "#0a84ff", card: "#2c2c2e", line: "#38383a", ink: "#b6b6bd" };
const LIGHT_SWATCH = { bg: "#f2f2f7", bar: "#007aff", card: "#ffffff", line: "#c6c6c8", ink: "#5d5d66" };

export const THEMES: ThemeDef[] = [
  {
    id: "system",
    label: "Follow device",
    description: "Uses the light or dark setting your phone or computer is already on",
    scheme: "dark",
    swatch: DARK_SWATCH,
  },
  {
    id: "dark",
    label: "Midnight",
    description: "Near-black ground, lighter plates, one blue for what you can press",
    scheme: "dark",
    swatch: DARK_SWATCH,
  },
  {
    id: "light",
    label: "Daylight",
    description: "Pale grey canvas, white plates, near-black ink, blue for what matters",
    scheme: "light",
    swatch: LIGHT_SWATCH,
  },
];

/** Ids that may come back from a stored preference — not the choices offered. */
const KNOWN_IDS: string[] = ["system", "dark", "light"];
/** What a preference with nothing behind it should resolve to. Accounts
    follows the OS outright; myprofile can pin a choice, so a pinned value
    always beats this — but nobody has picked one yet, so the device wins. */
export const DEFAULT_THEME: ThemeId = "system";
export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && KNOWN_IDS.includes(v);
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  // A palette chosen on this device is the most specific answer there is —
  // above the account bag and above the raw slot the boot script wrote.
  if (explicitLocalChoice()) return localChoice()!;
  // The account bag is the truth once it has landed; the raw localStorage slot
  // is what the first-paint boot script wrote and the offline fallback.
  const fromBag = getStored<string | null>(THEME_KEY, null);
  if (isThemeId(fromBag)) return fromBag;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export type ResolvedTheme = "dark" | "light";

/** The stored preference resolves to a palette. `system` follows the device,
    and falls back to dark where the media query is unavailable. */
export function resolveTheme(id: ThemeId): ResolvedTheme {
  if (id === "dark") return "dark";
  if (id === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

/**
 * Writes the palette to <html> and persists the choice.
 *
 * `persist: false` is for the callers that are only *reflecting* a value the
 * store already holds — the settings sync. Those run inside the store's own
 * listener, and persisting there re-enters the listener through `pushSetting`
 * → `emit()` → listener → `applyTheme` → …, a synchronous loop that overflows
 * the stack on every page load.
 */
export function applyTheme(id: ThemeId, { persist = true }: { persist?: boolean } = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const concrete = resolveTheme(id);
  root.setAttribute("data-theme", concrete);
  root.style.colorScheme = concrete;
  try {
    window.localStorage.setItem(THEME_KEY, id);
    // A tap is a decision made *on this device*. It records the fact so no
    // remote write — this app's bag, or the account's theme column — gets to
    // overrule it later on the same device. See `explicitLocalChoice`.
    if (persist) window.localStorage.setItem(CHOICE_KEY, id);
  } catch {
    /* private mode — palette still applies for this session */
  }
  if (!persist) return;
  // Mirror the choice onto the account too, so another device converges:
  // the bag for this app's first paint, the typed column for every other
  // Tirbeo surface — the theme really follows the account, not this device.
  pushSetting(THEME_KEY, id);
  saveSemanticPrefs({ theme: id });
}

/** The localStorage slot on its own — the bag and the account column are
    deliberately not consulted. "Follow device" is worth less than nothing if
    a remote value can quietly replace it, so the paths that decide *whether*
    to honour a remote value look only here. */
function localChoice(): ThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return isThemeId(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** True once the person has picked a palette on this device. A remote write
    may still land (this device's choice has to travel to the account), but it
    must not come back as an order. */
function explicitLocalChoice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHOICE_KEY) != null;
  } catch {
    return false;
  }
}

/** Seed from the account's own theme column — what the other Tirbeo surfaces
    write and read. Only a device that has never been told anything accepts
    the seed: a "Follow device" picked here stays follower, and a pinned
    Midnight or Daylight stays pinned. Runs once per session. */
let accountSeeded = false;
export async function syncThemeFromAccount(): Promise<void> {
  if (typeof window === "undefined" || accountSeeded) return;
  accountSeeded = true;
  if (explicitLocalChoice()) return;
  const prefs = await readSemanticPrefs();
  const fromAccount = prefs?.theme;
  if (!isThemeId(fromAccount) || fromAccount === SEMANTIC_DEFAULTS.theme) return;
  if (fromAccount === readTheme()) return;
  // persist:false keeps the palette out of the re-entrant listener loop
  // (see applyTheme); pushSetting carries the account's answer into the bag.
  applyTheme(fromAccount, { persist: false });
  pushSetting(THEME_KEY, fromAccount);
}

/** A "system" choice tracks the device; the other two never move. */
export function onSystemThemeChange(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (readTheme() === "system") onChange();
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

/** Inlined in <head> so the palette is correct on the very first paint.
    Mirrors resolveTheme without importing anything — it runs before React. */
export const THEME_BOOT = `(function(){try{var k="${THEME_KEY}";var v=localStorage.getItem(k);var t=(v==="dark"||v==="light"||v==="system")?v:"system";var a=t==="light"||(t==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";document.documentElement.setAttribute("data-theme",a);document.documentElement.style.colorScheme=a;}catch(e){}})();`;
