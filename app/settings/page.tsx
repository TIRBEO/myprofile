"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, SearchX } from "lucide-react";
import { Button, SearchField } from "@/components/ig-ui";
import { SignOutSheet } from "@/components/settings-layout";
import { ActionRow, Group, Helper, LinkRow, SettingsPage } from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import { RowsSkeleton } from "@/components/page-loading";
import { NAV_GROUPS, searchNav } from "@/lib/nav";
import { LANGUAGE_KEY, useLanguage } from "@/lib/language";
import { THEME_KEY } from "@/lib/theme";
import { englishFor, useT } from "@/lib/i18n";
import { useProfile, displayName } from "@/lib/profile";
import { readEmailPrefs } from "@/lib/notification-prefs";
import { failedWrites, retryWrites, subscribePersistFailures, subscribeSettings } from "@/lib/remote-store";
import { useTwoFactorState } from "@/lib/two-factor";
import { haptic } from "@/lib/haptics";
import { trackError } from "@/lib/telemetry";

/* ═══════════════════════════════════════════════════════════════════
   The hub.

   The way a phone app draws its own settings: your account at the top,
   a search box, then one column of rows from edge to edge — a mark, a
   word, a chevron — divided by nothing but a hairline. Groups are named
   by a line of text above the column, not by a title welded to a form.

   The hub is a phone screen. Once the viewport is wide enough for the
   rail — the same lg width at which the shell starts showing it — the
   list is redundant: the rail *is* the index. So on those screens this
   page hands the visitor to the first real section instead of drawing.

   The two rows that can answer without being opened — two-factor and
   email — answer from the account. Until the account has answered, they
   show nothing, because a guessed "Off" is a fact this app does not have.
   ═══════════════════════════════════════════════════════════════════ */

/** What a row is already set to, printed before its chevron. */
function badgeFor(href: string, values: Record<string, string | undefined>): string | undefined {
  return values[href];
}

/* A refused settings write rolls back to the account's answer on the page
   that took the tap — but the person reads the hub after the toast faded,
   so this is where the switch that didn't stick has to be named. Keys are
   the bag's; unknown ones keep their machine name rather than vanishing
   behind a generic line. */
const CONTROL_NAMES: Record<string, string> = {
  saveLoginInfo: "Saved login info",
  require2FA: "Require 2FA for sensitive actions",
  twoFactorRequireForActions: "Require 2FA for sensitive actions",
  twoFactorAlertSuspicious: "Alert on suspicious sign-in",
  [THEME_KEY]: "Theme",
  [LANGUAGE_KEY]: "Language",
};
function controlName(key: string): string {
  return CONTROL_NAMES[key] ?? key.replace(/^tirbeo:/, "");
}

/** Where a wide screen is sent instead of the hub — the first real section
    in the rail, so /settings always lands somewhere that exists. */
const WIDE_HOME = NAV_GROUPS[0].items[0].href;
/** The width at which settings-layout mounts the SideRail (`hidden lg:flex`
    at Tailwind's 64rem). The redirect has to fire at exactly this width:
    bounce earlier and the visitor is on edit-profile with no rail to jump
    back with, bounce later and the hub is being indexed twice. */
const WIDE_QUERY = "(min-width: 64rem)";

