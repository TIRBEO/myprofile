"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, MessageCirclePlus } from "lucide-react";
import { EmptyState, SearchField, cn } from "@/components/ig-ui";
import {
  Breadcrumb,
  Group,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import { startThread, useThreads, type Thread } from "@/lib/chats";
import { useT } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Starting a conversation.

   A handle is the whole address here — there's no directory to search and no
   server to ask, so you either already talk to the person or you know what
   they're called. Typing a handle you've used before finds the thread that
   already exists instead of starting a second one beside it.
   ═══════════════════════════════════════════════════════════════════ */

export default function NewChatPage() {
  return (
    <Suspense fallback={<PageSkeleton title="New chat" sections={1} />}>
      <Picker />
    </Suspense>
  );
}

function Picker() {
  const router = useRouter();
  const params = useSearchParams();
  const threads = useThreads();
  const [query, setQuery] = useState("");
  const t = useT();
  const handle = clean(query);

  /* Coming from a profile page hands the handle over in the address. A thread
     with that person already opens it; anything else starts one and opens that. */
  useEffect(() => {
    const to = clean(params.get("to") ?? "");
    if (!to) return;
    const found = threads?.find((thread) => thread.handle === to);
    router.replace(`/messages/${found ? found.id : startThread(to).id}`);
  }, [router, params, threads]);

  const known = useMemo(() => {
    if (!threads || !handle) return [];
    return threads.filter(
      (thread) =>
        thread.handle.includes(handle) || thread.name.toLowerCase().includes(handle),
    );
  }, [threads, handle]);

  if (!threads) return <PageSkeleton title="New chat" sections={1} />;

  const open = (row: Thread) => router.push(`/messages/${row.id}`);
  const start = () => {
    if (!handle) return;
    const existing = threads.find((thread) => thread.handle === handle);
    haptic("medium");
    open(existing ?? startThread(handle));
  };

  return (
    <SettingsPage
      title="New chat"
      crumb={
        <Breadcrumb
          items={[{ label: t("Messages"), href: "/messages" }, { label: t("New chat") }]}
        />
      }
    >
      <div className="mt-1 mb-2.5 [&_input]:h-12 [&_input]:rounded-full [&_input]:border-transparent [&_input]:bg-surface-2">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search a handle or a name"
          autoFocus
        />
      </div>

      {handle ? (
        known.length ? (
          <>
            <SectionTitle>Conversations with “{query.trim()}”</SectionTitle>
            <Group>
              {known.map((thread) => (
                <Pick
                  key={thread.id}
                  thread={thread}
                  onClick={() => {
                    haptic("light");
                    open(thread);
                  }}
                />
              ))}
            </Group>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            className={cn(
              "group -mx-4 flex w-[calc(100%+2rem)] items-center gap-3.5 px-4 py-3.5 text-left",
              "transition-colors hover:bg-surface-2/50 active:bg-surface-2/70 sm:mx-0 sm:w-full sm:rounded-2xl sm:px-4",
            )}
          >
            <span className="grid size-[52px] shrink-0 place-items-center rounded-full border border-dashed border-border text-muted transition-colors group-hover:border-accent group-hover:text-accent">
              <MessageCirclePlus className="size-[21px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-fg">
                Start a chat with @{handle}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">
                No conversation with that handle on this device yet.
              </span>
            </span>
            <ChevronRight className="size-[17px] shrink-0 text-muted" strokeWidth={2.2} />
          </button>
        )
      ) : null}

      {threads.length ? (
        <>
          <SectionTitle desc="Pick one to keep it, or start a new one above.">
            {handle ? "Also talk to" : "People you already talk to"}
          </SectionTitle>
          <Group>
            {(handle ? threads.filter((thread) => !known.includes(thread)) : threads).map(
              (thread) => (
                <Pick
                  key={thread.id}
                  thread={thread}
                  onClick={() => {
                    haptic("light");
                    open(thread);
                  }}
                />
              ),
            )}
          </Group>
        </>
      ) : null}

      {!handle && !threads.length ? (
        <EmptyState
          icon={<MessageCirclePlus className="size-6" strokeWidth={1.7} />}
          title="Nobody to talk to yet"
          description="Type a handle above and the conversation begins there."
        />
      ) : null}

      <p className="mt-5 px-1 text-[12.5px] leading-relaxed text-muted">
        A thread lives on this device only — what you write is kept with the minute you wrote it,
        and nothing here claims it reached anybody.
      </p>
    </SettingsPage>
  );
}

function Pick({ thread, onClick }: { thread: Thread; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-3 text-left outline-none transition-colors hover:bg-surface-2/50 active:bg-surface-2/70 focus-visible:outline-none sm:px-5 sm:py-3"
    >
      <ProfilePicture photo={thread.photo} seed={thread.handle} name={thread.name} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-fg">{thread.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">@{thread.handle}</span>
      </span>
      <ChevronRight className="size-[17px] shrink-0 text-muted" strokeWidth={2.2} />
    </button>
  );
}

/** Handles are what people paste from a profile page, so the @ and the case
    come off before anything is looked up or stored. */
function clean(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}
