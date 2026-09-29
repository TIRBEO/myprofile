"use client";

import { useEffect } from "react";
import { applyTheme, onSystemThemeChange, readTheme } from "@/lib/theme";

/**
 * Keeps a "System" theme in step with the device — but only while the saved
 * preference is actually "system". A pinned Light/Dark choice is never
 * overridden by an OS flip. Mounted once from the root layout; renders nothing.
 */
export function ThemeSync() {
  useEffect(() => {
    return onSystemThemeChange(() => {
      if (readTheme() === "system") applyTheme("system");
    });
  }, []);

  return null;
}
