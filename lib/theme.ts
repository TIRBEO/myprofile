"use client";

/* ── Theme ─────────────────────────────────────────────────────────
   Three choices: follow the OS, or pin one of two palettes. The
   palette itself lives in globals.css keyed off <html data-theme>,
   so switching is a single attribute write — no inline var churn.  */

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
    swatch: { bg: "#2a2a30", bar: "#0a84ff", card: "#141417", line: "#27272c", ink: "#9b9ba4" },
  },
  {
    id: "dark",
    label: "Dark",
    description: "Deep charcoal, built for night",
    scheme: "dark",
    swatch: { bg: "#08080a", bar: "#0a84ff", card: "#141417", line: "#27272c", ink: "#9b9ba4" },
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

/** Writes the palette to <html> and persists the choice. */
export function applyTheme(id: ThemeId) {
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
