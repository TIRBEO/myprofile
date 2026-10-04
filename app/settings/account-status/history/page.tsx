"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { EmptyState } from "@/components/ig-ui";
import {
  ACCOUNT_EVENT,
  KIND_LABEL,
  OUTCOME_LABEL,
  OUTCOME_SENTENCE,
  type AccountRequest,
  useRequests,
} from "@/lib/account-history";
import {
  appealFor,
  findItemById,
  loadAccountChecks,
  loadAppeals,
  readAppeals,
  sections,
  type Appeal,
  type StatusItem,
  type StatusSection,
} from "@/lib/account-status";
import { readSkips } from "@/lib/account-state";
import { ago, formatStamp } from "@/lib/dates";

/* ═══════════════════════════════════════════════════════════════════
   Requests and history

   Everything on this page is something this account asked for and
   something this account then did something about — a pause ended, a close
   called off, a review written out. The reviews come straight from the
   account now, not from this browser: an appeal filed here is the same row
   an admin answers, and the same row a second device will list.

   Under the log sits the other half of the question — the decisions that
   are still waiting on an answer from you. That's the list a good standing
   page can't show, because needing an answer and being in trouble aren't
   the same thing. When both lists are empty, they say so quietly.
   ═══════════════════════════════════════════════════════════════════ */

const OUTCOME_TONE = {
  open: "text-warn-text",
  restored: "text-success-text",
  reversed: "text-success-text",
  reviewed: "text-muted",
};

const APPEAL_STATUS: Record<string, { word: string; tone: "warn" | "muted" | "ok" }> = {
  pending: { word: "Under review", tone: "warn" },
  upheld: { word: "Decision stands", tone: "muted" },
  overturned: { word: "Lifted", tone: "ok" },
};

const APPEAL_TONE = {
  warn: "text-warn-text",
  muted: "text-muted",
  ok: "text-success-text",
};

export default function AccountHistoryPage() {
  const requests = useRequests();
  const [waiting, setWaiting] = useState<Pending[] | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);

  const look = useCallback(() => {
    setWaiting(decisionsAwaitingAnswer());
    setAppeals(readAppeals());
  }, []);

  useEffect(() => {
    look();
    // Read the account's own answers first, then paint from them.
    Promise.all([loadAccountChecks(), loadAppeals().catch(() => [] as Appeal[])])
      .then(look)
      .catch(look);
    window.addEventListener(ACCOUNT_EVENT, look);
    return () => window.removeEventListener(ACCOUNT_EVENT, look);
  }, [look]);

  const open = requests.filter((row) => row.closedAt === null && row.kind !== "appeal");
  const ownRequests = requests.filter((row) => row.kind !== "appeal");

  if (!waiting) return <PageSkeleton title="Requests and history" sections={3} />;

  return (
    <SettingsPage title="Requests and history">
      <Helper lead tone={open.length ? "danger" : "ok"}>
        {open.length
          ? `${KIND_LABEL[open[0].kind]}${open.length === 1 ? " is" : "s are"} in force right now.`
          : "Nothing of yours is open — no pause running, no deletion scheduled, no review in."}
      </Helper>

      <SectionTitle>What you&apos;ve asked for</SectionTitle>
      {ownRequests.length ? (
        <Group>
          {ownRequests.map((row) => (
            <RequestRow key={`${row.kind}-${row.id}-${row.at}`} row={row} />
          ))}
        </Group>
      ) : (
        <p className="max-w-[58ch] text-[14px] leading-relaxed text-muted">
          Nothing asked for yet — pausing the account or closing it leaves a row here.
        </p>
      )}

      <SectionTitle>Appeals</SectionTitle>
      {appeals.length ? (
        <Group>
          {appeals.map((row) => (
            <AppealRow key={row.id} row={row} />
          ))}
        </Group>
      ) : (
        <p className="max-w-[58ch] text-[14px] leading-relaxed text-muted">
          You haven&apos;t asked anyone to review a decision.
        </p>
      )}

      <SectionTitle>Waiting on an answer from you</SectionTitle>
      {waiting.length ? (
        <Group>
          {waiting.map(({ section, item, read }) => (
            <LinkRow
              key={item.id}
              href={`/settings/account-status/${section.id}/${item.id}`}
              title={item.title}
              sub={item.ask}
              right={read ? "Read · unanswered" : "Needs you"}
            />
          ))}
        </Group>
      ) : (
        <p className="max-w-[58ch] text-[14px] leading-relaxed text-muted">
          Nothing is waiting on an answer from you.
        </p>
      )}

      <Helper>
        Decisions and appeals live on the account —{" "}
        <Link href="/settings/account-status" className="text-link">
          Account status
        </Link>{" "}
        lists them.
      </Helper>
    </SettingsPage>
  );
}

/* ── One row of the log ───────────────────────────────────────────
   A pause or a close has nowhere else to be, so its own line carries the
   whole story. Appeals live with the account now — see the Appeals list. */

function RequestRow({ row }: { row: AccountRequest }) {
  const label = OUTCOME_LABEL[row.outcome];
  const tone = OUTCOME_TONE[row.outcome];
  const when = `${formatStamp(row.at)} · ${ago(row.at)}`;
  const closed = row.closedAt ? ` · closed ${formatStamp(row.closedAt)}` : "";

  return (
    <StaticRow
      title={KIND_LABEL[row.kind]}
      sub={`${when}${closed} — ${OUTCOME_SENTENCE[row.outcome]}`}
      right={<span className={tone}>{label}</span>}
    />
  );
}

/* ── An appeal, as the account holds it ─────────────────────────
   The note went in; the answer comes back to this list and to the page of
   the decision it argues with. */

function AppealRow({ row }: { row: Appeal }) {
  const status = APPEAL_STATUS[row.decision ?? "pending"] ?? APPEAL_STATUS.pending;
  const found = findItemById(row.restrictionId);
  return (
    <LinkRow
      href={
        found
          ? `/settings/account-status/${found.section.id}/${found.item.id}`
          : "/settings/account-status"
      }
      title={`Appeal — ${found?.item.title ?? "a decision no longer on your account"}`}
      sub={`${formatStamp(row.at)} · ${ago(row.at)}`}
      right={<span className={APPEAL_TONE[status.tone]}>{status.word}</span>}
    />
  );
}

/* ── What's still unanswered ──────────────────────────────────────
   A decision stops needing an answer the moment it's appealed. Reading it
   and carrying on lifts the block on the app, not the decision, so those
   still appear here — marked, so it's clear you've already seen them. */

type Pending = { section: StatusSection; item: StatusItem; read: boolean };

function decisionsAwaitingAnswer(): Pending[] {
  if (typeof window === "undefined") return [];
  const skipped = readSkips();
  const out: Pending[] = [];
  for (const section of sections()) {
    if (section.severity === "ok") continue;
    for (const item of section.items) {
      if (!item.appealable) continue;
      if (appealFor(item.id)) continue;
      out.push({ section, item, read: skipped.includes(item.id) });
    }
  }
  return out;
}
