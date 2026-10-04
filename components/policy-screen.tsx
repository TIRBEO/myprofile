"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  Helper,
  LinkRow,
  Panel,
  PillButton,
  PillStack,
  SettingsPage,
} from "@/components/settings-shell";
import { POLICIES, findPolicy } from "@/lib/help-policies";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   A policy, in full

   Reached from the documentation index, and set the same way an article is:
   the kind of document above the title, one line of facts under it, the
   plain-language summary as the lead, and the clauses themselves bare on the
   canvas under a hairline. Only the pointer to the other two is a box,
   because that one really is a list of links.
   ═══════════════════════════════════════════════════════════════════ */

/** The same arithmetic the articles use — two hundred words a minute, and
    never less than one, because "about 0 minutes" reads like a mistake. */
function minutesOf(lines: string[]) {
  const words = lines.join(" ").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function PolicyPage() {
  const params = useParams<{ slug: string }>();
  const policy = findPolicy(params.slug);

  if (!policy) {
    return (
      <SettingsPage
        title="Policy"
        crumb={
          <Link
            href="/settings/help"
 className="-mt-3 -mb-[4px] inline-flex max-w-full truncate py-3 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase outline-none transition-colors hover:text-fg"
          >
            Documentation
          </Link>
        }
      >
        <Helper lead>
          That policy isn&apos;t here. The documentation index lists the ones this build has.
        </Helper>
        <PillStack>
          <PillButton label="Back to documentation" href="/settings/help" tone="primary" />
        </PillStack>
      </SettingsPage>
    );
  }

  const others = POLICIES.filter((other) => other.slug !== policy.slug);
  const minutes = minutesOf(policy.lines);

  return (
    <SettingsPage
      title={policy.title}
      crumb={
        <Link
          href="/settings/help"
          onClick={() => haptic("light")}
 className="-mt-3 -mb-[4px] inline-flex max-w-full truncate py-3 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase outline-none transition-colors hover:text-fg"
        >
          Policy
        </Link>
      }
    >
      <header>
        <p className="text-[12.5px] font-medium text-muted">
          {policy.lines.length} {policy.lines.length === 1 ? "paragraph" : "paragraphs"}
          {" · about "}
          {minutes} {minutes === 1 ? "minute" : "minutes"}
          {" · the whole of it"}
        </p>

        {/* The summary is the first thing you read, so it's set as the lead —
            bare and a step larger, the way the articles set theirs. A grey
            block around it made the one paragraph you can't skip look like
            furniture. */}
        <p className="mt-5 max-w-[62ch] text-[16.5px] leading-[1.65] text-fg/90">
          {policy.description}
        </p>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.6] text-muted">{policy.sub}</p>
      </header>

      <div className="mt-8 flex flex-col gap-4 border-t border-divider pt-7">
        {policy.lines.map((line) => (
          <p
            key={line}
            className="max-w-[62ch] text-[15px] leading-[1.65] text-fg/85 break-words"
          >
            {line}
          </p>
        ))}
      </div>

      <Helper className="mt-7">
        This is the whole of it. There is no longer version, and nothing here is held back for a
        legal page you&apos;d have to leave the app to find.
      </Helper>

      <Panel
        className="mt-10"
        title="The other policies"
        sub="The other two are as short, and say what they do."
      >
        {others.map((other) => (
          <LinkRow
            key={other.slug}
            href={`/settings/help/policy/${other.slug}`}
            title={other.title}
            sub={other.sub}
          />
        ))}
      </Panel>

      <PillStack>
        <PillButton
          label="Write to support"
          href={`/settings/help/support?from=policy:${policy.slug}`}
          tone="primary"
        />
        <PillButton label="Back to documentation" href="/settings/help" tone="outline" />
      </PillStack>
    </SettingsPage>
  );
}
