"use client";

/* ═══════════════════════════════════════════════════════════════════
   Translating what is actually on screen

   lib/i18n carries the few dozen words the app says constantly — page
   names, headings, the controls on every screen. Those are hand-written,
   because they appear on the first paint and a machine substitution there
   would be a visible delay on the thing the user came to read.

   Everything else is thousands of sentences: body copy, forty-odd guide
   articles, every helper line under every row. No one writes those by hand
   in fifteen languages. This module watches the rendered page instead, and
   asks a public translation service for the sentences it finds, one phrase
   at a time, with three rules:

     1. never touch a phrase lib/i18n already answered — that would be
        translating a translation;
     2. never touch anything inside [data-no-translate] — language names,
        code samples, an email address you typed;
     3. never touch a node twice — what we wrote is tracked, so a re-render
        of the same English goes back to the same answer and the page stops
        moving under you.

   The answers are cached on the device, per language, so a page is
   translated once and every later visit paints ready in the local language.
   Switching back to English puts the original text nodes back.

   It rewrites the words — the text nodes, and the three attributes a screen
   reader or an empty search box reads out — and nothing else: no HTML, no
   layout, so the translated page is the same page, in other words.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { isCurated } from "@/lib/i18n";
import { readLanguageId, subscribeLanguage } from "@/lib/language";

const SOURCE = "en";

/** Phrases translated per pass; the rest are picked up by the next one, so a
    long article never blocks on two hundred requests at once. */
const PER_RUN = 120;
/** Requests in flight at any moment. Free translation endpoints are
    rate-limited per IP, so this stays deliberately small. */
const IN_FLIGHT = 4;
/** Entries kept per language before the oldest fall out of the cache. */
const CACHE_LIMIT = 4000;
/** A paragraph longer than this is sent in pieces — the smaller engine
    refuses anything over 500 characters. */
const MAX_CHUNK = 440;
/** When the page is first looked at, and once more after it has settled. The
    component's own effect already waits for hydration; these are for the
    content a page is still streaming in at that point. */
const FIRST_PASS = 300;
const SETTLE_PASS = 2200;

/* The scripts Intl writes dates and "how long ago" in for the languages whose
   alphabet isn't ours. A row like "Active कल" is half the browser's own
   translation and half this app's English, and sending the whole of it to a
   translation engine makes it guess at both — so these tell the pass which
   half to leave alone. */
const SCRIPTS: Record<string, RegExp> = {
  ar: /[\u0600-\u06FF]/,
  hi: /[\u0900-\u097F]/,
  ja: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  ko: /[\uAC00-\uD7AF]/,
  ru: /[\u0400-\u04FF]/,
  zh: /[\u4E00-\u9FFF]/,
};

const NEVER =
  "script,style,noscript,textarea,select,code,samp,var,abbr,bdi,iframe,canvas,[data-no-translate]";

const storeKey = (id: string) => `tirbeo:mt:v3:${id}`;

/* A device that visited before the phrasing of a pass changed is holding
   answers built the old way; they're thrown away rather than trusted. */
let pruned = false;

function dropOldCaches() {
  if (pruned) return;
  pruned = true;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("tirbeo:mt:") && !key.startsWith("tirbeo:mt:v3:")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* nothing to read, nothing to drop */
  }
}

function loadCache(id: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(storeKey(id));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return new Map(Object.entries(parsed as Record<string, string>));
    }
  } catch {
    /* A corrupt cache is just an untranslated page — nothing to report. */
  }
  return new Map();
}

function saveCache(id: string, cache: Map<string, string>) {
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(Object.fromEntries(cache)));
  } catch {
    /* Private mode, or a full store. The page still translates; it just
       has to ask again next time. */
  }
}

/* What this component wrote, so a later pass can tell our words from the
   app's. React re-uses these nodes and elements across renders, which is why
   the maps key on them rather than on their contents. */
const appliedNodes = new Map<Text, { from: string; to: string }>();
const appliedAttrs = new Map<Element, Map<string, string>>();

/* The attributes whose words are read out on the page — a placeholder is the
   only thing inside an empty search box, and a label is all a bare icon
   button ever says to a screen reader. */
const VISIBLE_ATTRS = ["placeholder", "aria-label", "title"] as const;

/** One place words are written: a text node, or an attribute on an element. */
type Target = {
  /** The English this is standing for. */
  text: string;
  /** Does it still say that, right now? */
  awaiting: () => boolean;
  put: (translated: string) => void;
};

/* ── finding the words ─────────────────────────────────────────────── */

