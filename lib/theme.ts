"use client";

/* ── Theme ─────────────────────────────────────────────────────────
   Three choices: follow the OS, or pin one of two palettes. The
   palette itself lives in globals.css keyed off <html data-theme>,
   so switching is a single attribute write — no inline var churn.  */

import { getStored, pushSetting } from "@/lib/remote-store";

export type ThemeId = "system" | "dark" | "light";

export type ThemeDef = {
  id: ThemeId;
  label: string;
  description: string;
  /** Fixed scheme for previews; "system" mirrors the device. */
  scheme: "dark" | "light";
  /** Swatches for the miniature preview window. */
  swatch: { bg: string; bar: string; card: string; line: string; ink: string };
};

export const THEME_KEY = "tirbeo:theme";

export const THEMES: ThemeDef[] = [
  {
    id: "system",
    label: "System",
    description: "Match your device's appearance",
    scheme: "dark",
    swatch: { bg: "#000000", bar: "#0a84ff", card: "#0e0e10", line: "#212121", ink: "#a8a8a8" },
  },
  {
    id: "dark",
    label: "Dark",
    description: "Black canvas, solid panels, built for night",
    scheme: "dark",
    swatch: { bg: "#000000", bar: "#0a84ff", card: "#0e0e10", line: "#212121", ink: "#a8a8a8" },
  },
  {
    id: "light",
    label: "Light",
    description: "Clean white with soft grey edges",
    scheme: "light",
    swatch: { bg: "#e9e9ee", bar: "#0a6cff", card: "#ffffff", line: "#e2e2e7", ink: "#b4b4bd" },
  },
];

export const THEME_IDS: ThemeId[] = ["system", "dark", "light"];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as string[]).includes(v);
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") return "system";
  // The account bag is the truth once it has landed; the raw localStorage slot
  // is what the first-paint boot script wrote and the offline fallback.
  const fromBag = getStored<string | null>(THEME_KEY, null);
  if (isThemeId(fromBag)) return fromBag;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return isThemeId(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export type ResolvedTheme = "dark" | "light";

/**
 * `system` is a preference, not a palette — resolve it to the concrete one
 * the OS is asking for. `<html data-theme>` therefore only ever holds a
 * real palette, which is what lets globals.css work without a media query.
 */
export function resolveTheme(id: ThemeId): ResolvedTheme {
  if (id !== "system") return id;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Writes the palette to <html> and, for a real choice, persists it.
 *
 * `persist: false` is for the callers that are only *reflecting* a value the
 * store already holds — the system-theme follower and the settings sync. Those
 * run inside the store's own listener, and persisting there re-enters the
 * listener through `pushSetting` → `emit()` → listener → `applyTheme` → …, a
 * synchronous loop that overflows the stack on every page load.
 */
export function applyTheme(id: ThemeId, { persist = true }: { persist?: boolean } = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const concrete = resolveTheme(id);
  const scheme = THEMES.find((t) => t.id === concrete)?.scheme ?? "dark";
  root.setAttribute("data-theme", concrete);
  root.style.colorScheme = scheme;
  try {
    window.localStorage.setItem(THEME_KEY, id);
  } catch {
    /* private mode — palette still applies for this session */
  }
  if (!persist) return;
  // Mirror the choice onto the account too, so another device converges.
  pushSetting(THEME_KEY, id);
}

/**
 * Calls `onChange` when the OS flips light/dark, so a "System" theme follows
 * the device without a reload. Returns an unsubscribe function.
 */
export function onSystemThemeChange(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Inlined in <head> so the palette is correct on the very first paint. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t==="light"?"light":"dark";}catch(e){}})();`;
