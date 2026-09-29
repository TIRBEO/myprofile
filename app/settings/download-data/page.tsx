"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ig-ui";
import {
  ActionRow,
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import {
  FORMATS,
  MAX_REQUESTS,
  PREP_MS,
  TICK_MS,
  cooldownLabel,
  cooldownMs,
  formatLabel,
  isReady,
  progressOf,
  resaveClosed,
  readRequests,
  requestArchive,
  scopeLabel,
  type ArchiveRequest,
  type Format,
  type RequestResult,
} from "@/lib/download-data";
import { ago } from "@/lib/dates";
import { usePrefs } from "@/lib/prefs";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";


/* ═══════════════════════════════════════════════════════════════════
   Download your data

   One request, and it always holds everything — there's nothing to pick,
   because the archive is the whole account. Ask for it and you're carried
   to the page for that one request, which counts the build up and hands
   over the file when it's ready. There's no server here, so nothing is
   emailed and nothing is uploaded. Three requests a day keeps the work
   reasonable, and the wait is counted down rather than hidden.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:download-data";

type Picks = { format: Format };

const DEFAULTS: Picks = { format: "json" };

export default function DownloadDataPage() {
  const { values: picks, set } = usePrefs(STORE, DEFAULTS);
  const [requests, setRequests] = useState<ArchiveRequest[] | null>(null);
  const [wait, setWait] = useState(0);
  const [tick, setTick] = useState(0);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setRequests(readRequests());
    setWait(cooldownMs());
  }, []);

  // The clock is re-read on each tick, so progress moves without re-rendering
  // for anything else.
  const now = useMemo(() => Date.now(), [tick]);
  const newest = requests?.[0] ?? null;
  const pending = newest && !isReady(newest, now) ? newest : null;

  // Only a request that is still preparing needs a second-by-second clock.
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [pending]);

  // The cooldown outlives any one request, so it gets a slower check of its own.
  useEffect(() => {
    if (!wait) return;
    const id = window.setInterval(() => setWait(cooldownMs()), 30_000);
    return () => window.clearInterval(id);
  }, [wait]);

  if (!picks || requests === null) return <PageSkeleton title="Download your data" sections={3} />;

  const { format } = picks;
  const limited = wait > 0;

  function blocked() {
    haptic("error");
    toast.error(`Limit reached — you can request another archive in ${cooldownLabel(wait)}`);
  }

  function request() {
    const result: RequestResult = requestArchive(format, "everything");
    if (!result.ok) {
      setWait(result.retryInMs);
      haptic("error");
      toast.error(`Limit reached — try again in ${cooldownLabel(result.retryInMs)}`);
      return;
    }
    setRequests(result.requests);
    setWait(cooldownMs());
    haptic("success");
    /* The build is a thing with a state, so it gets a page: the progress, the
       file name, and everything that went into it are all answered there. */
    const fresh = result.requests[0];
    if (fresh) router.push(`/settings/download-data/${fresh.id}`);
  }

  const secondsLeft = pending
    ? Math.max(0, Math.round((PREP_MS - (now - pending.requestedAt)) / 1000))
    : 0;

  return (
    <SettingsPage title="Download your data">
      <SectionTitle>Format</SectionTitle>
      <Segmented
        label="File format"
        value={format}
        options={FORMATS}
        onChange={(next) => set({ format: next })}
      />
      <Helper>{FORMATS.find((option) => option.value === format)?.sub}</Helper>

      <SectionTitle desc="The archive is built from what this browser holds — your details, saved choices, sign-ins, devices and the changes you've made. Nothing is emailed to you, and a password never appears in it.">
        Request
      </SectionTitle>
      <Group>
        <ActionRow
          title="Download all my data"
          sub={
            limited
              ? `Try again in ${cooldownLabel(wait)}.`
              : `Everything, as ${formatLabel(format)}, written on this device.`
          }
          disabled={limited}
          blockedHint={blocked}
          onClick={request}
        />
      </Group>

      {pending ? (
        <Helper>
          An archive is being prepared — {secondsLeft} second{secondsLeft === 1 ? "" : "s"} left.{" "}
          <Link
            href={`/settings/download-data/${pending.id}`}
            className="font-semibold text-link underline underline-offset-2"
          >
            Watch it build
          </Link>
          .
        </Helper>
      ) : null}

      <SectionTitle desc="Each request keeps its own page: the format it was filed as, when it was built, and what was inside it at the time.">
        Requests
      </SectionTitle>
      {requests.length ? (
        <Group>
          {requests.map((request) => (
            <LinkRow
              key={request.id}
              href={`/settings/download-data/${request.id}`}
              title={`${scopeLabel(request.scope)} · ${formatLabel(request.format)}`}
              sub={`Requested ${ago(request.requestedAt)}`}
              right={
                isReady(request, now)
                  ? resaveClosed(request, now)
                    ? "Expired"
                    : request.savedAt
                      ? "Saved"
                      : "Ready"
                  : `${progressOf(request, now)}%`
              }
            />
          ))}
        </Group>
      ) : (
        <Helper>
          No archive has been requested from this device. The {MAX_REQUESTS} most recent requests
          stay listed here with their dates.
        </Helper>
      )}
    </SettingsPage>
  );
}
