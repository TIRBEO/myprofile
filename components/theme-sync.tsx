"use client";

import { useEffect } from "react";
import { applyTheme, onSystemThemeChange, readTheme } from "@/lib/theme";
import { ensureSettings, subscribeSettings } from "@/lib/remote-store";

/**
 * Keeps a "System" theme in step with the device — but only while the saved
 * preference is actually "system". A pinned Light/Dark choice is never
 * overridden by an OS flip. Also converges on the account's saved theme once
 * the settings bag lands, so a new device shows what the user chose elsewhere.
 * Mounted once from the root layout; renders nothing.
 */
export function ThemeSync() {
  useEffect(() => {
    /* Every call here reflects a value the store already holds, so none of them
       may persist: persisting re-enters this same subscription through
       `pushSetting` → `emit()` and recurses until the stack overflows. */
    const followDevice = onSystemThemeChange(() => {
      if (readTheme() === "system") applyTheme("system", { persist: false });
    });

    let alive = true;
    void ensureSettings().then(() => {
      if (alive) applyTheme(readTheme(), { persist: false });
    });
    const unsubscribe = subscribeSettings(() => {
      if (alive) applyTheme(readTheme(), { persist: false });
    });

    return () => {
      alive = false;
      followDevice();
      unsubscribe();
    };
  }, []);

  return null;
}
