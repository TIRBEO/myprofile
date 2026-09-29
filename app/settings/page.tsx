"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, SearchX } from "lucide-react";
import { SearchField } from "@/components/ig-ui";
import { SignOutSheet } from "@/components/settings-layout";
import { ActionRow, LinkRow, Panel, SettingsPage } from "@/components/settings-shell";
import { NAV_GROUPS, searchNav } from "@/lib/nav";
import { useLanguage } from "@/lib/language";
import { englishFor, useT } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   The hub.

   The way a phone app draws its own settings: a title bar, a search box,
   then one column of rows from edge to edge — a mark, a word, a chevron —
   divided by nothing but a hairline. Groups are named by a line of text
   inside the same column, not by a box around it, because a rounded panel
   turns a list of ways out into a shelf of objects.

   Once the screen is wide enough for the rail, the rail is this list — so
   the page stops repeating it and opens the first real setting instead.
   ═══════════════════════════════════════════════════════════════════ */

export default function SettingsIndex() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [signOut, setSignOut] = useState(false);
  const { lang } = useLanguage();
  const t = useT();

  /* On a wide screen the rail already is this list and its foot already holds
     the sign-out, so the page would be an empty column with one row in it.
     It opens the first real setting instead. */
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      router.replace("/settings/edit-profile");
    }
  }, [router]);

  const trimmed = query.trim();
  /** Searching replaces the grouped list with a ranked one: once you've typed,
      you want the best match first, not the section it happens to belong to.
      Nothing matching every word still shows the closest ones rather than a
      dead end — you can see what the machine heard. */
  const hits = trimmed ? searchNav(englishFor(trimmed)) : null;
  const full = hits ? hits.filter((hit) => hit.exact) : null;
  const shown = hits ? (full?.length ? full : hits) : null;

  return (
    <SettingsPage>
      <div className="-mx-4 sm:-mx-6 lg:hidden">
        <div className="sticky top-0 z-20 -mt-4 border-b border-divider bg-bg/92 px-4 py-3.5 backdrop-blur-md sm:-mt-9 sm:px-6">
          <h1 className="text-center text-[16.5px] font-bold tracking-[-0.015em]">{t("Settings")}</h1>
        </div>

        <div className="px-4 pt-3.5 pb-1 sm:px-6">
          {/* The same pill the rest of the app searches from, at the height a
              thumb actually aims at. */}
          <div className="[&_input]:h-12 [&_input]:rounded-full [&_input]:border-transparent [&_input]:bg-surface-2">
            <SearchField value={query} onChange={setQuery} placeholder={t("Search settings")} />
          </div>
        </div>

        {/* The boxes sit back inside the gutter the sticky bar and the search
            pill deliberately break. */}
        <div className="space-y-7 px-4 pt-1 pb-2 sm:px-5">
          {shown ? (
            shown.length ? (
              <Panel
                compact
                title={`${shown.length} ${shown.length === 1 ? "match" : "matches"}${
                  full?.length ? ` for “${trimmed}”` : ` — nothing matches every word in “${trimmed}”`
                }`}
              >
                {shown.map(({ item }) => (
                  <LinkRow
                    key={item.href}
                    href={item.href}
                    compact
                    icon={<item.icon strokeWidth={1.9} />}
                    title={t(item.label)}
                    sub={item.description}
                  />
                ))}
              </Panel>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <SearchX className="size-7 text-muted" strokeWidth={1.8} />
                <p className="text-[15px] font-medium">Nothing matches “{trimmed}”</p>
                <p className="text-[13px] text-muted">
                  Try a shorter word — “dev” finds Devices, “two factor” finds two-factor
                  authentication.
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-2 min-h-10 rounded-full bg-surface-3 px-4 py-2 text-[13.5px] font-semibold text-fg outline-none transition-colors hover:brightness-110 active:brightness-95"
                >
                  Clear search
                </button>
              </div>
            )
          ) : (
            <>
              {NAV_GROUPS.map((group) => (
                <Panel key={group.id} compact title={t(group.title)}>
                  {group.items.map((item) => (
                    <LinkRow
                      key={item.href}
                      href={item.href}
                      compact
                      icon={<item.icon strokeWidth={1.9} />}
                      title={t(item.label)}
                      sub={item.description}
                      /* The one entry here that can say what it's set to without
                         opening, because it's in use on every other page. */
                      right={item.href === "/settings/language" ? lang.endonym : undefined}
                    />
                  ))}
                </Panel>
              ))}
              <Panel compact title={t("Session")}>
                <ActionRow
                  danger
                  icon={<LogOut strokeWidth={1.9} />}
                  title={t("Log out")}
                  opens={false}
                  onClick={() => setSignOut(true)}
                />
              </Panel>
            </>
          )}
        </div>
      </div>

      {signOut ? <SignOutSheet onClose={() => setSignOut(false)} /> : null}
    </SettingsPage>
  );
}
