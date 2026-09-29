"use client";

/* ── Haptics ───────────────────────────────────────────────────────
   Thin wrapper over the Vibration API. Silently no-ops on desktop
   and wherever the browser withholds the API (iOS Safari, Firefox). */

type HapticPattern = "light" | "medium" | "heavy" | "selection" | "success" | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  selection: 5,
  success: [10, 50, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(pattern: HapticPattern = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* blocked by permissions policy — not worth surfacing */
  }
}
