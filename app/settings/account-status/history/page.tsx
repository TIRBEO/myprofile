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
import {
  ACCOUNT_EVENT,
  type AccountState,
  useAccountState,
} from "@/lib/account-lifecycle";
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
import { apiJson } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════════
   Requests and history

   Everything here is read from the account, not from this browser: the
   pause or close still in force comes from the lifecycle row, and a review
   filed here is the same row an admin answers and the same row a second
   device lists. Nothing is claimed to be open that the account doesn't
   agree is open — which is why the old per-device log of these went away.

   Under the list sits the other half of the question — the decisions that
   are still waiting on an answer from you. That's the list a good standing
   page can't show, because needing an answer and being in trouble aren't
   the same thing. When both lists are empty, they say so quietly.
   ═══════════════════════════════════════════════════════════════════ */

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

/* ── The full request ledger ───────────────────────────────────────
   Everything the account has been asked to do, read from the brain: the
   activity rows the actions write (codes mailed, pauses, closings, appeals)
   and the export table beside them, merged newest-first by
   `GET /api/user/requests`. The rows above say what is in force *now*;
   this says what was ever asked for. */

type RequestRow = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  status: string | null;
  at: string;
};

const REQUEST_WORDS: Record<string, string> = {
  "account.deactivated": "Deactivation",
  "account.reactivated": "Reactivation",
  "account.delete-code": "Deletion code requested",
  "account.delete-request": "Account deletion",
  "account.deletion-cancelled": "Deletion cancelled",
  "security.deletion_scheduled": "Deletion scheduled",
  "security.deletion_cancelled": "Deletion called off",
  "appeal.filed": "Appeal filed",
  "account.merge": "Accounts merged",
  "data.download": "Data download",
};

const REQUEST_STATUS: Record<string, { word: string; cls: string }> = {
  pending: { word: "Building…", cls: "text-warn-text" },
  ready: { word: "Ready", cls: "text-success-text" },
  failed: { word: "Failed", cls: "text-danger-text" },
};

function requestWords(row: RequestRow): { title: string; sub: string; right: string | null } {
  const at = Date.parse(row.at);
  const when = `${formatStamp(at)} · ${ago(at)}`;
  const title = REQUEST_WORDS[row.kind] ?? row.title;
  if (row.kind === "data.download") {
    const st = row.status ? REQUEST_STATUS[row.status] : null;
    return {
      title,
      sub: [row.detail || (row.status === "pending" ? "Being prepared" : "Archive"), when]
        .filter(Boolean)
        .join(" — "),
      right: st?.word ?? null,
    };
  }
  return { title, sub: row.detail ? `${row.detail} — ${when}` : when, right: null };
}

export default function AccountHistoryPage() {
  const { state, loading } = useAccountState();
  const [waiting, setWaiting] = useState<Pending[] | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);

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
    apiJson<{ requests?: RequestRow[] }>("/api/user/requests?limit=50")
      .then((r) => setRequests(Array.isArray(r.requests) ? r.requests : []))
      .catch(() => setRequests([]));
    window.addEventListener(ACCOUNT_EVENT, look);
    return () => window.removeEventListener(ACCOUNT_EVENT, look);
  }, [look]);

  const rows = state ? inForce(state) : [];
  const waitingReview = appeals.some((row) => (row.decision ?? "pending") === "pending");
  const inForceWords = rows.map((row) => row.title.toLowerCase());
  if (waitingReview) inForceWords.push("an appeal under review");

  if (!waiting || (loading && !state)) return <PageSkeleton title="Requests and history" sections={3} />;

  return (
    <SettingsPage title="Requests and history">
      <Helper lead tone={inForceWords.length ? "danger" : "ok"}>
        {inForceWords.length
          ? `In force right now: ${inForceWords.join(", ")}.`
          : "Nothing of yours is open — no pause running, no deletion scheduled, no review in."}
      </Helper>

      <SectionTitle>What you&apos;ve asked for</SectionTitle>
      {rows.length ? (
        <Group>
          {rows.map((row) => (
            <StaticRow
              key={row.title}
              title={row.title}
              sub={row.sub}
              right={<span className="text-warn-text">{row.right}</span>}
            />
          ))}
        </Group>
      ) : (
        <p className="max-w-[58ch] text-[14px] leading-relaxed text-muted">
          {state
            ? "Nothing is paused and no deletion is scheduled — either one puts a row here the moment you ask for it."
            : "The account hasn’t answered, so nothing here can claim to be in force."}
        </p>
      )}

      <SectionTitle>Every request on record</SectionTitle>
      {requests && requests.length ? (
        <Group>
          {requests.map((row) => {
            const w = requestWords(row);
            return (
              <StaticRow
                key={`${row.kind}-${row.id}`}
                title={w.title}
                sub={w.sub}
                right={w.right ? <span className={REQUEST_STATUS[row.status ?? ""]?.cls ?? "text-muted"}>{w.right}</span> : undefined}
              />
            );
          })}
        </Group>
      ) : (
        <p className="max-w-[58ch] text-[14px] leading-relaxed text-muted">
          {requests
            ? "You haven’t asked the account for anything yet — downloads, pauses, codes and appeals all leave a row here."
            : "The account is still answering, so the ledger cannot promise what it hasn’t heard."}
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

/* ── What the account says is in force ──────────────────────────
   The lifecycle row is the only record a pause or a scheduled close has, so
   this list can't claim a deactivation that was already signed out of, nor a
   deletion called off on another device. Appeals come from the account too —
   see the Appeals list below. */

type ForceRow = { title: string; sub: string; right: string };

function inForce(state: AccountState): ForceRow[] {
  const rows: ForceRow[] = [];
  if (state.deactivated) {
    const at = state.deactivatedAt ? Date.parse(state.deactivatedAt) : null;
    rows.push({
      title: "Deactivation",
      sub: [
        at ? `Paused ${formatStamp(at)} · ${ago(at)}` : "Paused",
        state.deactivatedReason ? `“${state.deactivatedReason}”` : null,
        "Signing back in is the only undo",
      ]
        .filter(Boolean)
        .join(" — "),
      right: "In force",
    });
  }
  if (state.deletionPending) {
    const at = state.deletionFinalAt ? Date.parse(state.deletionFinalAt) : null;
    rows.push({
      title: "Account deletion",
      sub: [
        at ? `Closes ${formatStamp(at)}` : "Scheduled",
        state.refCode ? `Ref ${state.refCode}` : null,
        "Cancelled by signing in and calling it off",
      ]
        .filter(Boolean)
        .join(" — "),
      right: "In force",
    });
  }
  return rows;
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
