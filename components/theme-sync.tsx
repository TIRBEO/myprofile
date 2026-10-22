"use client";

import { useEffect } from "react";
import { applyTheme, onSystemThemeChange, readTheme } from "@/lib/theme";

/**
 * Keeps a "System" theme in step with the device — but only while the saved
 * preference is actually "system". A pinned Light/Dark choice on this device
 * is never overridden by an OS flip, and nothing the *account* holds can pin
 * this device at all: the OS is the default here. Mounted once from the root
 * layout; renders nothing.
 */
export function ThemeSync() {
  useEffect(
    () =>
      onSystemThemeChange(() => {
        if (readTheme() === "system") applyTheme("system", { persist: false });
      }),
    [],
  );

  return null;
}
