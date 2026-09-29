"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCirclePlus, SearchX } from "lucide-react";
import { EmptyState, SearchField, cn } from "@/components/ig-ui";
import { Group, PageSkeleton, SectionTitle, SettingsPage } from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import { lastMessage, useThreads, unreadTotal, type Thread, threadStamp } from "@/lib/chats";
import { useT } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Messages

   One row per conversation, newest thing said first, the same way the rest
   of the app lists anything that arrives over time. The line that decides
   the order is the line you'd read to know whether to open it, so it's the
   line that carries the time too.

   Only unread ones get a mark. A dot on every row would be a row telling you
   nothing.
   ═══════════════════════════════════════════════════════════════════ */

export default function MessagesPage() {
  const threads = useThreads();
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const t = useT();

  const shown = useMemo(() => {
    if (!threads) return [];
    const needle = query.trim().toLowerCase();
    return threads.filter((thread) => {
      if (unreadOnly && !thread.unread) return false;
      if (!needle) return true;
      const last = lastMessage(thread);
      return (
        thread.name.toLowerCase().includes(needle) ||
        thread.handle.toLowerCase().includes(needle) ||
        (last?.text.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [threads, query, unreadOnly]);

  if (!threads) return <PageSkeleton title="Messages" sections={2} />;

  const open = unreadTotal();

  return (
    <SettingsPage title="Messages">
      <div className="mt-5 space-y-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search people and messages"
        />
        <div className="flex flex-wrap gap-2">
          <Filter on={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
            {t("Unread")}
            {open ? ` · ${open}` : ""}
          </Filter>
          <Filter on={false} onClick={() => { setQuery(""); setUnreadOnly(false); }}>
            {t("All")}
          </Filter>
        </div>
      </div>

      {shown.length ? (
        <>
          <SectionTitle>
            {t(query || unreadOnly ? "Matching conversations" : "Conversations")}
          </SectionTitle>
          <Group>
            {shown.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </Group>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<SearchX className="size-6" strokeWidth={1.7} />}
            title={threads.length ? "Nothing matches that" : "No conversations yet"}
            description={
              threads.length
                ? "Try a name, a handle, or a word from something you wrote."
                : "Start one and it will stay here with what you both said."
            }
          />
        </div>
      )}

      <NewChatFab />
    </SettingsPage>
  );
}

function ThreadRow({ thread }: { thread: Thread }) {
  const last = lastMessage(thread);
  return (
    <Link
      href={`/messages/${thread.id}`}
      onClick={() => haptic("light")}
      className="flex w-full items-center gap-3.5 px-4 py-3 text-left outline-none transition-colors hover:bg-surface-2/50 active:bg-surface-2/70 focus-visible:outline-none sm:px-5 sm:py-3.5"
    >
      <ProfilePicture photo={thread.photo} seed={thread.handle} name={thread.name} size={52} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[15px]",
            thread.unread ? "font-semibold text-fg" : "font-medium text-fg/90",
          )}
        >
          {thread.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-snug text-muted">
          <span className="shrink-0">@{thread.handle}</span>
          {last ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">
                {last.from === "me" ? "You: " : ""}
                {last.text}
              </span>
            </>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        {thread.unread ? (
          <span
            aria-label={`${thread.unread} unread`}
            className="size-[9px] rounded-full bg-accent"
          />
        ) : null}
        {last ? (
          <span className="text-[12.5px] tabular-nums text-muted">{threadStamp(last.at)}</span>
        ) : null}
      </span>
    </Link>
  );
}

/** The one toggle this list needs, as a chip rather than a switch row — it
    filters the page you're already on. */
function Filter({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        haptic("selection");
        onClick();
      }}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
        on
          ? "border-transparent bg-ink text-ink-fg"
          : "border-border bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** Bottom-right, clear of the rail, so it's reachable on a phone with one
    thumb and never sits under the list it belongs to. */
function NewChatFab() {
  return (
    <Link
      href="/messages/new"
      onClick={() => haptic("medium")}
      aria-label="New chat"
      className={cn(
        "fixed right-5 bottom-6 z-30 grid size-[58px] place-items-center rounded-full",
        "bg-accent text-accent-fg shadow-[0_12px_28px_-10px_rgb(0_0_0/0.6)]",
        "transition-transform hover:brightness-110 active:scale-95",
        "lg:right-8 lg:bottom-8",
      )}
    >
      <MessageCirclePlus className="size-[24px]" strokeWidth={1.9} />
    </Link>
  );
}
