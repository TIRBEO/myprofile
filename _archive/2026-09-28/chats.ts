"use client";

/* ═══════════════════════════════════════════════════════════════════
   Conversations

   Kept here so the list, the thread, the badge on the navigation and the
   profile page all count the same unread messages instead of each keeping
   their own idea of one.

   There's no message server, so a thread is a local record: what you wrote
   is stored with the minute you wrote it, and nothing pretends to have been
   delivered. The people in it are the handles themselves — a name, a face
   and whatever you two have said to each other on this device.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { translate } from "@/lib/i18n";
import { appLocale } from "@/lib/language";

const STORE = "tirbeo:chats";
export const CHAT_EVENT = "tirbeo:chats";

export type Message = {
  id: string;
  at: number;
  /** "me" is this account; "them" is whoever else is in the thread. */
  from: "me" | "them";
  text: string;
};

export type Thread = {
  id: string;
  handle: string;
  name: string;
  photo: string | null;
  messages: Message[];
  unread: number;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** A short opening for the threads that exist to be looked at. Everything in
    them is marked as yours in the UI, so nothing here is presented as real. */
function seed(): Thread[] {
  const now = Date.now();
  const row = (
    id: string,
    handle: string,
    name: string,
    unread: number,
    said: [Message["from"], number, string][],
  ): Thread => ({
    id,
    handle,
    name,
    photo: null,
    unread,
    messages: said.map(([from, ago, text], i) => ({
      id: `${id}-${i}`,
      at: now - ago,
      from,
      text,
    })),
  });

  return [
    row("shubham", "shubham_gk17", "Shubham Gaikwad", 2, [
      ["them", 6 * MIN, "did you get the settings screen working?"],
      ["me", 5 * MIN, "most of it. the rail and the pages match now"],
      ["them", 3 * MIN, "nice. send me a screenshot when you can"],
      ["them", MIN, "also — is the profile page live yet?"],
    ]),
    row("bhakti", "bhakti_2707", "bhakti dhere", 1, [
      ["them", 40 * MIN, "the archive download took a while but it came through"],
      ["me", 34 * MIN, "it builds the whole copy locally, so it will always be slow"],
      ["them", 22 * MIN, "makes sense"],
    ]),
    row("harshad", "harshad_dhumal_", "Harshad Dhumal", 0, [
      ["me", 3 * HOUR, "are you on the newest build?"],
      ["them", 2 * HOUR + 40 * MIN, "not yet, give me a bit"],
    ]),
    row("khushi", "khushi.2404", "Khushi", 0, [
      ["them", 26 * HOUR, "the two-factor codes saved fine btw"],
      ["me", 25 * HOUR, "good — keep the printed set somewhere offline"],
    ]),
    row("omkar", "omkar_keshav", "Omkar Keshav", 0, [
      ["me", 2 * DAY, "sent you the invite link"],
      ["them", 2 * DAY - 20 * MIN, "got it, signed up"],
    ]),
    row("rohit", "rohitpatilrb1009", "Rohit Patil", 0, [
      ["them", 4 * DAY, "which language list are you using?"],
      ["me", 4 * DAY - HOUR, "the one on the language page, all local names"],
    ]),
  ];
}

function read(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) {
      const seeded = seed();
      write(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (thread): thread is Thread =>
        typeof thread?.id === "string" &&
        typeof thread?.handle === "string" &&
        Array.isArray(thread?.messages),
    );
  } catch {
    return [];
  }
}

function write(list: Thread[]): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    /* private mode — it still holds for this session */
  }
  announce();
}

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHAT_EVENT));
}

export function readThreads(): Thread[] {
  return read().sort((a, b) => stamp(b) - stamp(a));
}

export function findThread(id: string): Thread | null {
  return read().find((thread) => thread.id === id || thread.handle === id) ?? null;
}

/** Newest last inside a thread, so the moment that decides its order is the
    one it was last spoken at. */
export function stamp(thread: Thread): number {
  return thread.messages.length ? thread.messages[thread.messages.length - 1].at : 0;
}

export function lastMessage(thread: Thread): Message | null {
  return thread.messages.length ? thread.messages[thread.messages.length - 1] : null;
}

export function unreadTotal(): number {
  return read().reduce((n, thread) => n + thread.unread, 0);
}

/** Opens a thread with a handle, or returns the one that already exists. */
export function startThread(handle: string, name = handle): Thread {
  const list = read();
  const existing = list.find((thread) => thread.handle === handle);
  if (existing) return existing;
  const thread: Thread = {
    id: handle.replace(/[^a-z0-9]/gi, "").toLowerCase() || `t${Date.now()}`,
    handle,
    name,
    photo: null,
    messages: [],
    unread: 0,
  };
  write([thread, ...list]);
  return thread;
}

export function sendMessage(id: string, text: string): Thread | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const list = read();
  const at = list.findIndex((thread) => thread.id === id);
  if (at < 0) return null;
  const thread = list[at];
  list[at] = {
    ...thread,
    messages: [...thread.messages, { id: `m${Date.now()}`, at: Date.now(), from: "me", text: trimmed }],
  };
  write(list);
  return list[at];
}

export function clearUnread(id: string): void {
  const list = read();
  const at = list.findIndex((thread) => thread.id === id);
  if (at < 0 || !list[at].unread) return;
  list[at] = { ...list[at], unread: 0 };
  write(list);
}

export function dropThread(id: string): void {
  write(read().filter((thread) => thread.id !== id));
}

/** Threads newest-first, re-read whenever any of them changes. */
export function useThreads(): Thread[] | null {
  const [list, setList] = useState<Thread[] | null>(null);
  useEffect(() => {
    const look = () => setList(readThreads());
    look();
    window.addEventListener(CHAT_EVENT, look);
    window.addEventListener("storage", look);
    return () => {
      window.removeEventListener(CHAT_EVENT, look);
      window.removeEventListener("storage", look);
    };
  }, []);
  return list;
}

/** How many messages are waiting, re-counted whenever a thread changes — the
    rail's badge and the list's chip read the same number from here. */
export function useUnreadTotal(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const look = () => setCount(unreadTotal());
    look();
    window.addEventListener(CHAT_EVENT, look);
    window.addEventListener("storage", look);
    return () => {
      window.removeEventListener(CHAT_EVENT, look);
      window.removeEventListener("storage", look);
    };
  }, []);
  return count;
}

/* ── How a moment in a thread is labelled ─────────────────────────
   The same vocabulary the rest of the app uses: a clock for today, a word
   for yesterday, a date once it's a week out. */

export function threadStamp(at: number, now = Date.now()): string {
  const mins = Math.floor((now - at) / MIN);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(at));
}

export function dayKey(at: number): string {
  return new Date(at).toDateString();
}

export function dayLabel(at: number, now = Date.now()): string {
  const locale = appLocale();
  const today = new Date(now).toDateString();
  /* The two words a chat actually needs are the two worth having in every
     language; anything older is written out by the locale itself. */
  if (dayKey(at) === today) return translate(locale, "Today");
  if (dayKey(at) === new Date(now - DAY).toDateString()) return translate(locale, "Yesterday");
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(at));
}
