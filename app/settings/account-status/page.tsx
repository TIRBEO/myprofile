"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { LoadFailed } from "@/components/page-loading";
import { ApiError } from "@/lib/api";
import { AccountLevel } from "@/lib/account-level";
import { type StatusSection, loadAccountChecks } from "@/lib/account-status";
import { usePageRefresh } from "@/lib/page-refresh";
import { ACCOUNT_EVENT, countRequests } from "@/lib/account-history";

/* ═══════════════════════════════════════════════════════════════════
   Account status

   The page leads with the account's own status number and its five real
   checks, both read from the brain (/api/user/account-checks) — never
   guessed, never invented, never cached from another account. Zero on a
   check is the quiet answer it deserves: a plain all-clear line, not an
   alarming row. A count only moves when a genuine decision lands on the
   account. 0 is a real, calm state: nothing has been flagged, nothing is
   on hold. Only an admin raises the number, so there is deliberately no
   control for it here — the person sees it, nobody here can change it.
   While the read is in flight the page shows its skeleton from the
   server's shapes and paints no defaults; a failed read says so and
   offers the way to ask again.

   Under the number sits the question this page has always answered —
   "am I in trouble?" — as a single plain line, then a flat list of the
   checks behind it. Each row carries its own status on the right so
   you can see, before opening anything, which parts of the account a
   decision touches. The detail, the rule it was judged against and the
   way to contest it all live one tap down, where they don't crowd the
   answer.
   ═══════════════════════════════════════════════════════════════════ */

export default function AccountStatusPage() {
  const [data, setData] = useState<StatusSection[] | null>(null);
  const [status, setStatus] = useState<AccountLevel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus(null);
    setData(null);
    setLoadError(null);
    loadAccountChecks()
      .then(({ level, sections }) => {
        setStatus({ level, updatedAt: null, updatedBy: null });
        setData(sections);
      })
      .catch((err) => {
        setLoadError(
          err instanceof ApiError && err.message
            ? err.message
            : "Your account status couldn't be read.",
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(load);

  if (loadError)
    return <LoadFailed title="Account status" message={loadError} onRetry={load} />;

  if (!data || !status) return <PageSkeleton title="Account status" sections={5} />;

  const open = data.reduce((n, s) => n + s.items.length, 0);
  const flagged = status.level > 0;

  return (
    <SettingsPage title="Account status">
      {/* The number, and what it means, before anything else. */}
      <Helper lead tone={flagged ? "warn" : "ok"}>
        {flagged
          ? `Status level ${status.level} — a Tirbeo admin has flagged something on your account. The checks below say what.`
          : "Status 0 — nothing is flagged on your account. That's the normal state, not a hold: no decision about this account is waiting on anyone."}
      </Helper>

      <Group>
        <StaticRow
          title="Account status"
          sub="A number Tirbeo's admins set — it starts at 0 and only moves when they decide something about this account."
          right={<StatusLevel level={status.level} />}
        />
      </Group>

      <Helper>
        {open
          ? `${open} ${open === 1 ? "decision" : "decisions"} on your account, each about a specific sign-in, check or feature.`
          : "Your account is in good standing — nothing is limited, nothing is on hold."}
      </Helper>

      <SectionTitle>The checks behind the answer</SectionTitle>
      <Group>
        {data.map((section) => (
          <LinkRow
            key={section.id}
            href={`/settings/account-status/${section.id}`}
            title={section.title}
            sub={section.summary}
            right={<SectionStatus section={section} />}
          />
        ))}
      </Group>

      <SectionTitle>Your requests</SectionTitle>
      <Group>
        <LinkRow
          href="/settings/account-status/history"
          title="Requests and history"
          sub="Every pause, deletion and review you've filed, and what became of each."
          right={<OpenRequests />}
        />
      </Group>
    </SettingsPage>
  );
}

/** The stored number itself, shown as its own answer. 0 reads calmly — it
    is the decided-free state, not an absence — so it gets a quiet label
    rather than a warning colour or a dash. */
function StatusLevel({ level }: { level: number }) {
  if (level === 0) return <span className="text-success-text">0 · nothing flagged</span>;
  return <span className="text-warn-text">{level} · flagged by an admin</span>;
}

/** The count that matters on that row: how much of what you asked for is
    still in force, because that's what the app is still held at. */
function OpenRequests() {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    const look = () => setOpen(countRequests().open);
    look();
    window.addEventListener(ACCOUNT_EVENT, look);
    return () => window.removeEventListener(ACCOUNT_EVENT, look);
  }, []);
  if (!open) return null;
  return <span className="text-warn-text">{open} open</span>;
}

/* The short status value on the right of a section row: a word when there's
   nothing to do, a count of the decisions when there is. */
function SectionStatus({ section }: { section: StatusSection }) {
  if (section.severity === "ok") return <span className="text-success-text">All clear</span>;
  return (
    <span className={section.severity === "action" ? "text-danger-text" : "text-warn-text"}>
      {section.items.length}
    </span>
  );
}