/** Is this English worth asking about at all? */
function worthTranslating(id: string, text: string): boolean {
  if (text.length < 2) return false;
  /* Nothing to translate in a number, a date, an email or a row of dots —
     and a service asked to translate one will only give back noise. */
  if (!/[A-Za-z\u00C0-\u024F]/.test(text)) return false;
  /* A handle, an email or a link is an identifier the listener typed;
     translating it changes what it points at. */
  if (text.startsWith("@") || /@|:\/\/|\.com\b|\.app\b/i.test(text)) return false;
  if (/^[^\s]+\s*$/.test(text) && /\d/.test(text) && text.length < 24) return false;
  return !isCurated(id, text);
}

/** Has React finished claiming this element yet?
    Rewriting the server's markup before hydration reaches it makes React
    throw the whole tree away and render again — a flash on screen and a
    hydration error in the console — so words wait until it's owned. */
function hydrated(el: Element): boolean {
  return Object.keys(el).some((key) => key.startsWith("__reactFiber$"));
}

function candidate(node: Text, id: string): string | null {
  const raw = node.nodeValue ?? "";
  const text = raw.trim();
  if (!worthTranslating(id, text)) return null;
  const previous = appliedNodes.get(node);
  if (previous && previous.to === raw) return null;
  const parent = node.parentElement;
  if (!parent || parent.closest(NEVER)) return null;
  if (!hydrated(parent)) return null;
  return text;
}

function attrCandidate(el: Element, attr: string, id: string): string | null {
  const value = el.getAttribute(attr);
  if (!value) return null;
  const text = value.trim();
  if (!worthTranslating(id, text)) return null;
  const original = appliedAttrs.get(el)?.get(attr);
  if (original !== undefined && original !== value) return null;
  if (el.closest(NEVER)) return null;
  if (!hydrated(el)) return null;
  return text;
}

function collect(id: string): Target[] {
  const found: Target[] = [];
  if (typeof document === "undefined") return found;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = candidate(node as Text, id);
      if (text) {
        const target = node as Text;
        found.push({ text, awaiting: () => candidate(target, id) === text, put: (t) => write(target, text, t) });
      }
      /* A text node has no children, so rejecting it costs nothing. */
      return NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) {
    /* The filter does the work and pushes as it goes. */
  }

  for (const attr of VISIBLE_ATTRS) {
    for (const el of Array.from(document.body.querySelectorAll(`[${attr}]`))) {
      const text = attrCandidate(el, attr, id);
      if (!text) continue;
      found.push({
        text,
        awaiting: () => attrCandidate(el, attr, id) === text,
        put: (t) => writeAttr(el, attr, text, t),
      });
    }
  }
  return found;
}

/** Leading and trailing whitespace is the markup's, not the sentence's —
    React put it there to separate words, and swallowing it changes how two
    spans sit against each other. */
function write(node: Text, from: string, translated: string) {
  const raw = node.nodeValue ?? "";
  const lead = raw.slice(0, raw.length - raw.trimStart().length);
  const trail = raw.slice(raw.trimEnd().length);
  const next = `${lead}${translated}${trail}`;
  node.nodeValue = next;
  appliedNodes.set(node, { from, to: next });
}

function writeAttr(el: Element, attr: string, from: string, translated: string) {
  const known = appliedAttrs.get(el);
  if (known) {
    if (!known.has(attr)) known.set(attr, from);
  } else {
    appliedAttrs.set(el, new Map([[attr, from]]));
  }
  el.setAttribute(attr, translated);
}

function restoreAll() {
  for (const [node, { from }] of appliedNodes) {
    if (node.isConnected) node.nodeValue = from;
    appliedNodes.delete(node);
  }
  for (const [el, attrs] of appliedAttrs) {
    if (el.isConnected) for (const [attr, from] of attrs) el.setAttribute(attr, from);
    appliedAttrs.delete(el);
  }
}

/* ── asking the service ────────────────────────────────────────────── */

/* Two engines, tried in order. The first is Google's own web endpoint, which
   needs no key and answers from the visitor's browser; the second exists
   because a free endpoint can spend its day at any moment, and a page that
   stops translating is better than a page that shows an error. */
