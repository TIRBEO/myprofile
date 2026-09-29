"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Field, Select, Textarea } from "@/components/ig-ui";
import {
  Group,
  Helper,
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
  addRequest,
  type RequestOrigin,
  type SupportRequest,
} from "@/lib/support-requests";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Write to support

   A page rather than a sheet, because a message you actually mean is
   worth the whole screen. There is no message server in this build, so
   saving writes the request to this browser through the same store the
   documentation index reads back — the page says as much instead of
   pretending a person will reply.

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

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("from");
    if (raw) setOrigin(readOrigin(raw));
  }, []);

  const text = message.trim();
  const short = text.length > 0 && text.length < MIN_MESSAGE;
  const valid = text.length >= MIN_MESSAGE;

  function submit() {
    if (!valid) {
      haptic("error");
      return;
    }
    const [latest] = addRequest(topic, text, origin);
    setSaved(latest ?? { id: "unsaved", at: Date.now(), topic, message: text, origin });
    setMessage("");
    setTopic(TOPICS[0]);
    toast.success("Saved on this device");
  }

  function writeAnother() {
    setSaved(null);
    setMessage("");
    setTopic(TOPICS[0]);
  }

  if (saved) {
    return (
      <SettingsPage title="Write to support">
        <Helper lead tone="ok">
          Saved on this device{saved.origin ? `, tagged with the ${saved.origin.kind} it came from.` : "."}
        </Helper>

        <SectionTitle>What you filed</SectionTitle>
        <Group>
          <StaticRow title={saved.topic} sub={saved.message} />
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
              .
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
          Your full list of requests, including this one, is at the bottom of the documentation
          index.
        </Helper>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Write to support">
      <Helper className="mt-6">
        Say what happened and what you expected instead. This saves it on your device — nothing is
        sent to anyone.
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
              ? `${MIN_MESSAGE - text.length} more characters needed before you can save.`
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
        <PillButton label="Save request" disabled={!valid} onClick={submit} />
        <PillButton label="Back to documentation" href="/settings/help" tone="outline" />
      </PillStack>
    </SettingsPage>
  );
}
