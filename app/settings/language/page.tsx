"use client";

import { useState } from "react";

import { SearchField } from "@/components/ig-ui";
import {
  Group,
  Helper,
  OptionRow,
  PageSkeleton,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { LANGS, useLanguage, type Lang } from "@/lib/language";
import { formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Language — the one question Instagram asks here: which language the
   app speaks. A plain list, each name written in its own script, one
   radio circle. Nothing else: no formats, no translation switches.

   The choice is device-local. The words the app says constantly come from
   lib/i18n, which answers in the language chosen here; everything else on
   screen — the body copy, the guides — is translated by
   lib/machine-translate, which caches its answers on the device so the
   second visit to a page is ready on the first paint. Dates, times and
   "how long ago" go through the browser's own formatting engine.
   ═══════════════════════════════════════════════════════════════════ */

const MIN_QUERY = 2;

export default function LanguagePage() {
  const { id, lang, choose } = useLanguage();
  const toast = useToast();
  const [query, setQuery] = useState("");

  if (!id) return <PageSkeleton title="Language" sections={2} />;

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY;
  const needle = fold(trimmed);
  const matches = searching
    ? LANGS.filter((l) => fold(l.endonym).includes(needle) || fold(l.english).includes(needle))
    : LANGS;

  function pick(next: Lang) {
    if (next.id === id) return;
    choose(next.id);
    toast.info(`Tirbeo now speaks ${next.endonym}`);
  }

  return (
    <SettingsPage title="Language">
      {/* Proof the setting reached the rest of the app, rather than just
          being remembered by this page. */}
      <Helper lead>
        Every word on every page switches to {lang.endonym} — the names, the
        settings, the guides — and dates are written in it too, like{" "}
        {formatStamp(Date.now())}.
      </Helper>

      <div className="mb-4 mt-6">
        <SearchField value={query} onChange={setQuery} placeholder="Search languages" />
      </div>

      {matches.length ? (
        /* A language list whose own entries were translated would be useless:
           "Deutsch" is only findable while it says Deutsch. */
        <div data-no-translate>
          <Group label="Language">
            {matches.map((l) => (
              <OptionRow
                key={l.id}
                title={l.endonym}
                sub={l.endonym.toLowerCase() === l.english.toLowerCase() ? undefined : l.english}
                label={l.english}
                selected={l.id === id}
                onSelect={() => pick(l)}
              />
            ))}
          </Group>
        </div>
      ) : (
        <Group>
          <StaticRow
            title={`No language matches “${trimmed}”`}
          />
        </Group>
      )}
    </SettingsPage>
  );
}

/** Case-, accent- and script-insensitive so "espanol" finds Español. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