const ENGINES: {
  code: Record<string, string>;
  url: (piece: string, code: string) => string;
  read: (body: unknown) => string | null;
}[] = [
  {
    code: { "pt-br": "pt", zh: "zh-CN" },
    /* The answer is a list of segments — the sentence split up by the
       engine's own sentence detection — each with its source beside it. */
    url: (piece, code) =>
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${SOURCE}&tl=${code}&dt=t&q=${encodeURIComponent(
        piece,
      )}`,
    read: (body) => {
      const segments = (body as unknown[])?.[0];
      if (!Array.isArray(segments)) return null;
      const text = segments
        .map((segment) => (Array.isArray(segment) ? segment[0] : null))
        .filter((part): part is string => typeof part === "string")
        .join("");
      return text.trim() || null;
    },
  },
  {
    code: { zh: "zh-cn" },
    url: (piece, code) =>
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(piece)}&langpair=${SOURCE}|${code}`,
    read: (body) => {
      const translated = (body as { responseData?: { translatedText?: unknown } })?.responseData
        ?.translatedText;
      /* Over the daily quota this endpoint answers with a warning where the
         words should be, which must never reach the page. */
      if (typeof translated !== "string" || !translated.trim()) return null;
      if (/MYMEMORY WARNING|UNKNOWN GUESS|QUERY LENGTH/i.test(translated)) return null;
      /* It hands back HTML entities; leaving them in puts "&quot;" on screen. */
      return unescape(translated).trim();
    },
  },
];

/** The code one engine wants for one of our language ids. */
function codeFor(engine: (typeof ENGINES)[number], id: string): string {
  return engine.code[id] ?? id;
}

async function ask(piece: string, id: string): Promise<string> {
  for (const engine of ENGINES) {
    try {
      const response = await fetch(engine.url(piece, codeFor(engine, id)));
      if (!response.ok) continue;
      const text = engine.read(await response.json());
      if (text) return text;
    } catch {
      /* Offline, blocked, or the JSON isn't what it should be. The next
         engine gets the same chance; then the phrase stays English. */
    }
  }
  return piece;
}

/* One of the two engines answers in HTML entities; leaving them in puts
   "&quot;" on the page. */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function unescape(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith("#")) {
      const num = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : whole;
    }
    return ENTITIES[code] ?? whole;
  });
}

/** Splitting a paragraph mid-sentence loses the thread of it, so cut at
    sentence ends whenever one falls inside the limit. */
function chunks(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHUNK) {
    const window = rest.slice(0, MAX_CHUNK);
    const period = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("; "),
    );
    const cut = period > MAX_CHUNK * 0.4 ? period + 1 : window.lastIndexOf(" ");
    const at = cut > 0 ? cut : MAX_CHUNK;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

const pending = new Map<string, Promise<string>>();

/** Ask about one run of English on its own. */
function phrase(piece: string, id: string): Promise<string> {
  const key = `${id}\u0000${piece}`;
  const known = pending.get(key);
  if (known) return known;
  const request = ask(piece, id).finally(() => {
    /* Forget the promise, not the answer: the answer went to the cache. */
    pending.delete(key);
  });
  pending.set(key, request);
  return request;
}

/* One run of a sentence, and whether it's the app's English or something the
   browser already put into the language the page is set to. */
type Run = { text: string; english: boolean };

const LATIN_RUN = /[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .,'&:!?()%\-]*/g;

/** Cut a half-localised sentence into the parts worth asking about and the
    parts that must go back exactly as they came. `null` — nothing in this
    phrase is already in the target's own script — means send it whole. */
function mixed(text: string, id: string): Run[] | null {
  const script = SCRIPTS[id];
  if (!script || !script.test(text)) return null;
  const runs: Run[] = [];
  let at = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index ?? 0;
    if (start > at) runs.push({ text: text.slice(at, start), english: false });
    /* A lone letter or a pair of initials isn't a sentence fragment; it's a
       name, an abbreviation, or the "B" of a date. Leave it. */
    runs.push({ text: match[0], english: /[A-Za-z\u00C0-\u024F]{2,}/.test(match[0]) });
    at = start + match[0].length;
  }
  if (at < text.length) runs.push({ text: text.slice(at), english: false });
  return runs;
}

function say(run: Run, id: string): Promise<string> {
  if (!run.english) return Promise.resolve(run.text);
  const lead = run.text.slice(0, run.text.length - run.text.trimStart().length);
  const trail = run.text.slice(run.text.trimEnd().length);
  return phrase(run.text.trim(), id).then((spoken) => `${lead}${spoken}${trail}`);
}

/* One promise per phrase, so the same sentence in a table and in a helper
   line costs one request rather than two. */
function translate(text: string, id: string): Promise<string> {
  const key = `${id}\u0000${text}`;
  const known = pending.get(key);
  if (known) return known;

  const runs = mixed(text, id);
  const request = runs
    ? Promise.all(runs.map((run) => say(run, id))).then((parts) => parts.join(""))
    : (() => {
        const pieces = chunks(text);
        return pieces.length === 1
          ? phrase(pieces[0], id)
          : Promise.all(pieces.map((piece) => phrase(piece, id))).then((parts) =>
              parts.join(" "),
            );
      })();

  const settled = request.finally(() => pending.delete(key));
  pending.set(key, settled);
  return settled;
}

/* ── the pass ──────────────────────────────────────────────────────── */

