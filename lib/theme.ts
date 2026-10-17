"use client";

/* ── Theme ────────────────────────────────────────────────────────
   Three choices, and the default is the one that asks for nothing: follow
   the device. A pinned Midnight or Daylight wins over the device.

   The dark scheme is a #26262a charcoal canvas with #1a1a1d near-black
   plates; the light one is #e9eaee behind white plates. Both are ink-first —
   the foreground carries the contrast (white text on charcoal, near-black on
   white) and one sky blue (#0a84ff) marks everything you can press.

   The palette itself lives in globals.css keyed off <html data-theme>,
   so applying it is a single attribute write — no inline var churn.  */

import { getStored, pushSetting } from "@/lib/remote-store";

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

export const THEMES: ThemeDef[] = [
  {
    id: "system",
    label: "Follow device",
    description: "Uses the light or dark setting your phone or computer is already on",
    scheme: "dark",
    swatch: { bg: "#26262a", bar: "#0d6ecf", card: "#1a1a1d", line: "#2e2e32", ink: "#a1a1a8" },
  },
  {
    id: "dark",
    label: "Midnight",
    description: "Charcoal canvas, near-black plates, sky blue for what you can press",
    scheme: "dark",
    swatch: { bg: "#26262a", bar: "#0d6ecf", card: "#1a1a1d", line: "#2e2e32", ink: "#a1a1a8" },
  },
  {
    id: "light",
    label: "Daylight",
    description: "Pale grey canvas, white plates, near-black ink, sky blue for what matters",
    scheme: "light",
    swatch: { bg: "#e9eaee", bar: "#0d6ecf", card: "#ffffff", line: "#dfe1e8", ink: "#6e727c" },
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
  } catch {
    /* private mode — palette still applies for this session */
  }
  if (!persist) return;
  // Mirror the choice onto the account too, so another device converges.
  pushSetting(THEME_KEY, id);
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
