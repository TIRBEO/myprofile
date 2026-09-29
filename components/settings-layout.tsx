"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, SearchX } from "lucide-react";
import { EmptyState, SearchField, Sheet, SheetActions, cn } from "@/components/ig-ui";
import { NAV_GROUPS, searchNav, titleFor, type NavGroup } from "@/lib/nav";
import { haptic } from "@/lib/haptics";
import { englishFor, useT } from "@/lib/i18n";
import { ensureSession, endSession, watchInactivity } from "@/lib/session";
import { AccountLockScreen } from "@/components/account-lock";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { LOCK_HREFS, lockAllows, useAccountLock, useWelcome } from "@/lib/account-state";

/* ═══════════════════════════════════════════════════════════════════
   Account app shell

   Phone    : no app bar and no tab bar. Every page carries its own
              back chevron, so the whole thing drills down the way the
              rest of the app does, with the index as the one hub.
   Desktop  : fixed rail with live search, plus ⌘K anywhere.
   ═══════════════════════════════════════════════════════════════════ */

const RAIL_WIDTH = "lg:pl-[22rem]";

/** Where the user had scrolled on each page, so coming back from a
    sub-page drops them where they left off instead of at the top. */
const scrollSpots = new Map<string, number>();

/** Layout effects only make sense in the browser; the server pass falls back
    so the SSR render doesn't warn. */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [railQuery, setRailQuery] = useState("");
  /* Bumped by a pull-to-refresh; it is the `main` element's key. */
  const [cycle, setCycle] = useState(0);
  const lastPath = useRef<string | null>(null);
  const lastScrollY = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);

  const t = useT();
  const title = t(titleFor(pathname));

  /* With no server to ask, "refresh" means build the page again: the key on
     `main` changes, the subtree comes down, and every number and list is read
     off this device a second time. The remembered offset goes with it, so the
     rebuild starts at the top rather than dropping you back into the middle. */
  const refresh = useCallback(() => {
    scrollSpots.set(pathname, 0);
    window.scrollTo(0, 0);
    setCycle((c) => c + 1);
  }, [pathname]);

  // The browser clamps window.scrollY to 0 the moment the old page's DOM is
  // swapped out — before any effect gets to read it — so the live value is
  // tracked here and handed to the map on the way out.
  useEffect(() => {
    const onScroll = () => {
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useBrowserLayoutEffect(() => {
    if (lastPath.current && lastPath.current !== pathname) {
      scrollSpots.set(lastPath.current, lastScrollY.current);
    }
    lastPath.current = pathname;

    const target = scrollSpots.get(pathname) ?? 0;
    if (!target) {
      window.scrollTo(0, 0);
      return;
    }
    // Pages fill themselves in from storage a tick after mount, so keep
    // re-applying the offset while the document is still growing.
    let seen = -1;
    let elapsed = 0;
    const id = window.setInterval(() => {
      elapsed += 50;
      const height = document.documentElement.scrollHeight;
      if (height !== seen) {
        seen = height;
        window.scrollTo(0, Math.max(0, Math.min(target, height - window.innerHeight)));
      }
      if (elapsed >= 900) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [pathname]);

  // Close the palette on navigation, otherwise it survives the route.
  useEffect(() => {
    setPaletteOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Every page here is a client component, so route-specific <title> is
  // cheaper to set here than to export metadata from 22 files.
  useEffect(() => {
    document.title = `${title} · Tirbeo`;
  }, [title]);

  // Keep a session alive for the whole shell, and enforce the inactivity
  // sign-out whenever "stay signed in" is off (lib/session reads the switch
  // fresh on every tick, so flipping it here takes hold without a reload).
  useEffect(() => {
    ensureSession();
    return watchInactivity(() => {
      window.location.href = "/settings";
    });
  }, []);

  /* ── The account gate ───────────────────────────────────────────
     A paused account, a scheduled deletion and an unread decision each shut
     the whole area down to their own screen. Nothing here is a notice on top
     of the page: the shell isn't rendered at all, so there's no rail to
     navigate from and nothing of the dashboard to catch a glimpse of. The
     redirect is what keeps it true once you're on the screen it allows —
     back, or a typed-in URL, or a bookmark all come back here.            */
  const lock = useAccountLock();
  const welcome = useWelcome();
  /* Coming back out of a pause, or calling off a deletion, leaves a receipt
     behind. Until it's been acknowledged it holds the screen the same way a
     lock does — and it stops the redirect from pulling the page out from
     under it halfway through. */
  const clearHref =
    lock || welcome ? null : LOCK_HREFS.find((href) => pathname.startsWith(href));

  useEffect(() => {
    if (lock && !lockAllows(lock, pathname)) router.replace(lock.href);
    else if (!lock && !welcome && clearHref) router.replace("/settings");
  }, [lock, welcome, pathname, clearHref, router]);

  if (lock && !lockAllows(lock, pathname)) return <AccountLockScreen />;
  if (!lock && welcome) return <AccountLockScreen />;

  /* The lock page is the one thing a locked account sees, and it sees it
     without the rail, the palette or the sign-out sheet standing behind it. */
  if (lock) {
    return (
      <div className="min-h-dvh bg-bg">
        <main className="min-h-dvh">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <SideRail
        query={railQuery}
        onQuery={setRailQuery}
        onSignOut={() => setSignOutOpen(true)}
      />

      <main ref={mainRef} key={cycle} className={cn("min-h-dvh", RAIL_WIDTH)}>
        {children}
      </main>

      <PullToRefresh onRefresh={refresh} target={mainRef} />

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}

      {signOutOpen ? <SignOutSheet onClose={() => setSignOutOpen(false)} /> : null}
    </div>
  );
}

/* ── Desktop rail ───────────────────────────────────────────────── */

function SideRail({
  query,
  onQuery,
  onSignOut,
}: {
  query: string;
  onQuery: (v: string) => void;
  onSignOut: () => void;
}) {
  const t = useT();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[22rem] flex-col border-r border-divider bg-rail lg:flex">
      <div className="px-5 pt-7 pb-5">
        <Wordmark />
      </div>

      <div className="px-4 pb-4">
        <SearchField
          value={query}
          onChange={onQuery}
          placeholder={t("Search")}
          className="[&_input]:rounded-full [&_input]:border-transparent"
        />
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavGroups query={query} />
      </div>

      <div className="border-t border-divider p-3">
        <button
          type="button"
          onClick={onSignOut}
 className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full bg-danger px-3.5 text-[15px] font-semibold text-white outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_85%,#000)] active:bg-[color-mix(in_srgb,var(--danger)_72%,#000)]"
        >
          <LogOut className="size-[18px] shrink-0" strokeWidth={2.2} />
          {t("Log out")}
        </button>
      </div>
    </aside>
  );
}

function Wordmark() {
  return (
    <span className="flex items-baseline gap-2 px-1 leading-none tracking-tight">
      <span className="text-[24px] leading-none font-extrabold tracking-[-0.03em]">Tirbeo</span>
      <span className="text-[24px] leading-none font-bold tracking-[-0.02em] text-muted">MyProfile</span>
    </span>
  );
}

/* ── Overlays ───────────────────────────────────────────────────── */

/** Exported so the phone index can end the session too, not just the rail. */
export function SignOutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="Log out of Tirbeo?"
      description="You can log back in any time with your email and password."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Stay signed in"
          onCancel={onClose}
          confirmLabel="Log out"
          confirmVariant="danger"
          onConfirm={() => {
            endSession();
            /* There's no sign-in screen to fall back to — the app root is the
               account, so logging out lands you back at the top of it. */
            window.location.href = "/settings";
          }}
        />
      }
    />
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const t = useT();

  // Enter jumps straight to the best match.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const best = searchNav(query)[0];
    if (!best) return;
    e.preventDefault();
    onClose();
    router.push(best.item.href);
  };

  return (
    <Sheet
      title={t("Jump to")}
      onClose={onClose}
      width="lg"
      footer={
        <p className="text-center text-[12px] text-muted">
          Press <Kbd>↵</Kbd> to open the first result · <Kbd>esc</Kbd> to close
        </p>
      }
    >
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={t("Search all settings")}
        autoFocus
        onKeyDown={onKeyDown}
        className="mb-3"
      />
      <NavGroups query={query} onNavigate={onClose} />
    </Sheet>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px]">
      {children}
    </kbd>
  );
}

/* ── Shared nav rendering ───────────────────────────────────────── */

function NavGroups({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const groups = useMemo(() => filterGroups(query), [query]);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="size-6" />}
        title={t("No settings match")}
        description={`Nothing found for “${query.trim()}”. Try a shorter word.`}
      />
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.id} className="mb-8 last:mb-0">
          <p className="px-3.5 pt-2 pb-2.5 text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            {t(group.title)}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    haptic("light");
                    onNavigate?.();
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
 "flex min-h-11 items-center gap-3.5 rounded-2xl px-3.5 text-[15px] outline-none transition-colors",
                    active
                      ? "bg-surface-2 font-semibold text-fg"
                      : "font-medium text-fg/90 hover:bg-surface-2/60 active:bg-surface-2/80",
                  )}
                >
                  <Icon
                    className={cn("size-5 shrink-0", active ? "text-fg" : "text-muted")}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function filterGroups(query: string): NavGroup[] {
  /* Typed in the app's own language, so "Ajustes" finds the page the code
     calls Settings; typed in English, it still works. */
  const q = englishFor(query).trim();
  if (!q) return NAV_GROUPS;

  const ranked = searchNav(q);
  const byGroup = new Map<string, typeof ranked>();
  for (const hit of ranked) {
    const list = byGroup.get(hit.group) ?? [];
    list.push(hit);
    byGroup.set(hit.group, list);
  }
  return NAV_GROUPS.filter((g) => byGroup.has(g.title)).map((g) => ({
    ...g,
    items: byGroup.get(g.title)!.map((h) => h.item),
  }));
}
