"use client";

/* ═══════════════════════════════════════════════════════════════════
   The screen a locked account sees

   When something has shut the account, this replaces the whole settings
   area — no rail, no search, no back chevron, nothing to wander into.
   That's deliberate: a page that explains a stop while letting you carry on
   browsing would just be a banner, and the point of these three states is
   that the account genuinely isn't open.

   Built the same way the account's records are: your face at the top of the
   column, the state of it in one line under that, then the sentences behind
   hairlines — why this happened, what it means, what you can do — and the
   one action held to the bottom of the screen so it is there whatever
   you're looking at. An icon of a banned sign in the corner made an account
   stop look like a dialog; the face is the thing you came to check on.

   Coming back out of a pause, or calling off a deletion, ends on the fourth
   screen here — the account open again, said on a page of its own instead of
   in a toast at the bottom of the settings.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Field, PILL_BASE, PILL_FILL, Sheet, SheetActions, Textarea, cn } from "@/components/ig-ui";
import { ProfilePicture } from "@/components/profile-picture";
import { Prose, StatementBody, StatementHead, StatementSection } from "@/components/statement";
import {
  clearWelcome,
  skipRestriction,
  useAccountLock,
  useWelcome,
  writeWelcome,
  type Lock,
  type Welcome,
} from "@/lib/account-state";
import { type Appeal, appeal, appealFor, decisionStatus } from "@/lib/account-status";
import { GRACE_DAYS, remaining } from "@/lib/delete-account";
import {
  apiCancelDeletion,
  apiReactivate,
  getAccountState,
} from "@/lib/account-lifecycle";
import { ago, formatDate, formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import { useToast } from "@/lib/use-toast";

/** One sentence in is enough to read, but not enough to review. */
const MIN_CHARS = 40;
const MAX_CHARS = 900;

export function AccountLockScreen() {
  const lock = useAccountLock();
  const welcome = useWelcome();

  return (
    <div className="bg-bg">
      {/* No header on purpose. There is nowhere above this page to go back to. */}
      {lock?.kind === "deactivated" ? <Deactivated lock={lock} /> : null}
      {lock?.kind === "deletion" ? <Deletion lock={lock} /> : null}
      {lock?.kind === "restriction" ? <Restricted lock={lock} /> : null}
      {/* A lock that has just been lifted is the only thing this screen shows
          while the account is otherwise open. */}
      {!lock && welcome ? <BackAgain welcome={welcome} /> : null}
    </div>
  );
}

/* ── The one screen they are all built from ─────────────────────── */

function Screen({
  title,
  lead,
  meta,
  hero,
  mark,
  blocks,
  actions,
  foot,
}: {
  title: string;
  lead: React.ReactNode;
  /** The dated line under the headline — when this began. */
  meta?: React.ReactNode;
  /** The one number that matters, larger than any text around it. */
  hero?: React.ReactNode;
  /** What sits at the top of the column: the face, or the ringed tick. */
  mark?: React.ReactNode;
  blocks: { label: string; body: React.ReactNode }[];
  actions: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-[560px] flex-1 px-5 pt-1 pb-10 sm:px-6 sm:pt-3">
        <StatementHead title={title} sub={lead} meta={meta} hero={hero} mark={mark} />

        <StatementBody>
          {blocks.map((block) => (
            <StatementSection key={block.label} label={block.label}>
              {block.body}
            </StatementSection>
          ))}
        </StatementBody>

        {foot ? <Prose className="mt-8 text-[12.5px] leading-relaxed text-muted">{foot}</Prose> : null}
      </div>

      {/* The action stays put while the explanation scrolls behind it, so
          there is never a moment where you've read this far and can't act. */}
      <div className="sticky bottom-0 border-t border-divider bg-bg/92 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">{actions}</div>
      </div>
    </div>
  );
}

function Full({
  label,
  onClick,
  tone = "primary",
}: {
  label: string;
  onClick: () => void;
  tone?: keyof typeof PILL_FILL;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic(tone === "outline" ? "light" : "medium");
        onClick();
      }}
      className={cn(PILL_BASE, PILL_FILL[tone], "min-h-[50px] py-3.5 text-[15.5px]")}
    >
      <span className="min-w-0">{label}</span>
    </button>
  );
}

