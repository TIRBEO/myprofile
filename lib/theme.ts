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

import { pushSetting } from "@/lib/remote-store";
import { saveSemanticPrefs } from "@/lib/semantic-prefs";

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
/** Set only by a tap on this device's Appearance screen — it holds the value
    this device was told, and it is the only preference `readTheme` reads. */
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
/** Nobody has picked on this device, the device's own mode wins. A choice
    made *here* is the only thing that outranks the OS — a value another
    device pushed to the account never pins this one, which is why the bag
    and the account column are writes, not reads, for the palette. */
export const DEFAULT_THEME: ThemeId = "system";
export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && KNOWN_IDS.includes(v);
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const chosen = window.localStorage.getItem(CHOICE_KEY);
    return isThemeId(chosen) ? chosen : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export type ResolvedTheme = "dark" | "light";

/** The stored preference resolves to a palette. `system` follows the device,
    and falls back to light where the media query is unavailable. */
export function resolveTheme(id: ThemeId): ResolvedTheme {
  if (id === "dark") return "dark";
  if (id === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/**
 * Writes the palette to <html> and persists the choice.
 *
 * `persist: false` is for callers that only *re-paint* the already-recorded
 * choice — an OS flip while the preference is "system". The device was never
 * told anything new, so nothing is recorded and nothing is pushed.
 */
export function applyTheme(id: ThemeId, { persist = true }: { persist?: boolean } = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const concrete = resolveTheme(id);
  root.setAttribute("data-theme", concrete);
  root.style.colorScheme = concrete;
  try {
    window.localStorage.setItem(THEME_KEY, id);
    // A tap is a decision made *on this device* — the only thing that
    // outranks the OS on this device. It is written beside the choice itself
    // so the boot script and `readTheme` agree on where the answer lives.
    if (persist) window.localStorage.setItem(CHOICE_KEY, id);
  } catch {
    /* private mode — palette still applies for this session */
  }
  if (!persist) return;
  // Mirror the choice onto the account — the bag for the other Tirbeo
  // surfaces' stores, the typed column for admin analytics and the account
  // export. It records what this device chose; it never comes back as an
  // order to this device or to any other one, whose OS is its own answer.
  pushSetting(THEME_KEY, id);
  saveSemanticPrefs({ theme: id });
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
    Mirrors readTheme + resolveTheme without importing anything — it runs
    before React. Only this device's own recorded choice outranks the OS. */
export const THEME_BOOT = `(function(){try{var c=localStorage.getItem("${CHOICE_KEY}");var t=(c==="dark"||c==="light"||c==="system")?c:"system";var a=t==="dark"||(t==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",a);document.documentElement.style.colorScheme=a;}catch(e){}})();`;
