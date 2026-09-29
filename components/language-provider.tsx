"use client";

/* ── Whose calendar ─────────────────────────────────────────────────
   The server has no localStorage, so it can only write dates in the one
   language it knows. This waits until the page is hydrated, points the
   formatters at the stored language and rebuilds the tree below it — one
   pass when the page arrives, another whenever the choice changes, so a
   log reads "27 sept. 2026" rather than keeping the server's English.

   Rebuilding rather than re-rendering is the point: a date sits in the
   middle of a row's sub-line, and only the component that drew that row
   would ask the formatter again. Everything under the key is drawn fresh. */

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  appLocale,
  localeFor,
  readLanguageId,
  setAppLocale,
  subscribeLanguage,
} from "@/lib/language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  /* The key the tree is drawn under. Bumping it is how the page learns the
     real locale; the first bump is the only one most visits ever get. */
  const [revision, setRevision] = useState(0);
  const formatted = useRef(appLocale());

  useEffect(() => {
    const sync = () => {
      const id = readLanguageId();
      const next = localeFor(id);
      if (next === formatted.current) return;
      formatted.current = next;
      setAppLocale(id);
      setRevision((current) => current + 1);
    };
    sync();
    return subscribeLanguage(sync);
  }, []);

  return <Fragment key={revision}>{children}</Fragment>;
}