/** The second choice is a plain word, not a second button — one thing on the
    screen is allowed to be loud. */
function Plain({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="lg"
      onClick={() => {
        haptic("light");
        onClick();
      }}
    >
      {label}
    </Button>
  );
}

/** The face in the ring a reopened account puts around it, with the tick on
    the corner. The ring is an inline style because it's one fixed decorative
    gradient, not a colour anyone would theme. */
const RING = "conic-gradient(from 210deg, #feda44, #e1306c, #c13584, #7638fa, #517da2, #feda44)";

function BackMark() {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <span className="relative grid place-items-center rounded-full p-[3px]" style={{ background: RING }}>
      {/* The gap is its own ring of page background rather than a `ring` on the
          picture, because a box-shadow paints over the gradient it should sit
          inside. */}
      <span className="rounded-full bg-bg p-[3px]">
        <ProfilePicture photo={profile.photo} seed={profile.username} name={profile.name} size={80} />
      </span>
      <span
        aria-hidden
        className="absolute -right-0.5 -bottom-0.5 grid size-[30px] place-items-center rounded-full bg-accent text-accent-fg shadow-[0_0_0_3px_var(--bg)]"
      >
        <Check className="size-[15px]" strokeWidth={3} />
      </span>
    </span>
  );
}

/* ── 1. A pause you took ────────────────────────────────────────── */

