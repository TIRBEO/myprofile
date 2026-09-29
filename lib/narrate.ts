"use client";

/* ═══════════════════════════════════════════════════════════════════
   Reading an article out loud

   The browser already has voices in it, and the good ones are the same
   neural voices the paid reading apps put on your invoice: Chrome, Edge,
   Android and iOS all ship them, and they cost nothing to reach. What the
   paid apps actually sell is the picking and the plumbing — so that is what
   this file does.

   Picking: the voice the browser chooses by default is whichever was
   installed first. The ranking below takes only the English voices — the
   articles are written in English and the good free voices are English —
   then prefers a remote (network-backed, i.e. neural) voice from the
   platform's own speech service, then a woman's voice, which carries a
   paragraph far better than the flat default most desktops hand over. The
   result is remembered per browser, and the reader can override it from the
   voice sheet.

   Plumbing: Chrome stops a long utterance dead about fifteen seconds in, so
   a block is spoken one sentence at a time and a keep-alive tick keeps the
   engine awake. Speech also dies silently when the tab isn't focused, and
   nothing starts before a real tap — which is why play() is only ever
   called from a click.

   What gets read is the article's own English, whatever language the page is
   showing: a Hindi page read out by an English voice is worse than a Hindi
   page you read yourself.

   Where a browser has no speech at all, `supported` is false and the page
   leaves the player off rather than showing a control that does nothing.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";

export type NarrationBlock = { id: string; text: string };

/* ── The voices this device actually has ─────────────────────────── */

/* The browser fetches its good voices after the page loads, so the first
   call to getVoices() is often an empty list. One wait, shared, resolves
   either when they arrive or when they clearly aren't coming. */
let loaded: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (loaded) return loaded;
  loaded = new Promise((resolve) => {
    const engine = window.speechSynthesis;
    const now = engine.getVoices();
    if (now.length) {
      resolve(now);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      /* Re-read rather than take the event's list: on Safari the event fires
         before the array is swapped out. */
      resolve(engine.getVoices());
    };
    engine.addEventListener("voiceschanged", finish);
    setTimeout(finish, 1500);
  });
  return loaded;
}

const NATURAL = /natural|neural|premium|enhanced|wavenet|online|siri/i;
const PLATFORM = /google|microsoft|apple|siri|samsung|nuance/i;
/* The phones read with a woman's voice and it carries the article far better
   than the flat man most desktops install first, so a voice that says which it
   is gets marked — a clear preference for her, a penalty on him. Names cover
   the platforms' stock set. */
const FEMALE =
  /female|woman|zira|samantha|susan|susan1|linda|karen|tessa|moira|sonia|natasha|hazel|catherine|victoria|amelie|julia|anna|katja|salli|rihanna|polly|indri|lese|mariska|zuzana|iveta|kalpana|swara|heera|veena/i;
const MALE =
  /\bmale\b|\bman\b|david|mark|george|james|fred|alex|daniel|paul|arthur|richard|william|oliver|liam|guy|danny|ravi|prabhat|rakesh|hemant|madhur/i;

/** Narration is English and nothing else. The articles are written in
    English, the good free voices are English, and a Hindi page read out by an
    English voice is worse than a Hindi page you read yourself — so the page
    keeps translating and the voice keeps to the one language it is good at. */
const VOICE_LANG = "en";

function score(voice: SpeechSynthesisVoice, wanted: string, base: string): number {
  const lang = voice.lang.toLowerCase().replace(/_/g, "-");
  let points = 0;
  if (lang === wanted) points += 8;
  else if (lang.startsWith(`${base}-`) || lang === base) points += 4;
  /* A remote voice is the platform's own engine rather than a small
     on-device one — that is where the natural voices live. */
  if (!voice.localService) points += 3;
  if (PLATFORM.test(voice.name)) points += 2;
  if (NATURAL.test(voice.name)) points += 4;
  if (FEMALE.test(voice.name)) points += 4;
  else if (MALE.test(voice.name)) points -= 3;
  return points;
}

function isEnglish(voice: SpeechSynthesisVoice) {
  return voice.lang.toLowerCase().replace(/_/g, "-").startsWith(VOICE_LANG);
}

function rank(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const wanted = "en-us";
  return list
    .filter(isEnglish)
    .sort((a, b) => score(b, wanted, VOICE_LANG) - score(a, wanted, VOICE_LANG));
}

/** Every English voice this browser has, best first — the sheet's list. */
export async function voicesForLocale(): Promise<SpeechSynthesisVoice[]> {
  return rank(await loadVoices());
}

/* ── What this browser was told to sound like ────────────────────── */

const PREF_STORE = "tirbeo:narration";

export type NarrationPref = { voice: string | null; rate: number };

export const RATES = [0.85, 1, 1.25, 1.5];

const PREF_DEFAULT: NarrationPref = { voice: null, rate: 1 };

export function readPref(): NarrationPref {
  try {
    const raw = localStorage.getItem(PREF_STORE);
    if (!raw) return PREF_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<NarrationPref>;
    const rate = typeof parsed.rate === "number" && RATES.includes(parsed.rate) ? parsed.rate : 1;
    return { voice: typeof parsed.voice === "string" ? parsed.voice : null, rate };
  } catch {
    return PREF_DEFAULT;
  }
}

function writePref(next: NarrationPref) {
  try {
    localStorage.setItem(PREF_STORE, JSON.stringify(next));
  } catch {
    /* A private window that refuses to store keeps reading; the choice just
       doesn't survive the tab. */
  }
}

