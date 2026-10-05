"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, SearchX, WifiOff } from "lucide-react";
import { Button, EmptyState, SearchField, Sheet, SheetActions, cn } from "@/components/ig-ui";
import { NAV_GROUPS, searchNav, titleFor, type NavGroup } from "@/lib/nav";
import { haptic } from "@/lib/haptics";
import { SERVICE_DOWN } from "@/lib/service-events";
import { englishFor, useT } from "@/lib/i18n";
import {
  probeSessionState,
  endSessionAndLeave,
  watchInactivity,
  redirectToLogin,
} from "@/lib/session";
import { AccountLockScreen } from "@/components/account-lock";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ProfilePicture } from "@/components/profile-picture";
import { displayName, useProfile } from "@/lib/profile";
import { LOCK_HREFS, lockAllows, useAccountLock, useWelcome } from "@/lib/account-state";

/* ═══════════════════════════════════════════════════════════════════
   Account app shell

   Phone    : each page opens under a sticky app bar — back chevron on
               the left, the page's name centred, a hairline under it —
               so it drills down the way Instagram does, with the index
               as the one hub.
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

  /* Probe the real session once per shell load. A signed-out reader is moved
     to /login exactly once — never in a loop, and never while they're already
     standing on it. Also reacts to the server declaring the credential dead
     mid-session (the 401 the profile calls raise).

     Only a 401 may do it. The profile endpoint is the sole honest way to ask
     whether the cookie is live, and when it answers with a 5xx, a timeout or
     nothing at all, that is the service being down — not the reader being a
     stranger. Treating the two as one used to throw signed-in people out to
     the login page over a momentary blip, so an unknown answer now raises the
     retry strip below and leaves the session alone.

     The strip is one flag for every way the service can go missing, and it is
     raised by whichever hears about it first — this probe or a page's own read
     (see lib/service-events). It is *not* lowered by the next thing that
     happens to succeed: two requests in flight answer in either order, and a
     page whose read failed must not have its strip wiped by an unrelated 200.
     It comes down in one place only — Try again, below. */
  const redirectedRef = useRef(false);
  const leave = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    redirectToLogin();
  }, []);

  const [serviceDown, setServiceDown] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const runProbe = useCallback(
    async (fresh: boolean) => {
      const state = await probeSessionState({ fresh });
      if (state === "unauthorized") {
        leave();
        return;
      }
      // Only ever raised here. A clean probe does not lower a strip a page's
      // failed read put up — that is Try again's job.
      if (state === "unavailable") setServiceDown(true);
    },
    [leave],
  );

  useEffect(() => {
    void runProbe(false);
    window.addEventListener("tirbeo:session-expired", leave);
    return () => window.removeEventListener("tirbeo:session-expired", leave);
  }, [runProbe, leave]);

  /* A tab that was left standing is not a live session. Coming back to the
     foreground (or the window getting focus) re-asks — through the probe's own
     cache, so returning every thirty seconds costs nothing, and the first
     return after that costs one read. Sign-outs on other devices, expired
     cookies and hour-of-inactivity ends all surface here rather than on the
     next click that fails. */
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") void runProbe(false);
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [runProbe]);

  /* And a sign-out in another tab of this app, or a "stay signed in" that
     just ran out there, arrives as a message — same origin, so no server
     round trip is needed to learn it. */
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("tirbeo:session");
      bc.addEventListener("message", (e) => {
        if (e.data?.type === "logout") leave();
      });
    } catch {
      /* no BroadcastChannel */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "tirbeo_session") return;
      try {
        const v = e.newValue ? JSON.parse(e.newValue) : null;
        if (v?.type === "logout") leave();
      } catch {
        /* ignore malformed */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [leave]);

  /* The same strip, for the other reason it appears: a page asked the service
     for something and got nothing back. Every read goes through one of the two
     wrappers in lib/api{, -client}, so one listener here covers all of them —
     an outage is not each screen's private mystery, and it should not cost a
     hand-written error state per screen to be visible. */
  useEffect(() => {
    const down = () => setServiceDown(true);
    window.addEventListener(SERVICE_DOWN, down);
    return () => window.removeEventListener(SERVICE_DOWN, down);
  }, []);

  /* Try again has to do all three halves: drop the strip the reader is asking
     about, re-ask whether the session is live, and rebuild the page so its own
     reads are made a second time. Anything still broken puts the strip straight
     back — from the probe or from the page, whichever notices. */
  const retryProbe = useCallback(async () => {
    setRechecking(true);
    setServiceDown(false);
    await runProbe(true);
    refresh();
    setRechecking(false);
  }, [runProbe, refresh]);

  // Inactivity sign-out, when "stay signed in" is off.
  useEffect(() => {
    return watchInactivity(() => {
      endSessionAndLeave();
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
        {serviceDown ? <SessionNotice onRetry={retryProbe} rechecking={rechecking} /> : null}
        {children}
      </main>

      <PullToRefresh onRefresh={refresh} target={mainRef} />

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}

      {signOutOpen ? <SignOutSheet onClose={() => setSignOutOpen(false)} /> : null}
    </div>
  );
}

/*
 * The "we couldn't ask" strip.
 *
 * Shown when the session probe could not be answered — deliberately not a
 * login page, because the reader has done nothing wrong and their cookie may
 * well be perfectly alive. It says what is missing, offers the retry, and
 * otherwise leaves the page alone: a settings screen whose own data loaded
 * fine stays usable underneath.
 */
function SessionNotice({ onRetry, rechecking }: { onRetry: () => void; rechecking: boolean }) {
  const t = useT();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-divider bg-surface-2 px-4 py-2.5 text-[13.5px] text-fg sm:px-6"
    >
      <WifiOff className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {t("Tirbeo isn't answering right now, so some of your settings may not have loaded.")}
      </span>
      <Button variant="secondary" size="sm" onClick={onRetry} disabled={rechecking}>
        {rechecking ? t("Checking…") : t("Try again")}
      </Button>
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[22rem] flex-col border-r border-divider bg-rail backdrop-blur-2xl backdrop-saturate-150 lg:flex">
      <div className="px-5 pt-7 pb-4">
        <Wordmark />
        <AccountChip />
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
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-danger px-3.5 text-[14px] font-semibold text-white outline-none transition-colors hover:brightness-110 active:brightness-95"
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
      <span className="text-[24px] leading-none font-bold tracking-[-0.02em] text-fg/45">MyProfile</span>
    </span>
  );
}

