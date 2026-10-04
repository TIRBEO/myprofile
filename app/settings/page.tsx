"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, SearchX } from "lucide-react";
import { Button, SearchField } from "@/components/ig-ui";
import { SignOutSheet } from "@/components/settings-layout";
import { ActionRow, Group, LinkRow, SettingsPage } from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import { RowsSkeleton } from "@/components/page-loading";
import { NAV_GROUPS, searchNav } from "@/lib/nav";
import { useLanguage } from "@/lib/language";
import { englishFor, useT } from "@/lib/i18n";
import { useProfile, displayName } from "@/lib/profile";
import { readEmailPrefs } from "@/lib/notification-prefs";
import { useTwoFactorState } from "@/lib/two-factor";
import { haptic } from "@/lib/haptics";

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
    readEmailPrefs()
      .then((prefs) => {
        if (live) setEmailPaused(prefs.emailPaused === true);
      })
      .catch(() => {
        if (live) setEmailPaused(null);
      });
    return () => {
      live = false;
    };
  }, []);

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
        <div className="sticky top-0 z-30 -mt-4 border-b border-divider bg-bg/85 py-2.5 backdrop-blur-xl sm:-mt-9">
          <h1 className="text-center text-[16px] font-semibold tracking-[-0.01em]">{t("Settings")}</h1>
        </div>

        {/* Your account, first — the settings screen belongs to somebody, and
            which somebody is the first thing a phone app says. */}
        <AccountHeader profile={profile} />

        <div className="px-4 pt-3.5 pb-1 sm:px-6">
          {/* The same pill the rest of the app searches from, at the height a
              thumb actually aims at. */}
          <div className="[&_input]:h-12 [&_input]:rounded-full [&_input]:border-transparent [&_input]:bg-surface-2">
            <SearchField value={query} onChange={setQuery} placeholder={t("Search settings")} />
          </div>
        </div>

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
      <div className="flex items-center gap-3.5 px-4 pt-4 pb-1 sm:px-6" aria-busy="true">
        <span className="size-[58px] shrink-0 animate-pulse rounded-full bg-surface-2" />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="block h-[16px] w-[46%] animate-pulse rounded-full bg-surface-2" />
          <span className="block h-[13px] w-[30%] animate-pulse rounded-full bg-surface-2/80" />
        </span>
      </div>
    );
  }
  const name = displayName(profile) || profile.email;
  return (
    <Link
      href="/settings/edit-profile"
      onClick={() => haptic("light")}
      className="flex items-center gap-3.5 px-4 pt-4 pb-1 outline-none transition-colors hover:bg-surface-2/50 active:bg-surface-2/70 sm:px-6"
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
