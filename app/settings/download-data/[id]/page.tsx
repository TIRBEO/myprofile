"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PREP_MS,
  TICK_MS,
  type ArchiveRequest,
  type Section,
  archiveBytes,
  buildSections,
  cooldownLabel,
  cooldownMs,
  downloadArchive,
  fileNameFor,
  findRequest,
  formatLabel,
  isReady,
  markSaved,
  progressOf,
  resaveClosed,
  scopeLabel,
} from "@/lib/download-data";
import { Group, Helper, PageSkeleton, PillButton, PillStack, SectionTitle, SettingsPage, StaticRow } from "@/components/settings-shell";
import { ago, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   One archive request, in full

   The list says which requests exist; this says what one of them is.
   Which it was asked for, where it stands, what the file is called, how
   big it came out, and what is actually inside it — section by section,
   with the record count each held when it was read. The download lives
   here too, because this is the page that knows whether the file is
   ready yet rather than making you guess from a row.
   ═══════════════════════════════════════════════════════════════════ */

export default function DownloadDataDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [request, setRequest] = useState<ArchiveRequest | null | undefined>(undefined);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [contents, setContents] = useState<Section[] | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  /* Read from state rather than at render: the cooldown lives in the day a
     request was filed, so a server render can't know it. */
  const [wait, setWait] = useState(0);

  useEffect(() => {
    const found = findRequest(params.id);
    const at = Date.now();
    setRequest(found);
    setNow(at);
    setWait(cooldownMs());
  }, [params.id]);

  const ready = !!request && isReady(request, now);

  /* Read once, when the build finishes, and then held: this page answers
     "what was in it", not "what is in it now". */
  useEffect(() => {
    if (!request || !ready) return;
    setContents(buildSections(request));
    setBytes(archiveBytes(request));
  }, [request, ready]);

  /* Only a request still preparing needs a clock of its own, and only one
     interval — two pages ticking independently would disagree about seconds. */
  useEffect(() => {
    if (!request || ready) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [request, ready]);

  if (request === undefined || !now) return <PageSkeleton title="Archive request" sections={3} />;

  if (!request) {
    return (
      <SettingsPage title="Archive request">
        <p className="mt-1 max-w-[58ch] text-[14px] leading-relaxed text-muted">
          That request isn&apos;t on this device. Archives are filed here rather than on a server, so
          one asked for from another phone or browser won&apos;t appear in this list.
        </p>
        <PillStack>
          <PillButton label="Back to your data" href="/settings/download-data" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const pct = ready ? 100 : progressOf(request, now);
  const secondsLeft = Math.max(0, Math.ceil((PREP_MS - (now - request.requestedAt)) / 1000));
  const closed = resaveClosed(request, now);

  function save(target: ArchiveRequest) {
    setSaving(true);
    haptic("light");
    window.setTimeout(() => {
      downloadArchive(target);
      const all = markSaved(target.id);
      setRequest(all.find((row) => row.id === target.id) ?? null);
      setSaving(false);
      toast.success(`${fileNameFor(target)} saved to this device`);
    }, 900);
  }

  return (
    <SettingsPage title="Archive request">
      <Helper lead tone={ready ? (closed ? "warn" : "ok") : undefined}>
        {ready
          ? request.savedAt
            ? closed
              ? `Saved to this device ${ago(request.savedAt)}, and now expired.`
              : `Ready, and saved to this device ${ago(request.savedAt)}.`
            : "Ready. Saving writes the file through your browser — nothing is sent anywhere."
          : `Still being prepared — about ${secondsLeft} second${
              secondsLeft === 1 ? "" : "s"
            } left.`}
      </Helper>

      <Progress pct={pct} done={ready} secondsLeft={secondsLeft} />

      <PillStack>
        {ready ? (
          <PillButton
            label={
              saving
                ? "Saving to this device…"
                : request.savedAt
                  ? closed
                    ? "This copy has expired"
                    : "Download it again"
                  : "Download archive"
            }
            sub={
              closed
                ? "A saved file older than a week isn't offered again — request a fresh archive."
                : `${fileNameFor(request)} · ${formatBytes(bytes ?? archiveBytes(request))}`
            }
            disabled={saving || closed}
            tone={closed ? "outline" : "primary"}
            onClick={() => save(request)}
          />
        ) : (
          <PillButton
            label="Building…"
            sub="About 12 seconds. This page turns itself to ready the moment it's done."
            disabled
            tone="outline"
          />
        )}
        <PillButton
          label={wait > 0 ? `Another in ${cooldownLabel(wait)}` : "Request another archive"}
          sub={wait > 0 ? "Three archives a day keeps the work reasonable." : undefined}
          href={wait > 0 ? undefined : "/settings/download-data"}
          disabled={wait > 0}
          tone="outline"
        />
      </PillStack>

      <SectionTitle>The request</SectionTitle>
      <Group>
        <StaticRow
          title="Requested"
          sub="Filed from this device, and built here."
          right={formatStamp(request.requestedAt)}
        />
        <StaticRow title="Scope" right={scopeLabel(request.scope)} />
        <StaticRow title="Format" right={formatLabel(request.format)} />
        <StaticRow title="File name" right={fileNameFor(request)} />
        <StaticRow
          title="Size"
          sub={contents ? `The whole file, across the ${contents.length} sections below.` : "Measured once the file is built."}
          right={bytes === null ? "Not built yet" : formatBytes(bytes)}
        />
        <StaticRow
          title="Saved here"
          sub={
            request.savedAt
              ? "A copy went to this device's downloads."
              : "Not downloaded from this page yet."
          }
          right={request.savedAt ? formatStamp(request.savedAt) : "Not yet"}
        />
      </Group>

      <SectionTitle desc={`What the file holds, as it was read when this page opened. ${request.scope === "profile" ? "This one was limited to the profile, so the activity sections were left out." : "Every line is taken from what this browser stores — nothing is fetched from a server."}`}>
        What&apos;s inside
      </SectionTitle>
      {contents ? (
        <Group>
          {contents.map((section) => (
            <StaticRow
              key={section.name}
              title={section.name}
              right={`${section.rows.length} ${section.rows.length === 1 ? "record" : "records"}`}
            />
          ))}
        </Group>
      ) : (
        <Helper>
          The file is still being assembled, so there&apos;s nothing to count yet.
        </Helper>
      )}

      <Helper className="mt-6">
        An archive is a snapshot: it holds what this browser knew the moment it was built, and a
        change made afterwards isn&apos;t written into a file that already exists.{" "}
        <Link
          href="/settings/download-data"
          className="font-medium text-link underline underline-offset-2"
        >
          Request a fresh one
        </Link>{" "}
        if you need the account as it stands now.
      </Helper>
    </SettingsPage>
  );
}

/* ── The build, drawn as a ring ─────────────────────────────────── */

/** One number and one sweep, with a halo that keeps breathing while the work
    runs. A build that finishes in twelve seconds has nothing else to show, so
    the moving part is the only thing on the page that says it's working — and
    it stops the moment the ring closes. */
function Progress({
  pct,
  done,
  secondsLeft,
}: {
  pct: number;
  done: boolean;
  secondsLeft: number;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="mt-3 flex items-center gap-5">
      <span aria-hidden className="relative grid size-[128px] shrink-0 place-items-center">
        {done ? null : (
          <span className="absolute inset-3 rounded-full bg-accent/22 blur-xl motion-safe:animate-[halo-breathe_2.6s_ease-in-out_infinite]" />
        )}
        <svg viewBox="0 0 120 120" className="relative size-[128px] -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--divider)" strokeWidth="7" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={done ? "var(--success)" : "var(--accent)"}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 900ms linear, stroke 400ms linear" }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-[27px] leading-none font-bold tabular-nums">
              {pct}
              <span className="text-[14px] font-semibold text-muted">%</span>
            </span>
            <span className="mt-1.5 block text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
              {done ? "ready" : `${secondsLeft}s left`}
            </span>
          </span>
        </span>
      </span>

      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold">{done ? "Assembled here" : "Assembling"}</p>
        <p className="mt-1 max-w-[34ch] text-[13px] leading-relaxed text-muted">
          {done
            ? "Every store this app writes to was read once, and the file was built out of that."
            : "Reading the details, the choices, the sign-ins, the devices and the changes — one after another."}
        </p>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
