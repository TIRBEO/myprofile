"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Send, XCircle } from "lucide-react";

import { Button, Textarea, cn } from "@/components/ig-ui";
import { useReauthGuard } from "@/components/reauth-sheet";
import { Helper, PageSkeleton, SettingsPage } from "@/components/settings-shell";
import { ApiError } from "@/lib/api";
import { wasDeclined } from "@/lib/reauth";
import { haptic } from "@/lib/haptics";
import {
  MAX_REPLY,
  closeThread,
  loadThread,
  postFollowup,
  speaker,
  type Thread,
  type ThreadMessage,
} from "@/lib/support-thread";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   The thread

   A conversation, drawn like one. The person's own words on the right, the
   desk's on the left, in the order they happened, with the time each was
   said — because the question a follow-up answers is "did they see what I
   sent", and only a timestamp beside both sides answers it.

   The composer stays open on an answered thread and on a closed one. A
   thread that could not be written back into is a thread that gets re-filed
   as a new request, and a new request loses everything the last one
   established. Writing after a close reopens it, on both sides, by the same
   rule the panel reads.

   An hour in another tab costs an identity proof before the next message
   goes out. The screen says so up front rather than letting the Send button
   fail: the sheet that opens is the same one that guards deleting an account.
   ═══════════════════════════════════════════════════════════════════ */

export default function SupportThreadScreen({ code }: { code: string }) {
  const toast = useToast();
  const { guard, reauthDialog } = useReauthGuard();
  const [thread, setThread] = useState<Thread | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    loadThread(code)
      .then((t) => {
        setThread(t);
        setFailed(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else if (err instanceof ApiError && err.status === 401) window.location.assign("/login");
        else setFailed(err instanceof ApiError ? err.message : "The thread did not load.");
      });
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  // A desk that answers while this page is open should appear without a
  // reload; coming back to the tab is when a person expects the screen to be
  // current, and it is the only moment worth asking for.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  async function send() {
    const message = draft.trim();
    if (!message) return;
    setBusy(true);
    try {
      const next = await guard((proof) => postFollowup(code, message, proof));
      setThread(next);
      setDraft("");
      haptic("success");
    } catch (err) {
      if (wasDeclined(err)) {
        setBusy(false);
        return;
      }
      haptic("error");
      toast.error(err instanceof ApiError ? err.message : "The message did not go. Nothing was sent.");
    }
    setBusy(false);
  }

  async function close() {
    setBusy(true);
    try {
      setThread(await closeThread(code));
      haptic("success");
    } catch (err) {
      haptic("error");
      toast.error(err instanceof ApiError ? err.message : "The thread stayed open.");
    }
    setBusy(false);
  }

  if (missing) {
    return (
      <SettingsPage title="Support">
        <Helper lead>This conversation isn’t on this account.</Helper>
        <Helper>
          The reference in the link doesn’t match anything filed here. Either it was written by a
          different account, or the message was closed and cleared.{" "}
          <Link href="/settings/help/support" className="underline">
            Write to support again
          </Link>
          .
        </Helper>
      </SettingsPage>
    );
  }

  if (!thread) {
    return (
      <SettingsPage title="Support">
        {failed ? (
          <>
            <Helper lead tone="danger">{failed}</Helper>
            <Button variant="secondary" onClick={load}>
              <RefreshCw className="size-[15px]" aria-hidden /> Try again
            </Button>
          </>
        ) : (
          <PageSkeleton title="Support" />
        )}
      </SettingsPage>
    );
  }

  const closed = thread.status === "closed";
  const over = draft.trim().length > MAX_REPLY;

  return (
    <SettingsPage title={thread.subject}>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-3">
        <span>
          Reference <code className="font-mono text-text-2">{thread.ref}</code>
        </span>
        <span aria-hidden>·</span>
        <span>
          {closed
            ? "Closed — writing below opens it again"
            : thread.waitingOn === "you"
              ? "Waiting on you"
              : "Waiting on the team"}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {thread.messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </ol>

      <div className="mt-6 rounded-[14px] border border-hairline bg-surface p-3">
        <label className="label mb-1.5 block" htmlFor="reply">
          Write back
        </label>
        <Textarea
          id="reply"
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={closed ? "Reopen this thread with a message…" : "Add to this thread…"}
          className="resize-y text-[15px]"
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={send} disabled={busy || !draft.trim() || over}>
            {busy ? <Loader2 className="size-[15px] animate-spin" aria-hidden /> : <Send className="size-[15px]" aria-hidden />}
            {closed ? "Send and reopen" : "Send"}
          </Button>
          {!closed ? (
            <Button variant="ghost" onClick={close} disabled={busy}>
              <XCircle className="size-[15px]" aria-hidden /> Close
            </Button>
          ) : null}
          <span className={cn("ml-auto text-[12px]", over ? "text-danger" : "text-text-3")}>
            {over ? `${draft.trim().length - MAX_REPLY} characters over` : `${draft.trim().length}/${MAX_REPLY}`}
          </span>
        </div>
        {thread.needsReauth ? (
          <p className="mt-2 text-[12.5px] leading-[1.45] text-text-3">
            It has been an hour since this account signed in, so sending asks who you are first.
          </p>
        ) : null}
      </div>

      <p className="mt-4 px-1 text-[12.5px] leading-[1.5] text-text-3">
        Replying to the mail works too, but it answers a mailbox. This thread is read by whoever
        picks it up in the panel, and it keeps what you wrote beside the account it is about.
      </p>
      {reauthDialog}
    </SettingsPage>
  );
}

function Bubble({ message }: { message: ThreadMessage }) {
  const mine = message.from === "account";
  const said = new Date(message.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  if (message.from === "system") {
    return (
      <li className="text-center text-[12.5px] text-text-3">
        {mine ? "You closed this thread" : "The team closed this thread"} · {said}
      </li>
    );
  }
  return (
    <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className="mb-1 flex items-center gap-2 px-1 text-[12px] text-text-3">
        <span>{speaker(message.from)}</span>
        <span aria-hidden>·</span>
        <time dateTime={message.at}>{said}</time>
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] px-4 py-2.5 text-[15px] leading-[1.45]",
          mine ? "rounded-br-[6px] bg-accent text-white" : "rounded-bl-[6px] bg-fill text-text",
        )}
      >
        {message.text}
      </div>
    </li>
  );
}
