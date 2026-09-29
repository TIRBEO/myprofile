"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, SearchX, Send } from "lucide-react";
import { EmptyState, cn } from "@/components/ig-ui";
import { Breadcrumb, PageSkeleton, SettingsPage } from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import {
  clearUnread,
  dayKey,
  dayLabel,
  sendMessage,
  threadStamp,
  useThreads,
  type Message,
} from "@/lib/chats";
import { haptic } from "@/lib/haptics";
import { useT } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   One conversation.

   Yours on the right, theirs on the left, the day named once in the middle
   where it changes. Nothing here pretends to have been delivered: what you
   wrote is kept with the minute you wrote it, and that's all the page claims.

   Opening a thread clears its unread count, the same as reading it would.
   ═══════════════════════════════════════════════════════════════════ */

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const threads = useThreads();
  const thread = useMemo(
    () => threads?.find((row) => row.id === id || row.handle === id) ?? null,
    [threads, id],
  );
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const t = useT();

  useEffect(() => {
    if (thread?.unread) clearUnread(thread.id);
  }, [thread?.id, thread?.unread]);

  /* Straight to the last thing said, the way every chat app opens. */
  useEffect(() => {
    if (!thread?.messages.length) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.id]);

  const days = useMemo(() => {
    if (!thread) return [];
    const groups: { key: string; label: string; items: Message[] }[] = [];
    for (const message of thread.messages) {
      const key = dayKey(message.at);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(message);
      else groups.push({ key, label: dayLabel(message.at), items: [message] });
    }
    return groups;
    // Rebuilt when the language changes, since the day names come from it.
  }, [thread, t]);

  if (!threads) return <PageSkeleton title="Messages" sections={2} />;

  if (!thread) {
    return (
      <SettingsPage
        title="Message"
        crumb={
          <Breadcrumb items={[{ label: t("Messages"), href: "/messages" }, { label: "Not found" }]} />
        }
      >
        <EmptyState
          icon={<SearchX className="size-6" strokeWidth={1.7} />}
          title="That conversation isn't here"
          description="It may have been started on another device. Nothing was lost — it just never lived on this one."
          action={
            <Link
              href="/messages"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-fg transition-[filter] hover:brightness-110 active:scale-[0.98]"
            >
              <ArrowLeft className="size-[17px]" strokeWidth={2.1} />
              All conversations
            </Link>
          }
        />
      </SettingsPage>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendMessage(thread.id, text);
    setDraft("");
    haptic("light");
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );
  };

  return (
    <SettingsPage
      title={thread.name}
      crumb={
        <Breadcrumb
          items={[{ label: t("Messages"), href: "/messages" }, { label: `@${thread.handle}` }]}
        />
      }
    >
      <div className="-mt-1 mb-5 flex items-center gap-3">
        <ProfilePicture photo={thread.photo} seed={thread.handle} name={thread.name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">@{thread.handle}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {thread.messages.length
              ? `${thread.messages.length} ${thread.messages.length === 1 ? "message" : "messages"}`
              : "Nothing said yet"}
          </p>
        </div>
      </div>

      {days.length ? (
        days.map((day) => (
          <section key={day.key} className="mb-1">
            <p className="my-3 text-center text-[11.5px] font-semibold tracking-[0.03em] text-muted uppercase">
              {day.label}
            </p>
            <div className="space-y-2.5">
              {day.items.map((message, i) => (
                <Bubble
                  key={message.id}
                  message={message}
                  thread={thread}
                  /* Only the last one of a run carries the time; the rest of a
                     run sits against its sibling. */
                  final={
                    i === day.items.length - 1 &&
                    (day.items.length === 1 || day.items[i - 1]?.from !== message.from)
                  }
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="mb-6 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[14px] text-muted">
          Say the first thing — it stays on this device until you clear it.
        </p>
      )}

      <div ref={endRef} />

      <form
        onSubmit={submit}
        className={cn(
          "sticky bottom-0 z-20 -mx-4 mt-6 flex items-end gap-2 border-t border-divider bg-bg/95 px-4 py-3 backdrop-blur",
          "sm:mx-0 sm:rounded-2xl sm:border sm:p-2",
        )}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("Message")}
          aria-label={t("Message")}
          className={cn(
            "min-w-0 flex-1 rounded-full border border-transparent bg-surface-2 px-4 py-3 text-[15px] text-fg outline-none",
            "placeholder:text-muted/70 transition-colors focus:border-accent",
          )}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send"
          className={cn(
            "grid size-[44px] shrink-0 place-items-center rounded-full transition-[opacity,transform]",
            draft.trim()
              ? "bg-accent text-accent-fg hover:brightness-110 active:scale-95"
              : "bg-surface-2 text-muted/50",
          )}
        >
          <Send className="size-[19px]" strokeWidth={2} />
        </button>
      </form>
    </SettingsPage>
  );
}

function Bubble({
  message,
  thread,
  final,
}: {
  message: Message;
  thread: { handle: string; name: string; photo: string | null };
  final: boolean;
}) {
  const mine = message.from === "me";
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && thread.photo ? (
        <ProfilePicture photo={thread.photo} seed={thread.handle} name={thread.name} size={26} />
      ) : null}
      <div className={cn("flex min-w-0 max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
        <p
          className={cn(
            "whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14.5px] leading-[1.45]",
            mine
              ? "rounded-[18px_18px_6px_18px] bg-accent text-accent-fg"
              : "rounded-[6px_18px_18px_18px] bg-surface-2 text-fg",
          )}
        >
          {message.text}
        </p>
        {final ? (
          <p className="mt-1 px-1 text-[11px] tabular-nums text-muted">{threadStamp(message.at)}</p>
        ) : null}
      </div>
    </div>
  );
}
