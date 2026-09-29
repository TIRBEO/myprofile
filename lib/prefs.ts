"use client";

/* ═══════════════════════════════════════════════════════════════════
   Persisted choices

   The settings pages that are really a set of switches and picks all
   need the same three things: read once when the page mounts, write on
   every change, survive a reload. Nothing here reaches a server — the
   keys are per browser, which is what these choices mean anyway until
   the account API exists.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";

export type Choice = Record<string, boolean | string>;

export function read<T extends Choice>(store: string, defaults: T): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(store);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    // Only keys the page knows about, so a renamed option can't strand junk.
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = parsed?.[key];
      if (typeof value === typeof defaults[key]) next[key] = value as T[keyof T];
    }
    return next;
  } catch {
    return defaults;
  }
}

export function write<T extends Choice>(store: string, values: T) {
  try {
    localStorage.setItem(store, JSON.stringify(values));
  } catch {
    /* private mode — the choice still holds for this session */
  }
}

/**
 * `null` until the store has been read, so a page can show its skeleton
 * rather than flash the defaults and then correct itself.
 */
export function usePrefs<T extends Choice>(store: string, defaults: T) {
  const [values, setValues] = useState<T | null>(null);

  useEffect(() => {
    setValues(read(store, defaults));
    // `defaults` is a literal at every call site; the store is the only input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const set = useCallback(
    (patch: Partial<T>) => {
      setValues((current) => {
        if (!current) return current;
        const next = { ...current, ...patch };
        write(store, next);
        return next;
      });
    },
    [store],
  );

  return { values, set };
}
