"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Group,
  Helper,
  LinkRow,
  OptionRow,
  PageSkeleton,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { formatBytes } from "@/lib/download-data";
import { ago, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import {
  EXPORT_FORMATS,
  formatName,
  readDownloadPage,
  requestArchive,
  statusName,
  type DownloadPage,
  type ExportFormat,
  type ExportRequestRow,
} from "./export-format";

/* ═══════════════════════════════════════════════════════════════════
   Download your data

   One paragraph, one button, one honest status line. The account writes the
   file the moment you press it and your browser saves it; Tirbeo keeps no
   copy, so "status" here is the account's real record of past requests —
   nothing is simulated and there is no fake progress bar.

   Requests are recorded by POST /api/user/export-data and the file is
   written by GET /api/user/export-data?request=<id>; both live reads come
   from GET /api/user/export-data?summary=1, so this page says the same
   thing from any device.
   ═══════════════════════════════════════════════════════════════════ */

export default function DownloadDataPage() {
  /* undefined: still reading. null: the account wouldn't answer. */
  const [summary, setSummary] = useState<DownloadPage | null | undefined>(undefined);
  const [failedRead, setFailedRead] = useState("");
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("json");
  const toast = useToast();

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

  /** One press: the request is written on the account in the chosen format,
      and the file it produces is handed to the browser. */
  async function requestMyData() {
    if (busy) return;
    setBusy(true);
    try {
      const archive = await requestArchive(format);
      // Re-read the account rather than patching the list by hand: the
      // request it just wrote is the authority on what came out.
      const fresh = await readDownloadPage().catch(() => null);
      if (fresh) setSummary(fresh);
      haptic("success");
      toast.success(`${archive.fileName} saved — ${formatBytes(archive.bytes)}`);
    } catch (err: any) {
      haptic("error");
      toast.error(err?.message || "Your data couldn't be gathered. Nothing was downloaded.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (summary === undefined) return <PageSkeleton title="Download your data" sections={2} />;

  if (summary === null) {
    return (
      <SettingsPage title="Download your data">
        <Helper lead tone="danger">
          {failedRead} Nothing was downloaded — the file is written by your account, so it
          can&apos;t be produced while the account isn&apos;t answering.
        </Helper>
        <PillStack>
          <PillButton tone="outline" label="Try again" onClick={refresh} />
        </PillStack>
      </SettingsPage>
    );
  }

  const latest = summary.recent[0] ?? null;

  return (
    <SettingsPage title="Download your data">
      <SectionTitle desc="The account holds everything below in one file — your profile, your saved choices, your sign-ins, your sessions and your activity. Press the button and the account writes it right then; your browser saves it and Tirbeo keeps no copy. Passwords, authenticator secrets, recovery codes and passkeys are never included.">
        Pick your format
      </SectionTitle>
      <Group label="Export format">
        {EXPORT_FORMATS.map((choice) => (
          <OptionRow
            key={choice.value}
            title={choice.label}
            sub={choice.sub}
            selected={format === choice.value}
            onSelect={() => setFormat(choice.value)}
          />
        ))}
      </Group>

      <PillStack>
        <PillButton
          label={busy ? "Preparing your file…" : "Request my data"}
          sub={busy ? "Reading every part of the account." : `Downloads one ${formatName(format)} with everything your account holds.`}
          onClick={requestMyData}
          disabled={busy}
        />
      </PillStack>

      {latest ? <StatusLine row={latest} /> : null}

      {summary.recent.length > 1 ? (
        <>
          <SectionTitle desc="Each press writes a fresh file. Tirbeo doesn't keep old ones — opening a request shows what it said and lets you take it again.">
            Previous requests
          </SectionTitle>
          <div className="list-divide">
            {summary.recent.slice(1, 6).map((record) => (
              <LinkRow
                key={record.id}
                href={`/settings/download-data/${record.id}`}
                title={formatStamp(record.at)}
                sub={formatName(record.format)}
                right={record.status === "ready" && record.bytes !== null ? formatBytes(record.bytes) : statusName(record.status, record.at)}
              />
            ))}
          </div>
        </>
      ) : null}
    </SettingsPage>
  );
}

/** The one status line: what the most recent request on the account says. */
function StatusLine({ row }: { row: ExportRequestRow }) {
  if (row.status === "ready") {
    return (
      <Helper tone="ok">
        Last export {ago(row.at)}
        {row.bytes !== null ? ` · ${formatBytes(row.bytes)}` : ""} — saved to your browser, not kept
        by Tirbeo.
      </Helper>
    );
  }
  if (row.status === "failed") {
    return (
      <Helper tone="warn">
        The last request couldn&apos;t be written. Nothing was downloaded — asking again starts
        over.
      </Helper>
    );
  }
  return (
    <Helper>
      Your last request is waiting to be collected — open it below to take the file.
    </Helper>
  );
}
