"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, Sheet, SheetActions, Textarea, cn } from "@/components/ig-ui";
import { Group, Helper, PageSkeleton, PillButton, PillStack, SectionTitle, SettingsPage, StaticRow } from "@/components/settings-shell";
import { LoadFailed } from "@/components/page-loading";
import { ApiError } from "@/lib/api";
import {
  type Appeal,
  appeal,
  appealFor,
  decisionStatus,
  findItem,
  loadAccountChecks,
  loadAppeals,
} from "@/lib/account-status";
import { ago, formatDate } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { CircleAlert, Clock, ShieldQuestion } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   One decision, and the one action on it

   A header that names the decision and where it stands, the full account
   of what happened in a readable measure, every fact about it as a labelled
   line, then the single thing you can do: ask a person to look again. A
   review is a written explanation, so it opens a sheet with a box to type in
   rather than deciding on its own. The request goes to the account itself —
   it lives there, not on this device — and once it's filed the request is
   shown here and the button is gone: one request per decision.
   ═══════════════════════════════════════════════════════════════════ */

/** One sentence in is enough to read, but not enough to review. */
const MIN_CHARS = 40;
const MAX_CHARS = 900;

const STATUS_TONE = {
  warn: "text-warn-text",
  danger: "text-danger-text",
  muted: "text-muted",
};

const TONE_TILE = {
  warn: "bg-warn/12 text-warn-text",
  danger: "bg-danger/12 text-danger-text",
  muted: "bg-surface-2 text-muted",
};