export default function SettingsIndex() {
  const [query, setQuery] = useState("");
  const [signOut, setSignOut] = useState(false);
  const [wide, setWide] = useState(false);
  const router = useRouter();
  const { lang } = useLanguage();
  const t = useT();
  const profile = useProfile();
  const { state: twoFactor } = useTwoFactorState();
  const [emailPaused, setEmailPaused] = useState<boolean | null>(null);
  /* "The account wouldn't answer" is not the same fact as "email is on",
     and hiding the badge pretends there is nothing to see: a failed read
     keeps the badge blank AND says so beside a working retry. */
  const [emailFailed, setEmailFailed] = useState(false);
  const [emailNonce, setEmailNonce] = useState(0);
  /* The controls the account refused, named — see CONTROL_NAMES. The queue
     is the store's own; the banner is its voice. */
  const [stuck, setStuck] = useState<string[] | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (wide) router.replace(WIDE_HOME);
  }, [wide, router]);

  useEffect(() => {
    let live = true;
    setEmailFailed(false);
    readEmailPrefs()
      .then((prefs) => {
        if (live) setEmailPaused(prefs.emailPaused === true);
      })
      .catch((err) => {
        trackError("settings.hub.read-email-prefs", err);
        if (live) {
          setEmailPaused(null);
          setEmailFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, [emailNonce]);

  /* The store reports every write the account refused; the queue is the
     truth of what still hasn't landed. Rollbacks and adopts emit on the
     settings channel too, so the banner tracks the queue rather than
     remembering a snapshot — and clears itself when the queue empties. */
  useEffect(() => {
    const sync = () => {
      const names = failedWrites().map((failure) => controlName(failure.key));
      setStuck(names.length ? names : null);
    };
    sync(); // a refusal from another page, earlier this session, still queued
    const unsubscribeSettings = subscribeSettings(sync);
    const unsubscribeFailures = subscribePersistFailures(sync);
    return () => {
      unsubscribeSettings();
      unsubscribeFailures();
    };
  }, []);

  async function retryStuck() {
    if (retrying) return;
    setRetrying(true);
    try {
      // Re-sends exactly the refused values; a retry that fails again
      // re-queues, so the banner stays with the names rather than vanishing.
      await retryWrites();
      const left = failedWrites().map((failure) => controlName(failure.key));
      setStuck(left.length ? left : null);
    } finally {
      setRetrying(false);
    }
  }

  // A wide screen is mid-redirect: draw nothing rather than flash the list
  // the rail already replaces.
  if (wide) return null;

  const trimmed = query.trim();
  /* Searching replaces the grouped list with a ranked one: once you have typed,
     you want the best match first, not the section it happens to belong to.
     Nothing matching every word still shows the closest ones rather than a dead
     end — you can see what the machine heard. */
  const hits = trimmed ? searchNav(englishFor(trimmed)) : null;
  const full = hits ? hits.filter((hit) => hit.exact) : null;
  const shown = hits ? (full?.length ? full : hits) : null;

  const values: Record<string, string | undefined> = {
    "/settings/language": lang.endonym,
    "/settings/two-factor": twoFactor ? (twoFactor.authenticator ? t("On") : t("Off")) : undefined,
    "/settings/notifications": emailPaused === null ? undefined : emailPaused ? t("Paused") : t("On"),
  };

  return (
    <SettingsPage>
      <div className="-mx-4 sm:-mx-6">
        <div className="glass-bar sticky top-0 z-30 -mt-4 border-b border-hairline py-2.5 sm:-mt-9">
          <h1 className="text-center text-[16px] font-semibold tracking-[-0.01em]">{t("Settings")}</h1>
        </div>

        {/* Your account, first — the settings screen belongs to somebody, and
            which somebody is the first thing a phone app says. */}
        <AccountHeader profile={profile} />

        <div className="px-4 pt-3.5 pb-1 sm:px-6">
          {/* The same pill the rest of the app searches from, at the height a
              thumb actually aims at. */}
          <div className="[&_input]:h-12 [&_input]:rounded-full [&_input]:border-border [&_input]:bg-field">
            <SearchField value={query} onChange={setQuery} placeholder={t("Search settings")} />
          </div>
        </div>

        {/* The things that didn't stick, named — a switch silently returning
            to the account's answer is indistinguishable from one nobody
            touched unless the hub says so. */}
        {stuck ? (
          <div className="px-4 pt-2 sm:px-5" role="status">
            <Helper tone="danger">
              {`${stuck.join(", ")} ${stuck.length === 1 ? "didn’t save" : "didn’t save"} — your account is holding its own answer, not what you tapped. `}
              <button
                type="button"
                className="font-semibold underline disabled:opacity-60"
                onClick={retryStuck}
                disabled={retrying}
              >
                {retrying ? "Trying…" : "Try again"}
              </button>
              .
            </Helper>
          </div>
        ) : null}

        {emailFailed ? (
          <div className="px-4 pt-2 sm:px-5" role="status">
            <Helper tone="danger">
              {`Your email notification settings couldn’t be read, so that row shows no badge — that’s the app not answering, not a switch that’s off. `}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setEmailNonce((n) => n + 1)}
              >
                Try again
              </button>
              .
            </Helper>
          </div>
        ) : null}

        {/* The lists sit back inside the gutter the sticky bar, the account row
            and the search pill deliberately break. */}
        <div className="px-4 pt-1 pb-2 sm:px-5">
          {shown ? (
            shown.length ? (
              <Group>
                <p className="px-4 pt-3 pb-1 text-[13px] font-semibold text-muted sm:px-5">
                  {`${shown.length} ${shown.length === 1 ? t("match") : t("matches")}${
                    full?.length ? ` for “${trimmed}”` : ` — ${t("nothing matches every word in")} “${trimmed}”`
                  }`}
                </p>
                {shown.map(({ item }) => (
                  <LinkRow
                    key={item.href}
                    href={item.href}
                    compact
                    icon={<item.icon strokeWidth={1.9} />}
                    title={t(item.label)}
                    sub={item.description}
                    right={badgeFor(item.href, values)}
                  />
                ))}
              </Group>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <SearchX className="size-7 text-muted" strokeWidth={1.8} />
                <p className="text-[15px] font-medium">{`${t("Nothing matches")} “${trimmed}”`}</p>
                <p className="text-[13px] text-muted">
                  {t("Try a shorter word — “dev” finds Devices, “two factor” finds two-factor authentication.")}
                </p>
                <Button variant="ghost" className="mt-2" onClick={() => setQuery("")}>
                  {t("Clear search")}
                </Button>
              </div>
            )
          ) : (
            <>
              {NAV_GROUPS.map((group) => (
                <section key={group.id} className="mt-7 first:mt-2">
                  <h2 className="mb-1 px-4 text-[13.5px] font-semibold tracking-[0.01em] text-muted sm:px-5">
                    {t(group.title)}
                  </h2>
                  <Group>
                    {group.items.map((item) => (
                      <LinkRow
                        key={item.href}
                        href={item.href}
                        compact
                        icon={<item.icon strokeWidth={1.9} />}
                        title={t(item.label)}
                        sub={item.description}
                        right={badgeFor(item.href, values)}
                      />
                    ))}
                  </Group>
                </section>
              ))}
              <section className="mt-7">
                <h2 className="mb-1 px-4 text-[13.5px] font-semibold tracking-[0.01em] text-muted sm:px-5">
                  {t("Session")}
                </h2>
                <Group>
                  <ActionRow
                    danger
                    icon={<LogOut strokeWidth={1.9} />}
                    title={t("Log out")}
                    opens={false}
                    onClick={() => setSignOut(true)}
                  />
                </Group>
              </section>
            </>
          )}
        </div>
      </div>

      {signOut ? <SignOutSheet onClose={() => setSignOut(false)} /> : null}
    </SettingsPage>
  );
}

/** The account row before the account is known: the same shape it will settle
    into, so nothing jumps when the answer arrives. */
function AccountHeader({ profile }: { profile: ReturnType<typeof useProfile> }) {
  const t = useT();
  if (!profile) {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 sm:mx-6" aria-busy="true">
        <span className="skeleton size-[58px] shrink-0 rounded-full" />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="skeleton block h-[16px] w-[46%] rounded-full" />
          <span className="skeleton block h-[13px] w-[30%] rounded-full" />
        </span>
      </div>
    );
  }
  const name = displayName(profile) || profile.email;
  return (
    <Link
      href="/settings/edit-profile"
      onClick={() => haptic("light")}
      className="mx-4 mt-4 flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 outline-none transition-colors hover:border-border-strong hover:bg-field-focus active:bg-field-focus sm:mx-6"
    >
      <ProfilePicture photo={profile.photo} seed={profile.username || profile.email} name={name} size={58} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold tracking-[-0.01em]">{name}</span>
        {profile.username ? (
          <span className="mt-0.5 block truncate text-[13.5px] text-muted">@{profile.username}</span>
        ) : (
          <span className="mt-0.5 block truncate text-[13.5px] text-muted">{profile.email}</span>
        )}
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-accent-text">{t("Edit")}</span>
    </Link>
  );
}