let running: string | null = null;
/* Mutations that landed while a pass was still waiting on requests. React
   repairs the text we replaced as it hydrates the server HTML — so the page
   goes back to English a moment after we finished with it, and that has to be
   noticed rather than dropped on the floor. */
let missed = false;

async function drain(id: string, items: Target[], cache: Map<string, string>) {
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < items.length && done < PER_RUN) {
      const item = items[cursor++];
      done++;
      const translated = await translate(item.text, id);
      cache.set(item.text, translated);
      /* The words may have been unmounted or reset while the request was
         out — a navigation, a closed sheet, React finishing hydration — and
         writing to something that has moved on is how text gets doubled. */
      if (!item.awaiting()) continue;
      pauseWrites(() => item.put(translated));
    }
  }

  await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
  return { done, left: items.length - cursor };
}

/* Our own writes arrive at the observer as mutations; if it reacted to them
   it would schedule a pass that finds nothing, forever. */
let paused = false;
let observer: MutationObserver | null = null;
/** When the page last changed. A pass waits for the DOM to stop moving,
    because a page is still building itself while it streams and hydrates, and
    text rewritten before React has compared that node against the server's is
    a hydration mismatch — React discards the markup and starts again. */
let settledAt = 0;
const QUIET = 900;

function pauseWrites(fn: () => void) {
  paused = true;
  try {
    fn();
  } finally {
    observer?.takeRecords();
    paused = false;
  }
}

async function pass(id: string) {
  if (id === SOURCE) {
    pauseWrites(restoreAll);
    return;
  }
  if (running === id) {
    missed = true;
    return;
  }
  if (performance.now() - settledAt < QUIET) {
    schedule(id, QUIET);
    return;
  }
  running = id;
  try {
    const cache = loadCache(id);
    /* Known phrases go in without a request, so a cached page looks
       translated immediately rather than as requests come back. */
    const warm: Target[] = [];
    const cold: Target[] = [];
    for (const item of collect(id)) (cache.has(item.text) ? warm : cold).push(item);

    pauseWrites(() => {
      for (const item of warm) {
        const hit = cache.get(item.text);
        if (hit) item.put(hit);
      }
    });

    const { left } = await drain(id, cold, cache);
    saveCache(id, cache);
    /* Anything over the per-pass budget is a pending translation, not a
       missed one — the next pass picks it up once these are cached. */
    if (left > 0 || missed) {
      missed = false;
      schedule(id, left > 0 ? 400 : 1200);
    }
  } finally {
    running = null;
  }
}

/* ── scheduling ────────────────────────────────────────────────────── */

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function schedule(id: string, delay = 700) {
  if (id === SOURCE) return;
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void pass(id);
    }, delay),
  );
}

export function stopScheduling() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

/** The words the reader should hear: what the cache has for this phrase in
    the language on screen, or the phrase itself. Used by the narration,
    which speaks from the article's own text rather than from the DOM. */
export function spoken(text: string): string {
  const id = readLanguageId();
  if (id === SOURCE) return text;
  return loadCache(id).get(text) ?? text;
}

/** Mounted once, in the root layout. It renders nothing; its whole job is
    the page it leaves behind. */
export function MachineTranslate() {
  useEffect(() => {
    const id = readLanguageId();
    observer = new MutationObserver(() => {
      if (paused) return;
      settledAt = performance.now();
      schedule(readLanguageId());
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      /* Only the attributes we translate, or every hover's class change
         would wake a pass. */
      ...(VISIBLE_ATTRS.length ? { attributeFilter: [...VISIBLE_ATTRS] } : {}),
    });

    let current = id;
    /* Not immediately: the content a page streamed in hydrates after this
       effect runs, and text rewritten before that comparison is made is a
       hydration mismatch — React throws the tree away and renders again,
       which is a flash on screen and an error in the console. */
    if (current !== SOURCE) schedule(current, FIRST_PASS);

    /* Hydrating an element is what makes it eligible, and a page that takes
       its time about it would otherwise never be looked at again — React
       keeps the server's DOM when it agrees, so there is no mutation to
       notice. One more pass once things have settled covers it. */
    const settle = setTimeout(() => schedule(readLanguageId(), 0), SETTLE_PASS);

    const unsubscribe = subscribeLanguage(() => {
      const next = readLanguageId();
      if (next === current) return;
      if (current !== SOURCE) pauseWrites(restoreAll);
      else restoreAll();
      current = next;
      if (next === SOURCE) stopScheduling();
      else void pass(next);
    });

    return () => {
      clearTimeout(settle);
      unsubscribe();
      observer?.disconnect();
      observer = null;
      stopScheduling();
      pauseWrites(restoreAll);
    };
    /* A language switch is broadcast, not a prop, so this runs once. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