function Deactivated({ lock }: { lock: Lock }) {
  /** The reason and the date come from the account, not this browser — so the
      screen says the same thing whoever opened it. */
  const account = getAccountState();
  const record = account?.deactivated
    ? { at: account.deactivatedAt ? Date.parse(account.deactivatedAt) : Date.now(), reason: account.deactivatedReason ?? "" }
    : null;
  const [busy, setBusy] = useState(false);

  async function comeBack() {
    setBusy(true);
    try {
      await apiReactivate();
      if (record) writeWelcome({ kind: "reactivated", at: Date.now(), from: record.at });
      haptic("success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={lock.title}
      lead={lock.sub}
      meta={record ? `Paused on ${formatStamp(record.at)}` : null}
      blocks={[
        record
          ? {
              label: "Why this happened",
              body: (
                <>
                  <Prose>You paused this account yourself on {formatStamp(record.at)}.</Prose>
                  {record.reason ? <Prose>The reason you gave: {record.reason}.</Prose> : null}
                </>
              ),
            }
          : {
              label: "Why this happened",
              body: <Prose>You paused this account yourself, from the settings.</Prose>,
            },
        {
          label: "What this means",
          body: (
            <>
              <Prose>
                Nothing was deleted. Your profile details, your saved choices and your records are
                held exactly where you left them, on the account.
              </Prose>
              <Prose>
                Every other device was signed out when the profile went away, so they&apos;ll need to
                sign in again once it&apos;s back.
              </Prose>
            </>
          ),
        },
        {
          label: "What you can do",
          body: (
            <Prose>
              Reactivate below. The account opens on the settings page it left, with the{" "}
              {GRACE_DAYS}-day deletion clock never having started.
            </Prose>
          ),
        },
      ]}
      actions={<Full label={busy ? "Reactivating…" : "Reactivate now"} onClick={comeBack} />}
      foot="Pausing is reversible for as long as you leave it paused — there's no window here and nothing expires."
    />
  );
}

/* ── 2. A deletion already asked for ───────────────────────────── */

function Deletion({ lock }: { lock: Lock }) {
  const account = getAccountState();
  const finalAtMs = account?.deletionFinalAt ? Date.parse(account.deletionFinalAt) : null;
  /* The window is a fixed 30 days from the request, so the request moment is
     the final date minus that — enough to draw how far the clock has run. */
  const asked = finalAtMs != null ? finalAtMs - GRACE_DAYS * 86_400_000 : Date.now();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  /* The countdown is the only thing on this screen that keeps moving, and
     it's allowed to: it is the reason the page exists. */
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (finalAtMs == null) return null;
  const left = remaining(finalAtMs, now);
  const gone = Math.min(1, Math.max(0, (now - asked) / (finalAtMs - asked)));

  async function keepIt() {
    setBusy(true);
    try {
      await apiCancelDeletion();
      writeWelcome({ kind: "deletion-cancelled", at: Date.now(), from: asked });
      haptic("success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={lock.title}
      lead={lock.sub}
      meta={`Asked for on ${formatStamp(asked)}`}
      hero={
        <div>
          {left.done ? (
            <p className="text-[22px] font-bold tracking-[-0.02em] text-danger-text">
              This close is now final
            </p>
          ) : (
            <p className="flex items-baseline justify-center gap-2">
              <span className="text-[52px] leading-none font-bold tabular-nums tracking-[-0.04em] text-danger-text">
                {left.days}
              </span>
              <span className="text-[15px] font-medium text-muted">
                {left.days === 1 ? "day left to change it" : "days left to change it"}
              </span>
            </p>
          )}
          <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full bg-danger transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.round(gone * 100)}%` }}
            />
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted tabular-nums">
            {left.done
              ? `The window ran out on ${formatDate(finalAtMs)}.`
              : `${left.hours}h ${left.minutes}m ${left.seconds}s · final on ${formatDate(finalAtMs)}`}
          </p>
        </div>
      }
      blocks={[
        {
          label: "Why this happened",
          body: (
            <Prose>
              You asked for this account to be closed on {formatStamp(asked)}. Nothing
              else asked for it and nothing has run yet.
            </Prose>
          ),
        },
        {
          label: "What this means",
          body: (
            <>
              <Prose>
                The {GRACE_DAYS}-day window is the only thing standing between that request and a
                permanent delete. Deleted so far: nothing.
              </Prose>
              <Prose>
                Until it&apos;s called off or the window runs out, this is the only page you can
                reach — no rail, no settings, no records.
              </Prose>
            </>
          ),
        },
        {
          label: "What you can do",
          body: (
            <Prose>
              Keep the account open below. That puts it back exactly as it was and the window is
              forgotten; asking again later starts a fresh one.
            </Prose>
          ),
        },
      ]}
      actions={<Full label={busy ? "Cancelling…" : "Keep my account"} onClick={keepIt} />}
      foot="Once the window runs out the account is deleted on the server, and there's no copy left to bring it back from."
    />
  );
}

/* ── 3. A decision that has to be read ─────────────────────────── */

function Restricted({ lock }: { lock: Lock }) {
  const router = useRouter();
  const toast = useToast();
  const decision = lock.decision;
  const [appealRow, setAppealRow] = useState<Appeal | null>(() =>
    decision ? appealFor(decision.item.id) : null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!decision) return null;
  const { section, item } = decision;
  const status = decisionStatus(item, appealRow);

  function carryOn() {
    skipRestriction(item.id);
    haptic("light");
    toast.success("Marked as read — carry on");
    router.replace("/settings");
  }

  async function send(note: string) {
    try {
      const filed = await appeal(item.id, note);
      /* An appeal is an answer, so it clears the stop the same way reading the
         decision does. Both leave the decision itself on file — now on the
         account, where a review server can answer it. */
      skipRestriction(item.id);
      setAppealRow(filed);
      setSheetOpen(false);
      haptic("success");
      toast.success("Review requested — we'll answer under Account status");
      router.replace("/settings");
    } catch (err) {
      haptic("error");
      toast.error(
        err instanceof Error && err.message ? err.message : "The appeal couldn't be filed.",
      );
    }
  }

  return (
    <>
      <Screen
        title={item.title}
        lead={item.sub}
        meta={`Decided on ${formatDate(item.at)} · ${ago(item.at)}`}
        blocks={[
          {
            label: "Why this happened",
            body: (
              <>
                <Prose>
                  A decision under {section.title.toLowerCase()} was made on {formatDate(item.at)} (
                  {ago(item.at)}).
                </Prose>
                <Prose>The rule applied: {item.guideline}.</Prose>
              </>
            ),
          },
          {
            label: "What this means",
            body: appealRow ? (
              <>
                <Prose>
                  You filed an appeal {ago(appealRow.at)} — the decision stands until a person comes
                  back to it.
                </Prose>
                <Prose className="text-fg/85">{status.word}</Prose>
              </>
            ) : (
              <Prose>
                The account is held where this decision reaches. It stays on file under Account
                status whatever you choose next.
              </Prose>
            ),
          },
          {
            label: "What you can do",
            body: <Prose>{item.ask}</Prose>,
          },
        ]}
        actions={
          appealRow ? (
            <>
              <Full label="I've read this — carry on" onClick={carryOn} />
              <Plain label="Follow it up under Account status" onClick={carryOn} />
            </>
          ) : (
            <>
              <Full label="Appeal this decision" onClick={() => setSheetOpen(true)} />
              <Plain label="I've read this — carry on" onClick={carryOn} />
            </>
          )
        }
        foot="Setting the decision aside doesn't lift it — it stops blocking the account, and the decision stays listed under Account status with anything you've filed against it."
      />

      {sheetOpen ? (
        <ReviewSheet ask={item.ask} onClose={() => setSheetOpen(false)} onFiled={send} />
      ) : null}
    </>
  );
}

/* ── 4. The account open again ─────────────────────────────────── */

function BackAgain({ welcome }: { welcome: Welcome }) {
  const router = useRouter();
  const paused = welcome.kind === "reactivated";

  function done() {
    clearWelcome();
    router.replace("/settings");
  }

  return (
    <Screen
      title={paused ? "You're back" : "Your account stays open"}
      lead={
        paused
          ? "The pause is over. The profile is public again and everything is where you left it."
          : "The deletion request has been called off, and the clock stopped with it."
      }
      meta={
        <>
          {paused ? "Paused on " : "Asked to close on "}
          {formatDate(welcome.from)} · {ago(welcome.from)}
        </>
      }
      mark={<BackMark />}
      blocks={[
        {
          label: "What this means",
          body: paused ? (
            <>
              <Prose>
                Nothing was deleted while the account was paused, and nothing had to be put back —
                it was all kept on this device, waiting for you to sign back in.
              </Prose>
              <Prose>
                Other devices and apps were signed out when the profile went away. They&apos;ll need
                your password again; nothing else about them changed.
              </Prose>
            </>
          ) : (
            <>
              <Prose>
                The {GRACE_DAYS}-day window only closes an account if it runs out. This one was
                called off inside it, so the deletion never ran and nothing was removed.
              </Prose>
              <Prose>
                The request stays in your account history as a thing you asked for and then drew
                back. That&apos;s the only trace of it.
              </Prose>
            </>
          ),
        },
        {
          label: "What you can do",
          body: paused ? (
            <Prose>
              Carry on from here. Pausing the account again, or closing it for good, both live under
              Account status whenever you want them.
            </Prose>
          ) : (
            <Prose>
              Carry on from here, with everything exactly as it was. Asking to close the account
              later starts a fresh {GRACE_DAYS}-day window.
            </Prose>
          ),
        },
      ]}
      actions={<Full label="Done" onClick={done} />}
      foot="This screen only tells you what already happened — the account reopened the moment you pressed the button on the page before it."
    />
  );
}

function ReviewSheet({
  ask,
  onClose,
  onFiled,
}: {
  ask: string;
  onClose: () => void;
  onFiled: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const short = trimmed.length < MIN_CHARS;

  return (
    <Sheet
      title="Appeal this decision"
      description={ask}
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel="Send appeal"
          onConfirm={() => onFiled(trimmed)}
          disabled={short}
        />
      }
    >
      <div className="-mx-4 sm:-mx-5">
        <Field
          label="Your explanation"
          hint={
            short
              ? `${MIN_CHARS - trimmed.length} more characters before this can be read as an answer.`
              : "Only what you write here and the decision itself go to the reviewer."
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
            placeholder="What happened, in your own words — and what you think was misread."
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  );
}
