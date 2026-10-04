"use client";

/* ═══════════════════════════════════════════════════════════════════
   Persisted choices

   The settings pages that are really a set of switches and picks all need the
   same three things: read once when the page mounts, write on every change,
   survive a reload. They used to keep the answers in this browser; now the
   values live on the account (preferences.user_preferences) and localStorage
   is only the first-paint mirror — see lib/remote-store. The module API is
   unchanged, so the pages that call read/write/usePrefs move onto the server
   without editing.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { ensureSettings, getStored, reloadSettings, setStored, subscribeSettings } from "@/lib/remote-store";
import { usePageRefresh } from "@/lib/page-refresh";

export type Choice = Record<string, boolean | string>;

/** Layer only the keys a page knows about, so a renamed option can't strand
    junk, and only when the type still matches the default. */
function mergeChoice<T extends Choice>(base: T, incoming: Partial<T>): T {
  const next = { ...base };
  for (const key of Object.keys(base) as (keyof T)[]) {
    const value = incoming?.[key];
    if (typeof value === typeof base[key]) next[key] = value as T[keyof T];
  }
  return next;
}

export function read<T extends Choice>(store: string, defaults: T): T {
  // getStored resolves: server bag → legacy per-store slot → the default.
  const raw = getStored<Partial<T>>(store, {});
  return mergeChoice(defaults, raw ?? {});
}

export function write<T extends Choice>(store: string, values: T) {
  setStored(store, values);
}

/**
 * `null` until the choice has been resolved. It paints from the local mirror
 * at once, then flips to the server value the moment the bag lands, so a page
 * never shows the wrong thing and then corrects.
 */
export function usePrefs<T extends Choice>(store: string, defaults: T) {
  const [values, setValues] = useState<T | null>(null);

  useEffect(() => {
    let alive = true;
    setValues(read(store, defaults)); // first paint from cache
    void ensureSettings().then(() => {
      if (alive) setValues(read(store, defaults));
    });
    const unsubscribe = subscribeSettings(() => {
      if (alive) setValues(read(store, defaults));
    });
    return () => {
      alive = false;
      unsubscribe();
    };
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

  // A pull-to-refresh on a page of switches means "ask the account again" —
  // the bag re-fetches and subscribeSettings repaints this page. The handler
  // is awaited for its effect, not its value, so the resolved bag is dropped
  // here rather than widening the hook's signature to Promise<Bag>.
  usePageRefresh(async () => {
    await reloadSettings();
  });

  return { values, set };
}
