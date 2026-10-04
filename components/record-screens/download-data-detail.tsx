"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { formatBytes, recordsIn, sectionLabel } from "@/lib/download-data";
import { ago, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import { FormatSheet } from "@/app/settings/download-data/format-sheet";
import {
  formatName,
  isStalePending,
  missingSentence,
  readDownloadPage,
  requestArchive,
  statusName,
  truncatedSentence,
  type DownloadPage,
  type ExportFormat,
  type ExportRequestRow,
  type SavedArchive,
} from "@/app/settings/download-data/export-format";

/* ═══════════════════════════════════════════════════════════════════
   One request, in full

   This is the account's own record: which format was chosen, when the file was
   written, how big it came out, and how many records each part held at that
   moment. The file itself is not kept on the account — Tirbeo writes it when
   you ask and forgets it after — so the button here doesn't replay an old byte
   stream, it asks for the same kind of file again: the format stored with this
   request, and no other.

   A request whose file was never produced says so. It is not marked ready to
   make the list look tidy, and it is not hidden; the button writes it now.
   ═══════════════════════════════════════════════════════════════════ */

export default function DownloadDataDetailPage({ id }: { id: string }) {
  const toast = useToast();
  /* undefined: still reading. null: the account wouldn't answer. */
  const [summary, setSummary] = useState<DownloadPage | null | undefined>(undefined);
  const [failedRead, setFailedRead] = useState("");
  const [savingFormat, setSavingFormat] = useState<ExportFormat | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [justSaved, setJustSaved] = useState<{ archive: SavedArchive; row: ExportRequestRow | null } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await readDownloadPage());
    } catch (err: any) {
      setSummary(null);
      setFailedRead(err?.message || "The account service didn't answer.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  usePageRefresh(refresh);

  /** Confirming the sheet: build in the format this request records, and save it. */
  async function download(format: ExportFormat) {
    setSheetOpen(false);
    setSavingFormat(format);
    try {
      const archive = await requestArchive(format);
      const fresh = await readDownloadPage().catch(() => null);
      if (fresh) setSummary(fresh);
      const row = fresh?.recent.find((candidate) => candidate.id === archive.requestId) ?? null;
      setJustSaved({ archive, row });
      haptic("success");
      toast.success(`${archive.fileName} saved — ${formatBytes(archive.bytes)}`);
    } catch (err: any) {
      haptic("error");
      toast.error(err?.message || "Your data couldn't be gathered. Nothing was downloaded.");
      await refresh();
    } finally {
      setSavingFormat(null);
    }
  }

  if (summary === undefined) return <PageSkeleton title="Archive download" sections={3} />;

  if (summary === null) {
    return (
      <SettingsPage title="Archive download">
        <Helper lead tone="danger">
          {failedRead} The record of this download lives on your account, so there&apos;s nothing to
          show while the account isn&apos;t answering.
        </Helper>
        <PillStack>
          <PillButton label="Back to your data" href="/settings/download-data" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const record: ExportRequestRow | undefined = summary.recent.find((row) => row.id === id);

  if (!record) {
    return (
      <SettingsPage title="Archive download">
        <Helper lead>
          That download isn&apos;t in your account&apos;s history — only the ten most recent files
          are kept there.
        </Helper>
        <PillStack>
          <PillButton label="Back to your data" href="/settings/download-data" tone="outline" />
          <PillButton
            label={savingFormat ? "Gathering your data…" : "Download a fresh copy"}
            sub="Written from your account as it stands right now, in the format you choose."
            disabled={savingFormat !== null}
            onClick={() => setSheetOpen(true)}
          />
        </PillStack>
        {justSaved ? <SavedLine archive={justSaved.archive} row={justSaved.row} /> : null}
        {sheetOpen ? (
          <FormatSheet busy={savingFormat !== null} onClose={() => setSheetOpen(false)} onConfirm={download} />
        ) : null}
      </SettingsPage>
    );
  }

  const counts = record.counts;
  const busy = savingFormat !== null;
  const label = formatName(record.format).toLowerCase();
  // A request that was confirmed and then never fetched isn't "still gathering"
  // — no browser ever came back for the file. The account says which of the two
  // it is, and this page says the same thing.
  const neverFetched = isStalePending(record);
  const asked = `Asked for on ${formatStamp(record.at)} (${ago(record.at)}) as a ${label}`;
  const lead =
    record.status === "ready"
      ? `Written ${formatStamp(record.at)} (${ago(record.at)}) as a ${label}.`
      : record.status === "failed"
        ? `${asked}, and writing it failed.`
        : neverFetched
          ? `${asked}. Nothing was ever fetched for it, so no file was written.`
          : `${asked}. The file hasn't been written yet.`;
  const again =
    record.status === "ready"
      ? `Download this ${label} again`
      : record.status === "failed"
        ? `Try the ${label} again`
        : `Write the ${label} now`;

  return (
    <SettingsPage title="Archive download">
      <Helper lead tone={record.status === "ready" ? "ok" : record.status === "failed" ? "danger" : undefined}>
        {lead}{" "}
        {counts
          ? `${recordsIn(counts).toLocaleString()} records, ${formatBytes(record.bytes)}.`
          : record.bytes !== null
            ? `${formatBytes(record.bytes)}.`
            : ""}
      </Helper>

      {justSaved ? <SavedLine archive={justSaved.archive} row={justSaved.row} /> : null}

      <PillStack>
        <PillButton
          label={busy ? "Gathering your data…" : again}
          sub="Written fresh from your account now — this record stays as it is."
          disabled={busy}
          onClick={() => setSheetOpen(true)}
        />
        <PillButton label="All your data" href="/settings/download-data" tone="outline" />
      </PillStack>

      <SectionTitle>The download</SectionTitle>
      <Group>
        <StaticRow title="Requested" right={formatStamp(record.at)} />
        <StaticRow title="Format" right={formatName(record.format)} />
        <StaticRow title="State" right={statusName(record.status, record.at)} />
        <StaticRow
          title="File"
          right={record.fileName || (record.bytes === null ? "Size unknown" : formatBytes(record.bytes))}
        />
        <StaticRow
          title="Records"
          right={counts ? `${recordsIn(counts).toLocaleString()} in ${Object.keys(counts).length} parts` : "Not recorded"}
        />
      </Group>

      {counts ? (
        <>
          <SectionTitle desc="Counted when the file was written.">What was inside</SectionTitle>
          <Group>
            {Object.entries(counts).map(([key, n]) => (
              <StaticRow
                key={key}
                title={sectionLabel(key)}
                right={`${Number(n).toLocaleString()} ${Number(n) === 1 ? "record" : "records"}`}
              />
            ))}
          </Group>
        </>
      ) : null}

      {record.missing.length || record.truncated.length ? (
        <Helper tone="warn">
          {missingSentence(record.missing)} {truncatedSentence(record.truncated)}
        </Helper>
      ) : null}

      <Helper className="mt-6">
        An archive is a snapshot of the account at the moment it was written.{" "}
        <Link
          href="/settings/download-data"
          className="font-medium text-link underline underline-offset-2"
        >
          Your data page
        </Link>{" "}
        says what the account would give up today.
      </Helper>

      {sheetOpen ? (
        <FormatSheet
          busy={busy}
          defaultFormat={record.format}
          title={`Which format for a fresh ${formatName(record.format).toLowerCase()}?`}
          description="This request was made as one; you can take the same kind again, or the other."
          confirmPrefix="Write the"
          onClose={() => setSheetOpen(false)}
          onConfirm={download}
        />
      ) : null}
    </SettingsPage>
  );
}

/** The download this page just took, described by what the account recorded. */
function SavedLine({ archive, row }: { archive: SavedArchive; row: ExportRequestRow | null }) {
  const missing = row?.missing ?? [];
  const records = row?.counts ? ` ${recordsIn(row.counts).toLocaleString()} records,` : "";
  return (
    <Helper tone={missing.length ? "warn" : "ok"}>
      Saved {archive.fileName} as a {formatName(archive.format).toLowerCase()} — {formatBytes(archive.bytes)},
      {records} taken {ago(archive.requestedAt)}.
      {missingSentence(missing)} {truncatedSentence(row?.truncated ?? [])}
    </Helper>
  );
}
