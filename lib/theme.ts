"use client";

/* ── Theme ────────────────────────────────────────────────────────
   Two palettes — light is the default, dark is one tap away. Both are
   ink-first: the foreground carries the contrast (near-black text, dark
   red actions, dark red danger) so neither theme depends on pale accents.

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
    id: "light",
    label: "Daylight",
    description: "White canvas, near-black ink, dark red for what matters",
    scheme: "light",
    swatch: { bg: "#ffffff", bar: "#d92c3f", card: "#f6f7f9", line: "#d5dae1", ink: "#414855" },
  },
  {
    id: "dark",
    label: "Black",
    description: "Black canvas, elevated plates, dark red for what you can press",
    scheme: "dark",
    swatch: { bg: "#000000", bar: "#d92c3f", card: "#0e0e11", line: "#23262c", ink: "#9ba1ab" },
  },
];

/** Ids that may come back from a stored preference — not the choices offered. */
const KNOWN_IDS: string[] = ["system", "dark", "light"];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && KNOWN_IDS.includes(v);
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") return "light";
  // The account bag is the truth once it has landed; the raw localStorage slot
  // is what the first-paint boot script wrote and the offline fallback.
  const fromBag = getStored<string | null>(THEME_KEY, null);
  if (isThemeId(fromBag)) return fromBag;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return isThemeId(saved) ? saved : "light";
  } catch {
    return "light";
  }
}

export type ResolvedTheme = "dark" | "light";

/** The stored preference resolves to a palette. `system` — reachable from an
    older build's saved choice — follows the device, and falls back to light. */
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
export const THEME_BOOT = `(function(){try{var k="${THEME_KEY}";var v=localStorage.getItem(k);var t=(v==="dark"||v==="light"||v==="system")?v:"light";var d=t==="dark"||(t==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);var a=d?"dark":"light";document.documentElement.setAttribute("data-theme",a);document.documentElement.style.colorScheme=a;}catch(e){}})();`;