export default function AccountStatusDetailPage({ section, item }: { section: string; item: string }) {
  const toast = useToast();
  const [found, setFound] = useState<ReturnType<typeof findItem> | null | undefined>(undefined);
  const [appealRow, setAppealRow] = useState<Appeal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filing, setFiling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setFound(undefined);
    setLoadError(null);
    Promise.all([loadAccountChecks(), loadAppeals().catch(() => [] as Appeal[])])
      .then(() => {
        const hit = findItem(section, item);
        setFound(hit);
        setAppealRow(hit ? appealFor(hit.item.id) : null);
      })
      .catch((err) => {
        setLoadError(
          err instanceof ApiError && err.message
            ? err.message
            : "This decision couldn't be read.",
        );
      });
  }, [section, item]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loadError)
    return <LoadFailed title="Account status" message={loadError} onRetry={refresh} />;

  if (found === undefined) return <PageSkeleton title="Account status" sections={2} />;

  if (!found) {
    return (
      <SettingsPage title="Account status">
        <p className="mt-1 max-w-[58ch] text-[14px] leading-relaxed text-muted">
          That decision isn&apos;t on your account. It may have been listed under a different check,
          or it has since been lifted.
        </p>
        <PillStack>
          <PillButton label="Back to account status" href="/settings/account-status" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const { section: record, item: decision } = found;
  const status = decisionStatus(decision, appealRow);

  async function send(note: string) {
    setFiling(true);
    try {
      const filed = await appeal(decision.id, note);
      setAppealRow(filed);
      setSheetOpen(false);
      haptic("success");
      toast.success("Review requested — we'll answer on this page");
      // The decision stops being appealable on the account now; re-read so
      // the lists agree with what was just filed.
      void loadAccountChecks().catch(() => {});
    } catch (err) {
      haptic("error");
      toast.error(
        err instanceof ApiError && err.message ? err.message : "The request couldn't be filed.",
      );
    } finally {
      setFiling(false);
    }
  }

  return (
    <SettingsPage title={record.title}>
      {/* ── The decision, left-aligned ── */}
      <section className="mt-6 flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            TONE_TILE[status.tone],
          )}
        >
          {status.tone === "muted" ? (
            <Clock className="size-[21px]" strokeWidth={1.9} />
          ) : status.tone === "warn" ? (
            <ShieldQuestion className="size-[21px]" strokeWidth={1.9} />
          ) : (
            <CircleAlert className="size-[21px]" strokeWidth={1.9} />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] leading-snug font-bold tracking-tight">{decision.title}</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {formatDate(decision.at)} · {ago(decision.at)}
          </p>
          <p className={cn("mt-0.5 text-[13px] leading-snug font-medium", STATUS_TONE[status.tone])}>
            {status.word}
          </p>
        </div>
      </section>

      {/* ── What happened, in one readable column ── */}
      <p className="mt-7 max-w-[58ch] text-[15px] leading-[1.7] text-fg/90">{decision.sub}</p>
      {decision.appealable && !appealRow ? (
        <p className="mt-4 max-w-[58ch] text-[14px] leading-relaxed text-muted">{decision.ask}</p>
      ) : null}

      {/* ── Every fact about it ── */}
      <SectionTitle>The record</SectionTitle>
      <Group>
        <StaticRow title="Rule applied" sub={decision.guideline} />
        <StaticRow title="Decision made" right={formatDate(decision.at)} />
        <StaticRow
          title="Review status"
          right={<span className={STATUS_TONE[status.tone]}>{status.word}</span>}
        />
      </Group>

      {/* ── The one action, or what's already been done ──
          Filed reads as the end of the task, so it gets the same shape every
          confirmation on this app uses: what happened, what you said, what
          comes next, then two ways out — never three pills to the same page. */}
      {appealRow ? (
        <>
          <Helper lead tone="ok">
            Under review — filed {ago(appealRow.at)}. The limit stays as it is until someone comes
            back to it.
          </Helper>

          <SectionTitle>What you said</SectionTitle>
          <Group>
            <div className="px-4 py-4 sm:px-5">
              <p className="max-w-[58ch] text-[15px] leading-relaxed whitespace-pre-wrap">
                {appealRow.note}
              </p>
              <p className="mt-3 text-[13px] text-muted">
                {formatDate(appealRow.at)} · this decision only · nothing else on the account was
                attached
              </p>
            </div>
          </Group>

          <SectionTitle>What happens next</SectionTitle>
          <Group>
            <Step
              n={1}
              title="A person reads your note"
              sub="Requests are read in the order they arrive. The account isn't held for you or delayed for anyone else."
            />
            <Step
              n={2}
              title="They look at the rule again"
              sub={decision.guideline}
            />
            <Step
              n={3}
              title="The answer appears on this page"
              sub="Nothing is emailed or messaged. Come back here — the status line above changes from “Under review” to whatever they decided."
            />
          </Group>

          <PillStack>
            <PillButton
              label="Back to account status"
              href={`/settings/account-status/${record.id}`}
              tone="primary"
            />
            <PillButton label="Back to documentation" href="/settings/help" tone="outline" />
          </PillStack>

          <Helper>
            You can ask for a review of this decision once, and this one is already in. If you
            realise you left something out, write it to support from the documentation pages and
            quote the decision — a person can read both together.
          </Helper>
        </>
      ) : decision.appealable ? (
        <>
          <PillStack>
            <PillButton label="Request a review" tone="primary" onClick={() => setSheetOpen(true)} />
          </PillStack>
          <Helper className="mt-4">
            One request per decision. A person reads what you write, looks at the rule again, and
            either lifts it or explains why it stands — you&apos;ll see the answer here.
          </Helper>
        </>
      ) : (
        <Helper className="mt-8">
          This one has no review left on it — the decision is final.
        </Helper>
      )}

      {sheetOpen ? (
        <ReviewSheet ask={decision.ask} busy={filing} onClose={() => setSheetOpen(false)} onFiled={send} />
      ) : null}
    </SettingsPage>
  );
}

/* ── The written explanation ─────────────────────────────────────── */

/** One of the three things that happen after a review is filed. Numbered,
    because "what happens next" is a queue and people want to know where
    they are in it. */
function Step({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3.5 px-4 py-4 sm:px-5">
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[12.5px] font-semibold text-muted tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{sub}</p>
      </div>
    </div>
  );
}

function ReviewSheet({
  ask,
  busy,
  onClose,
  onFiled,
}: {
  ask: string;
  busy: boolean;
  onClose: () => void;
  onFiled: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const short = trimmed.length < MIN_CHARS;

  return (
    <Sheet
      title="Request a review"
      description={ask}
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel={busy ? "Sending…" : "Send request"}
          onConfirm={() => onFiled(trimmed)}
          disabled={short || busy}
        />
      }
    >
      <div className="-mx-4 sm:-mx-5">
        <Field
          label="Your explanation"
          hint={
            short
              ? `${MIN_CHARS - trimmed.length} more characters before this can be read as an answer.`
              : "Only what you write here and the decision itself go to the reviewer. Nothing else on the account is attached."
          }
          action={
            <span className="text-[12px] tabular-nums text-muted">
              {trimmed.length}/{MAX_CHARS}
            </span>
          }
        >
          <Textarea
            value={note}
            maxLength={MAX_CHARS}
            rows={7}
            placeholder="What happened, in your own words — who was using the device, what you were doing, and what you think was misread."
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  );
}
