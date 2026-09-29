"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import {
  type Appeal,
  type StatusItem,
  type StatusSection,
  decisionStatus,
  findSection,
  readAppeals,
} from "@/lib/account-status";
import { formatDate } from "@/lib/dates";

/* ═══════════════════════════════════════════════════════════════════
   One account-status check, in full

   Reached from the answer page, so this screen is just the list: one row
   per decision, what was decided as the title, the date and the rule it
   came from as the muted line under it, and the current status on the
   right. A decision someone is still looking at, or that's open to you,
   reads in a different colour from one that's settled. Tapping a row opens
   the detail and the way to ask for a review.
   ═══════════════════════════════════════════════════════════════════ */

export default function StatusSectionPage() {
  const params = useParams<{ section: string }>();
  const [state, setState] = useState<{ section: StatusSection | null; appeals: Appeal[] } | null>(
    null,
  );

  useEffect(() => {
    setState({ section: findSection(params.section), appeals: readAppeals() });
  }, [params.section]);

  if (state === null) return <PageSkeleton title="Account status" sections={2} />;

  // A typed-in id that isn't one of the checks has nothing to list, so it says
  // so and leaves the way back to the shell's own back link.
  if (!state.section) {
    return (
      <SettingsPage title="Account status">
        <p className="mt-1 max-w-[58ch] text-[14px] leading-relaxed text-muted">
          That check doesn&apos;t exist. Account status lists its checks on one page — pick the one
          you meant.
        </p>
      </SettingsPage>
    );
  }

  const section = state.section;
  const clean = section.severity === "ok";

  return (
    <SettingsPage title={section.title}>
      <p className="mt-1 mb-2 max-w-[58ch] text-[14px] leading-relaxed text-muted">
        {section.summary}
      </p>

      {clean ? (
        <p className="mt-4 max-w-[58ch] text-[14px] leading-relaxed text-muted">
          Nothing has been decided here. If that changes, the decision appears in this list with the
          date it was made.
        </p>
      ) : (
        <>
          <SectionTitle>Decisions</SectionTitle>
          <Group>
            {section.items.map((item) => (
              <LinkRow
                key={item.id}
                href={`/settings/account-status/${section.id}/${item.id}`}
                title={item.title}
                sub={`${formatDate(item.at)} · ${item.guideline}`}
                right={
                  <DecisionStatus
                    item={item}
                    appeal={state.appeals.find((row) => row.id === item.id) ?? null}
                  />
                }
              />
            ))}
          </Group>

          <Helper>
            One request per decision. Until it&apos;s answered there&apos;s nothing else to do here,
            and asking twice doesn&apos;t move it up the queue.
          </Helper>
        </>
      )}
    </SettingsPage>
  );
}

const STATUS_TONE = {
  warn: "text-warn-text",
  danger: "text-danger-text",
  muted: "text-muted",
};

function DecisionStatus({ item, appeal }: { item: StatusItem; appeal: Appeal | null }) {
  const { word, tone } = decisionStatus(item, appeal);
  return <span className={STATUS_TONE[tone]}>{word}</span>;
}