/** Whose account this is, always on screen while you work.
    The one place that answers "am I in the right account?" without a click,
    which matters most right after a sign-out — so it reads the profile the
    same way every page does, and the blank it shows while waiting is a blank
    for *this* account rather than the last one's name. */
function AccountChip() {
  const profile = useProfile();
  const t = useT();
  if (!profile) {
    return (
      <div className="mt-4 flex items-center gap-3 px-1" aria-busy="true">
        <span className="size-9 shrink-0 animate-pulse rounded-full bg-surface-2" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block h-[12px] w-[55%] animate-pulse rounded-full bg-surface-2" />
          <span className="block h-[11px] w-[78%] animate-pulse rounded-full bg-surface-2/70" />
        </span>
      </div>
    );
  }
  const name = displayName(profile) || profile.username || profile.email;
  const role = t("Signed-in account");
  return (
    <Link
      href="/settings/edit-profile"
      aria-label={`${role}: ${name}`}
      onClick={() => haptic("light")}
      className="mt-4 flex w-full items-center gap-3 rounded-xl px-1 py-1 outline-none transition-colors hover:bg-surface-2/60 active:bg-surface-2/80"
    >
      <ProfilePicture
        photo={profile.photo}
        seed={profile.username || profile.email}
        name={name}
        size={36}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] leading-tight font-semibold">{name}</span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-muted">{profile.email}</span>
      </span>
    </Link>
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
            /* Revoke server session + cookies, then land on the accounts
               login — the app that owns the cookie. */
            endSessionAndLeave();
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
          <p className="px-3.5 pt-2 pb-2 text-[13px] font-semibold text-muted">
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
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14.5px] outline-none transition-colors",
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
