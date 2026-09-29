"use client";

import { useEffect, useState } from "react";
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
  decisionStatus,
  findItemById,
  sections,
  type StatusItem,
  type StatusSection,
} from "@/lib/account-status";
import { readSkips } from "@/lib/account-state";
import { ago, formatStamp } from "@/lib/dates";

/* ═══════════════════════════════════════════════════════════════════
   Requests and history

   Everything on this page is something this account asked for and
   something this account then did something about — a pause ended, a close
   called off, a review written out. Nothing here is a status somebody
   guessed at: a row says "still in force" because it is, and "reversed"
   because someone reversed it, at a minute that was recorded when they did.

   Under the log sits the other half of the question — the decisions that
   are still waiting on an answer from you. That's the list a good standing
   page can't show, because needing an answer and being in trouble aren't
   the same thing.
   ═══════════════════════════════════════════════════════════════════ */

const OUTCOME_TONE = {
  open: "text-warn-text",
  restored: "text-success-text",
  reversed: "text-success-text",
  reviewed: "text-muted",
};

export default function AccountHistoryPage() {
  const requests = useRequests();
  const [waiting, setWaiting] = useState<Pending[] | null>(null);

  useEffect(() => {
    const look = () => setWaiting(decisionsAwaitingAnswer());
    look();
    window.addEventListener(ACCOUNT_EVENT, look);
    return () => window.removeEventListener(ACCOUNT_EVENT, look);
  }, []);

  const open = requests.filter((row) => row.closedAt === null);

  if (!waiting) return <PageSkeleton title="Requests and history" sections={3} />;

  return (
    <SettingsPage title="Requests and history">
      <Helper lead tone={open.length ? "danger" : "ok"}>
        {open.length
          ? `${KIND_LABEL[open[0].kind]}${open.length === 1 ? " is" : "s are"} in force right now.`
          : "Nothing of yours is open — no pause running, no deletion scheduled, no review in."}
      </Helper>

      <SectionTitle>What you&apos;ve asked for</SectionTitle>
      {requests.length ? (
        <Group>
          {requests.map((row) => (
            <RequestRow key={`${row.kind}-${row.id}-${row.at}`} row={row} />
          ))}
        </Group>
      ) : (
        <Group>
          <EmptyState
            title="Nothing asked for yet"
            description="Pausing the account, closing it, and appealing a decision all leave a row here, with what became of them."
          />
        </Group>
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
        <Group>
          <StaticRow
            title="Every decision has been appealed"
            sub="Anything you've set aside without appealing is still listed under Account status, and still open to a review request."
          />
        </Group>
      )}

      <Helper>
        Only what you did from these pages is kept, and only on this device. The decisions
        themselves come from the account, so the list of them is under{" "}
        <Link href="/settings/account-status" className="text-link">
          Account status
        </Link>
        .
      </Helper>
    </SettingsPage>
  );
}

/* ── One row of the log ───────────────────────────────────────────
   An appeal is a means to a page, not a page: the note itself, the rule and
   the three things that happen next all live with the decision it argues
   with, so this row goes there. A pause or a close has nowhere else to be,
   so its own line carries the whole story.                          */

function RequestRow({ row }: { row: AccountRequest }) {
  const label = OUTCOME_LABEL[row.outcome];
  const tone = OUTCOME_TONE[row.outcome];
  const when = `${formatStamp(row.at)} · ${ago(row.at)}`;
  const closed = row.closedAt ? ` · closed ${formatStamp(row.closedAt)}` : "";

  if (row.kind === "appeal") {
    const found = findItemById(row.id);
    const status = found ? decisionStatus(found.item, appealFor(found.item.id)) : null;
    return (
      <LinkRow
        href={
          found
            ? `/settings/account-status/${found.section.id}/${found.item.id}`
            : "/settings/account-status"
        }
        title={`Appeal — ${found?.item.title ?? "a decision no longer on your account"}`}
        sub={`${when} · ${OUTCOME_SENTENCE[row.outcome]}`}
        right={status?.word ?? label}
      />
    );
  }

  return (
    <StaticRow
      title={KIND_LABEL[row.kind]}
      sub={`${when}${closed} — ${OUTCOME_SENTENCE[row.outcome]}`}
      right={<span className={tone}>{label}</span>}
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
