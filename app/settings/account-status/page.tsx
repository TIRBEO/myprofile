"use client";

import { useEffect, useState } from "react";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { type StatusSection, sections } from "@/lib/account-status";
import { ACCOUNT_EVENT, countRequests } from "@/lib/account-history";

/* ═══════════════════════════════════════════════════════════════════
   Account status

   The question this page answers is a yes-or-no one — "am I in trouble?"
   — so it leads with that answer as a single plain line, then a flat list
   of the checks behind it. Each row carries its own status on the right so
   you can see, before opening anything, which parts of the account a
   decision touches. The detail, the rule it was judged against and the way
   to contest it all live one tap down, where they don't crowd the answer.
   ═══════════════════════════════════════════════════════════════════ */

export default function AccountStatusPage() {
  const [data, setData] = useState<StatusSection[] | null>(null);

  useEffect(() => {
    setData(sections());
  }, []);

  if (!data) return <PageSkeleton title="Account status" sections={5} />;

  const open = data.reduce((n, s) => n + s.items.length, 0);

  return (
    <SettingsPage title="Account status">
      <Helper lead>
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
