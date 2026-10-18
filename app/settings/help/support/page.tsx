"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Field, Select, Textarea, cn } from "@/components/ig-ui";
import {
  Group,
  Helper,
  PageSkeleton,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { articleHref, findArticle } from "@/lib/docs";
import { findPolicy } from "@/lib/help-policies";
import { haptic } from "@/lib/haptics";
import {
  MAX_MESSAGE,
  MIN_MESSAGE,
  loadRequests,
  retryRequest,
  statusWords,
  submitRequest,
  type RequestOrigin,
  type SupportRequest,
} from "@/lib/support-requests";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Write to support

   A page rather than a sheet, because a message you actually mean is
   worth the whole screen. The message goes to the account — the desk this
   build has takes one written explanation attached to a decision on the
   account, answers with the row it made, and the row's reference and status
   are shown back here.

   What has not landed is kept, with the drafted text: a device that was
   offline or a desk that refused the note both leave a row on this list with
   a way to send it again, so nothing typed here disappears.

   Reached two ways: cold, from the index, or from the end of an article.
   In the second case the article comes along with the request, which is
   the difference between "something's broken" and "step three of the
   backup codes page isn't what my screen does".
   ═══════════════════════════════════════════════════════════════════ */

const TOPICS = [
  "Something's broken",
  "Signing in and my account",
  "Privacy and my data",
  "Something else",
];

/** `?from=article:sessions` or `?from=policy:privacy`. Read after mount,
    because the server has no idea what the browser bar says. */
function readOrigin(raw: string): RequestOrigin | undefined {
  const [kind, slug] = raw.split(":");
  if (!slug) return undefined;
  if (kind === "article") {
    const article = findArticle(slug);
    return article ? { slug: article.slug, title: article.title, kind: "article" } : undefined;
  }
  if (kind === "policy") {
    const policy = findPolicy(slug);
    return policy ? { slug: policy.slug, title: policy.title, kind: "policy" } : undefined;
  }
  return undefined;
}

function originHref(origin: RequestOrigin): string {
  return origin.kind === "article" ? articleHref(origin.slug) : `/settings/help/policy/${origin.slug}`;
}

export default function SupportPage() {
  const toast = useToast();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SupportRequest | null>(null);
  const [origin, setOrigin] = useState<RequestOrigin | undefined>(undefined);
  const [sending, setSending] = useState(false);
  /** The list as the desk and this device together hold it. */
  const [queue, setQueue] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void loadRequests().then(({ requests, error }) => {
      setQueue(requests);
      setLoadError(error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("from");
    if (raw) setOrigin(readOrigin(raw));
    refresh();
  }, [refresh]);

  const text = message.trim();
  const short = text.length > 0 && text.length < MIN_MESSAGE;
  const valid = text.length >= MIN_MESSAGE;

  async function submit() {
    if (!valid || sending) {
      if (!valid) haptic("error");
      return;
    }
    setSending(true);
    /* The text is written down before the call is made and cleared only once
       the desk has answered, so a send that fails leaves the words where they
       can be sent again. */
    const result = await submitRequest(topic, text, origin);
    setSending(false);
    if (result.sent && result.row) {
      setSaved(result.row);
      setMessage("");
      setTopic(TOPICS[0]);
      toast.success("Sent to support");
    } else {
      haptic("error");
      toast.error(result.error ?? "Support did not take the message.");
    }
    refresh();
  }

  async function retry(row: SupportRequest) {
    setRetrying(row.id);
    const result = await retryRequest(row.id);
    setRetrying(null);
    if (result.sent && result.row) {
      setSaved(result.row);
      toast.success("Sent to support");
    } else {
      toast.error(result.error ?? "Support did not take the message.");
    }
    refresh();
  }

  if (loading) return <PageSkeleton title="Write to support" sections={2} />;

  const unsent = queue.filter((row) => row.state !== "sent" && row.id !== saved?.id);

  if (saved) {
    return (
      <SettingsPage title="Write to support">
        <Helper lead tone={saved.state === "sent" ? "ok" : "warn"}>
          {saved.state === "sent"
            ? "Sent to support and filed on your account."
            : "This one did not reach support — it is kept below with its text."}
        </Helper>

        <SectionTitle>What you filed</SectionTitle>
        <Group>
          <StaticRow title={saved.topic} sub={saved.message} />
          {saved.reference ? (
            <StaticRow
              title="Reference"
              sub={saved.reference}
              right={statusWords(saved.status)}
            />
          ) : (
            <StaticRow title="Status" sub={saved.reason ?? saved.error ?? "Not filed"} />
          )}
        </Group>
        <Helper className="mt-2">
          {saved.origin ? (
            <>
              Filed from{" "}
              <Link
                href={originHref(saved.origin)}
                className="font-semibold text-link underline-offset-2 hover:underline"
              >
                {saved.origin.title}
              </Link>
              . That page is named here, on this device — the desk receives your message and the
              decision it argues with.
            </>
          ) : (
            "Filed from the documentation index, so nothing names the page you were on."
          )}
        </Helper>

        <PillStack>
          <PillButton label="Write another request" tone="primary" onClick={writeAnother} />
          <PillButton label="Back to documentation" href="/settings/help" tone="outline" />
        </PillStack>

        <Helper className="mt-8">
          Every request on your account, with what the reviewer has done with it, is at the bottom
          of the documentation index.
        </Helper>
      </SettingsPage>
    );

    function writeAnother() {
      setSaved(null);
      setMessage("");
      setTopic(TOPICS[0]);
    }
  }

  return (
    <SettingsPage title="Write to support">
      <Helper className="mt-6">
        Say what happened and what you expected instead. This sends it to support, where it is
        filed on your account as one explanation attached to a decision; the page it came from is
        named here on this device.
        {origin ? (
          <>
            {" "}
            It comes tagged with{" "}
            <Link
              href={originHref(origin)}
              className="font-semibold text-link underline-offset-2 hover:underline"
            >
              {origin.title}
            </Link>
            , so you don&apos;t have to describe where you were sitting.
          </>
        ) : null}
      </Helper>

      <SectionTitle>Your request</SectionTitle>
      <Group>
        <Field label="What is it about">
          <Select
            aria-label="Topic"
            options={TOPICS}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
        <Field
          label="Message"
          action={
            <span className="text-[12.5px] tabular-nums text-muted">
              {text.length}/{MAX_MESSAGE}
            </span>
          }
          hint={`At least ${MIN_MESSAGE} characters, so it's worth reading back.`}
          error={
            short
              ? `${MIN_MESSAGE - text.length} more characters needed before you can send.`
              : undefined
          }
        >
          <Textarea
            rows={6}
            value={message}
            maxLength={MAX_MESSAGE}
            invalid={short}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's happening, and what did you expect instead?"
          />
        </Field>
      </Group>

      <PillStack>
        <PillButton
          label={sending ? "Sending…" : "Send request"}
          disabled={!valid || sending}
          onClick={() => void submit()}
        />
        <PillButton label="Back to documentation" href="/settings/help" tone="outline" />
      </PillStack>

      {unsent.length ? (
        <>
          <SectionTitle desc="Written here, not yet filed with support. Each one keeps its text until the desk takes it.">
            Waiting to be sent
          </SectionTitle>
          <Group>
            {unsent.map((row) => (
              <div key={row.id} className="px-4 py-4 sm:px-5">
                <p className="text-[15px] font-medium">{row.topic}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{row.message}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-danger-text">
                  {row.reason ?? row.error ?? "Never sent."}
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={retrying === row.id}
                  onClick={() => void retry(row)}
                >
                  {retrying === row.id ? "Sending…" : "Try again"}
                </Button>
              </div>
            ))}
          </Group>
        </>
      ) : null}

      {loadError ? (
        <Helper className="mt-3" tone="warn">
          {loadError} Anything you wrote here is still on this device.{" "}
          <button
            type="button"
            onClick={refresh}
            className={cn("font-semibold text-link underline-offset-2 hover:underline")}
          >
            Ask again
          </button>
        </Helper>
      ) : null}

      {saved === null && !unsent.length && !loadError ? (
        <Helper className="mt-8">
          Shorter than {MIN_MESSAGE} characters is not something a reader can work from, so the
          box says so before you send it.
        </Helper>
      ) : null}
    </SettingsPage>
  );
}