/** One sentence at a time — Chrome drops an utterance that runs past about
    fifteen seconds, and a paragraph is longer than that. */
const SENTENCE = /[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g;

function sentences(text: string): string[] {
  const parts = text.match(SENTENCE)?.map((s) => s.trim()).filter(Boolean) ?? [];
  return parts.length ? parts : [text];
}

/* ── The hook ────────────────────────────────────────────────────── */

export function useNarration(blocks: NarrationBlock[]) {
  /* Asked after mount, because the server has no speech engine and a box
     that only exists on the client would disagree with the HTML it sent. */
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof window.speechSynthesis !== "undefined");
  }, []);
  const [playing, setPlaying] = useState(false);
  /** Which block is being spoken, or -1 when nothing is. */
  const [at, setAt] = useState(-1);
  const index = useRef(-1);
  /* The queue is read from here inside the utterance callbacks, so a change
     to the article mid-speech can't leave a stale list behind. */
  const list = useRef(blocks);
  list.current = blocks;

  const [pref, setPref] = useState<NarrationPref>(PREF_DEFAULT);
  const prefRef = useRef(pref);
  prefRef.current = pref;
  const [candidates, setCandidates] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!supported) return;
    setPref(readPref());
    let live = true;
    void voicesForLocale().then((voices) => {
      if (live) setCandidates(voices);
    });
    return () => {
      live = false;
    };
  }, [supported]);

  function chooseVoice(name: string | null) {
    const next = { ...prefRef.current, voice: name };
    setPref(next);
    writePref(next);
    /* The new voice only reaches the ears if the reading starts again. */
    if (index.current >= 0) {
      token.current++;
      window.speechSynthesis.cancel();
      void speak(index.current);
    }
  }

  function chooseRate(rate: number) {
    const next = { ...prefRef.current, rate };
    setPref(next);
    writePref(next);
    if (index.current >= 0) {
      token.current++;
      window.speechSynthesis.cancel();
      void speak(index.current);
    }
  }

  /* Bumped by every cancel, so a voice that arrived after the listener
     already pressed stop doesn't start reading again. */
  const token = useRef(0);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    token.current++;
    window.speechSynthesis.cancel();
    index.current = -1;
    setAt(-1);
    setPlaying(false);
  }, []);

  const speak = useCallback(
    async (next: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const block = list.current[next];
      if (!block) {
        stop();
        return;
      }
      const mine = token.current;
      index.current = next;
      setAt(next);

      const engine = window.speechSynthesis;
      const wanted = prefRef.current.voice;
      const ranked = await voicesForLocale();
      if (mine !== token.current) return;
      /* The named voice wins even if the ranking moved — it is the one the
         listener picked by ear. */
      const voice = (wanted ? ranked.find((v) => v.name === wanted) : null) ?? ranked[0] ?? null;

      const parts = sentences(block.text);
      const rate = prefRef.current.rate;

      parts.forEach((part, i) => {
        const line = new SpeechSynthesisUtterance(part);
        line.lang = voice ? voice.lang : "en-US";
        if (voice) line.voice = voice;
        line.rate = rate;
        /* Only the last sentence of the block hands over to the next block. */
        if (i === parts.length - 1) {
          line.onend = () => {
            /* A cancel() during speech fires onend too, so the queue only
               moves on while this hook still believes it's playing. */
            if (mine === token.current && index.current === next) void speak(next + 1);
          };
        }
        line.onerror = () => {
          if (mine === token.current && index.current === next) stop();
        };
        engine.speak(line);
      });
    },
    [stop],
  );

  /* Chrome's long-read bug, second half: the engine can park itself mid-run
     even across short utterances. Nudging it awake every few seconds is the
     documented workaround, and it costs nothing when the tab is quiet. */
  useEffect(() => {
    if (!playing || typeof window === "undefined" || !window.speechSynthesis) return;
    const engine = window.speechSynthesis;
    const tick = window.setInterval(() => {
      if (engine.speaking && !engine.paused) {
        engine.pause();
        engine.resume();
      }
    }, 7000);
    return () => window.clearInterval(tick);
  }, [playing]);

  const play = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    /* Continuing a pause speaks the rest of the block instead of starting it
       over, which is what "Continue" means. */
    if (window.speechSynthesis.paused && index.current >= 0) {
      window.speechSynthesis.resume();
      setPlaying(true);
      return;
    }
    setPlaying(true);
    void speak(index.current >= 0 ? index.current : 0);
  }, [speak]);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setPlaying(false);
  }, []);

  /** Back one block, or from the start if nothing is going. */
  const rewind = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    token.current++;
    window.speechSynthesis.cancel();
    setPlaying(true);
    void speak(Math.max(0, index.current - 1));
  }, [speak]);

  /* Leaving the article has to end the reading — an utterance outlives the
     component that asked for it, and nothing looks more broken than a voice
     narrating a page that isn't on screen any more. */
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    token.current++;
    window.speechSynthesis.cancel();
    index.current = -1;
    setAt(-1);
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.length]);

  const chosen = (pref.voice && candidates.find((v) => v.name === pref.voice)) || candidates[0];

  return {
    supported,
    playing,
    at,
    count: blocks.length,
    play,
    pause,
    stop,
    rewind,
    /** The list the voice sheet shows, best first. */
    voices: candidates,
    voiceName: chosen?.name ?? null,
    rate: pref.rate,
    chooseVoice,
    chooseRate,
  };
}
