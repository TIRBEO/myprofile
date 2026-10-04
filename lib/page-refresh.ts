"use client";

/* ═══════════════════════════════════════════════════════════════════
   Refresh that touches one page, not the shell

   Pull-to-refresh used to rebuild the whole `main` subtree, which reset
   the rail's scroll position, the sticky app bar and every panel on the
   page along with the data that actually changed. A page registers its
   own re-read here instead; the gesture calls that when one exists and
   only falls back to the rebuild for pages with nothing to register.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";

type Handler = () => void | Promise<void>;

let current: Handler | null = null;

/** Register `handler` as the page's answer to a pull-to-refresh. The latest
    closure always wins, so a handler that reads fresh state doesn't need the
    page to unmount first. */
export function usePageRefresh(handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn: Handler = () => ref.current();
    current = fn;
    return () => {
      if (current === fn) current = null;
    };
  }, []);
}

/** True when a page handled it — the caller skips its own rebuild then. */
export function refreshCurrentPage(): boolean {
  if (!current) return false;
  void current();
  return true;
}
