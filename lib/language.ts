"use client";

/* ── Language ──────────────────────────────────────────────────────
   One choice, written by the Language page and read by the rest of the
   app. It is stored as a code — "hi", "pt-br" — because that's what the
   browser's own formatting engines take, and it goes on <html lang> so
   the page is announced, spell-checked and hyphenated in the right
   language even before React paints.

   What that buys, concretely: every date, time and "how long ago" in the
   app is produced by Intl, which ships the world's calendars, month
   names and digits — so switching to Hindi writes "12 मिनट पहले" and
   switching to Arabic counts in ١٢, everywhere, with nothing translated
   by hand here. The words of the interface itself — every page name,
   heading and control — come from lib/i18n, which answers in the language
   chosen here and falls back to English for whatever it doesn't have.

   Direction is deliberately not switched. Arabic and Hebrew would want
   <dir="rtl">, but the sheets, rails and paddings in this app are written
   left/right rather than start/end, so flipping the document would leave
   every chevron pointing into the wrong margin. RTL is a pass over the
   layout, not an attribute.                                            */

import { useCallback, useEffect, useState } from "react";
import { read, write } from "@/lib/prefs";
import { reloadSettings } from "@/lib/remote-store";
import { usePageRefresh } from "@/lib/page-refresh";

export const LANGUAGE_KEY = "tirbeo:language";

export type Lang = {
  /** The value written to the store. */
  id: string;
  /** Endonym — the language written in its own script. */
  endonym: string;
  /** English name, for the sub-line and for searching in English. */
  english: string;
};

/** What the store holds. An object, because the data archive reads saved
    choices as key/value pairs rather than as bare strings. */
type LanguagePrefs = { interface: string };

const DEFAULTS: LanguagePrefs = { interface: "en" };

export const LANGS: Lang[] = [
  { id: "en", endonym: "English", english: "English" },
  { id: "es", endonym: "Español", english: "Spanish" },
  { id: "pt-br", endonym: "Português (Brasil)", english: "Portuguese (Brazil)" },
  { id: "fr", endonym: "Français", english: "French" },
  { id: "de", endonym: "Deutsch", english: "German" },
  { id: "it", endonym: "Italiano", english: "Italian" },
  { id: "nl", endonym: "Nederlands", english: "Dutch" },
  { id: "tr", endonym: "Türkçe", english: "Turkish" },
  { id: "ar", endonym: "العربية", english: "Arabic" },
  { id: "hi", endonym: "हिन्दी", english: "Hindi" },
  { id: "id", endonym: "Bahasa Indonesia", english: "Indonesian" },
  { id: "ru", endonym: "Русский", english: "Russian" },
  { id: "vi", endonym: "Tiếng Việt", english: "Vietnamese" },
  { id: "ja", endonym: "日本語", english: "Japanese" },
  { id: "ko", endonym: "한국어", english: "Korean" },
  { id: "zh", endonym: "中文", english: "Chinese" },
];

const BY_ID = new Map(LANGS.map((lang) => [lang.id, lang]));

export const DEFAULT_LANG = LANGS[0];

export function langFor(id: string | null | undefined): Lang {
  return (id && BY_ID.get(id)) || DEFAULT_LANG;
}

/** The code <html lang> and Intl want, which is the store id save for the
    one entry that carries a region. */
export function localeFor(id: string): string {
  return id === "pt-br" ? "pt-BR" : id;
}

/* The locale the rest of the app formats with — used by lib/dates. Read
   once and held, because every row on a log asks for it.

   It starts as the server's own default and only becomes the stored choice
   after hydration (components/language-provider): the server has no
   localStorage, so a page that formats "27 sept. 2026" on the client's very
   first render is text React compared against "Sep 27, 2026" and threw away. */
let locale = localeFor(DEFAULT_LANG.id);

export function appLocale(): string {
  return locale;
}

/** Points every formatter at `id` for the renders that follow. */
export function setAppLocale(id: string) {
  locale = localeFor(id);
}

export function readLanguageId(): string {
  return read(LANGUAGE_KEY, DEFAULTS).interface;
}

/** Writes the choice and puts it on the document, so the next render of
    anything formatted with Intl picks it up. */
export function applyLanguage(id: string) {
  if (typeof document === "undefined") return;
  write(LANGUAGE_KEY, { interface: id } satisfies LanguagePrefs);
  setAppLocale(id);
  document.documentElement.setAttribute("lang", localeFor(id));
  notify();
}

/* The one place the choice is broadcast, so the whole app can follow a switch
   made on a single page. Without this, the Language page would be the only
   thing that changed colour, and the rest would wait for a reload. */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The reactive half: `null` until the store has been read, so the page can
    wait rather than flash English and then correct itself. */
export function useLanguage() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(readLanguageId());
  }, []);

  const choose = useCallback((next: string) => {
    applyLanguage(next);
    setId(next);
  }, []);

  // The choice lives on the account bag; a pull-to-refresh asks the account
  // again and re-reads the resolved id when the bag lands.
  usePageRefresh(async () => {
    await reloadSettings();
    setId(readLanguageId());
  });

  return { id, lang: langFor(id), choose };
}

/** The name a human would recognise, for anywhere the code has to be shown. */
export function languageName(id: string): string {
  return langFor(id).endonym;
}

/** Inlined in <head> so the language is right on the very first paint. */
export const LANGUAGE_BOOT = `(function(){try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(
  LANGUAGE_KEY,
)}));var id=v&&v.interface;if(id)document.documentElement.setAttribute("lang",id==="pt-br"?"pt-BR":id);}catch(e){}})();`;
