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

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Field, PILL_BASE, PILL_FILL, Sheet, SheetActions, Spinner, Textarea, cn } from "@/components/ig-ui";
import { ProfilePicture } from "@/components/profile-picture";
import { Prose, StatementActions, StatementScreen } from "@/components/statement";
import { SupportPill } from "@/lib/support";
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
  loadAccountState,
} from "@/lib/account-lifecycle";
import { endSessionAndLeave } from "@/lib/session";
import { ago, formatDate, formatStamp } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import { useToast } from "@/lib/use-toast";
import { trackError, trackEvent, withRef } from "@/lib/telemetry";

/** One sentence in is enough to read, but not enough to review. */
const MIN_CHARS = 40;
const MAX_CHARS = 900;

export function AccountLockScreen() {
  const { lock, loading, failed } = useAccountLock();
  const welcome = useWelcome();

  return (
    <div className="bg-bg">
      {/* The first read hasn't answered, so this screen doesn't yet know which
          of itself it is. It is shown by the gate for any path, which is the
          one moment where the account's state is genuinely unknown — and a
          dashboard is the wrong thing to render into an unknown. */}
      {!lock && !welcome && loading ? <Checking /> : null}
      {/* The read did not answer and there is nothing cached to fall back on.
          Showing the dashboard here would be the gate failing open, so the
          account is held at a door that says it could not ask. */}
      {!lock && !welcome && failed ? <CouldNotRead /> : null}
      {lock?.kind === "deactivated" ? <Deactivated lock={lock} /> : null}
      {lock?.kind === "deletion" ? <Deletion lock={lock} /> : null}
      {lock?.kind === "restriction" ? <Restricted lock={lock} /> : null}
      {lock && (lock.kind === "banned" || lock.kind === "suspended" || lock.kind === "deleted") ? (
        <Blocked lock={lock} />
      ) : null}
      {/* A lock that has just been lifted is the only thing on this screen
          while the account is otherwise open. */}
      {!lock && !failed && welcome ? <BackAgain welcome={welcome} /> : null}
    </div>
  );
}

/** The first read hasn't answered yet. It's a moment, not a page — a ring and
    one line saying what it is waiting for. The line matters: a bare spinner on
    an empty screen reads as a page that broke, and the reader has nothing to
    decide about. It is also bounded now — the read gives up at six seconds and
    becomes `CouldNotRead` below, which has actions. */
function Checking() {
  return (
    <div
      className="grid min-h-dvh place-items-center px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner size={26} />
        <p className="text-[13.5px] leading-none">Loading…</p>
      </div>
    </div>
  );
}

/** The account-state read failed. Say so, offer the two things that can
    actually move it: ask again, or leave this device's session. */
function CouldNotRead() {
  const [busy, setBusy] = useState(false);
  return (
    <StatementScreen
      title="We couldn't read your account"
      lead="The network or the account did not answer, so nothing here can say which state the account is in. Until it does, this is the only page it opens."
      blocks={[
        {
          label: "What you can do",
          body: <Prose>Try again below. If it keeps failing, write to support — or sign out of this device and come back later.</Prose>,
        },
      ]}
      actions={
        <StatementActions
          primary={
            <Full
              label={busy ? "Trying again…" : "Try again"}
              busy={busy}
              onClick={async () => {
                setBusy(true);
                await loadAccountState();
                setBusy(false);
              }}
            />
          }
          secondary={[
            <SupportPill
              subject="Account state could not be read"
              lines={["Account state: unknown — the account-state read failed"]}
            />,
          ]}
          quiet={<SignOutPill />}
        />
      }
    />
  );
}

/* ── The one screen they are all built from ─────────────────────── */

/** Every action on this screen is a write to the account followed by a re-read
 *  of it. One runner holds all three halves of that — the busy flag that stops
 *  a second press, the catch that says why it failed, and the success buzz —
 *  because each screen used to hold its own `try/finally` and several of them
 *  forgot the `catch`, which left a failed reactivation with no message at all
 *  and a button that looked idle. */
function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run<T>(doWrite: () => Promise<T>, said: string): Promise<T | null> {
    if (busy) return null;
    setBusy(true);
    try {
      const value = await doWrite();
      haptic("success");
      toast.success(said);
      return value;
    } catch (err) {
      trackError("account-lock.action", err);
      haptic("error");
      toast.error(withRef(err instanceof Error && err.message ? err.message : "That didn't go through. Try again.", err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}

function Full({
  label,
  onClick,
  busy = false,
  tone = "primary",
}: {
  label: string;
  onClick: () => void;
  /** The label already says "Doing…"; this stops the second press behind it. */
  busy?: boolean;
  tone?: keyof typeof PILL_FILL;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() => {
        if (busy) return;
        haptic(tone === "outline" ? "light" : "medium");
        onClick();
      }}
      className={cn(PILL_BASE, PILL_FILL[tone], busy && "opacity-60")}
    >
      {busy ? <Spinner size={17} /> : null}
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
      onClick={() => {
        haptic("light");
        onClick();
      }}
    >
      {label}
    </Button>
  );
}

/** The locked screen is the only page the account opens, so it has to hold the
    way out of it: the rail's sign-out is unreachable behind the gate, and
    without this a closed account is stranded on its own closure screen. */
function SignOutPill() {
  return <Plain label="Sign out of this device" onClick={endSessionAndLeave} />;
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
  const { busy, run } = useAction();

  async function comeBack() {
    /* The write re-reads the account, which repaints this screen from a
       snapshot that no longer says "deactivated". Whatever the hand-off screen
       needs is taken before the write, not after. */
    const from = record?.at ?? Date.now();
    if (!await run(() => apiReactivate(), "Your account is open again")) return;
    trackEvent("settings.account_reactivated", { detail: "lock_screen" });
    writeWelcome({ kind: "reactivated", at: Date.now(), from });
  }

  return (
    <StatementScreen
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
      actions={
        <StatementActions
          primary={<Full label={busy ? "Reactivating…" : "Reactivate now"} busy={busy} onClick={comeBack} />}
          secondary={[
            <SupportPill
              
              subject={`Paused account — ref ${getAccountState()?.refCode ?? "none"}`}
              lines={[
                `Event reference: ${getAccountState()?.refCode ?? "none"}`,
                "Account state: paused (self-deactivated)",
                record ? `Paused on: ${formatStamp(record.at)}` : null,
              ]}
            />,
          ]}
          quiet={<SignOutPill />}
        />
      }
    />
  );
}

/* ── 2. A deletion already asked for ───────────────────────────── */

function Deletion({ lock }: { lock: Lock }) {
  const account = getAccountState();
  const finalAtMs = account?.deletionFinalAt ? Date.parse(account.deletionFinalAt) : null;
  /* The window is a fixed 30 days from the request, so the request moment is
     the final date minus that. */
  const asked = finalAtMs != null ? finalAtMs - GRACE_DAYS * 86_400_000 : Date.now();
  const { busy, run } = useAction();

  async function keepIt() {
    if (!await run(() => apiCancelDeletion(), "The deletion is called off")) return;
    trackEvent("settings.account_deletion_cancelled", { detail: "lock_screen" });
    writeWelcome({ kind: "deletion-cancelled", at: Date.now(), from: asked });
  }

  const left = finalAtMs != null ? remaining(finalAtMs, Date.now()) : null;
  const refCode = account?.refCode ?? null;
  const supportLines = [
    `Event reference: ${refCode ?? "none"}`,
    "Account state: scheduled for deletion",
    `Asked for on: ${formatStamp(asked)}`,
    finalAtMs != null ? `Final on: ${formatDate(finalAtMs)}` : "Final date: missing from the account record",
  ];

  if (finalAtMs == null) {
    return (
      <StatementScreen
        title={lock.title}
        lead="Nothing has been deleted yet, but the account hasn’t given the date the deletion would run."
        blocks={[
          {
            label: "Why this happened",
            body: <Prose>You asked for this account to be closed. Nothing else asked for it and nothing has run.</Prose>,
          },
          {
            label: "What you can do",
            body: <Prose>Reload to ask the account again, or keep it open below — cancelling works either way.</Prose>,
          },
        ]}
        actions={
          <StatementActions
            primary={<Full label={busy ? "Cancelling…" : "Keep my account"} busy={busy} onClick={keepIt} />}
            secondary={[<SupportPill subject="Scheduled deletion — no final date" lines={supportLines} />]}
            quiet={<SignOutPill />}
          />
        }
      />
    );
  }

  const when = left?.done
    ? `The window ran out on ${formatDate(finalAtMs)}`
    : `Final on ${formatDate(finalAtMs)} · ${left!.days} ${left!.days === 1 ? "day" : "days"} left`;

  return (
    <StatementScreen
      title={lock.title}
      lead="Nothing has been deleted yet. You can stop it below."
      meta={`Asked for on ${formatStamp(asked)} · ${when}`}
      blocks={[
        {
          label: "Why this happened",
          body: <Prose>You asked for this account to be closed on {formatStamp(asked)}.</Prose>,
        },
        {
          label: "What this means",
          body: (
            <Prose>
              Unless you stop it, the account and everything saved to it are permanently deleted on{" "}
              {formatDate(finalAtMs)}. Until then, nothing has been removed.
            </Prose>
          ),
        },
        {
          label: "What you can do",
          body: (
            <Prose>
              Keep the account open below. The request is forgotten; asking again later starts a
              fresh {GRACE_DAYS}-day window.
            </Prose>
          ),
        },
      ]}
      actions={
        <StatementActions
          primary={<Full label={busy ? "Cancelling…" : "Keep my account"} busy={busy} onClick={keepIt} />}
          secondary={[<SupportPill subject={`Scheduled deletion — ref ${refCode ?? "none"}`} lines={supportLines} />]}
          quiet={<SignOutPill />}
        />
      }
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
  const { busy, run } = useAction();

  if (!decision) return null;
  const { section, item } = decision;
  const status = decisionStatus(item, appealRow);

  function carryOn() {
    skipRestriction(item.id);
    trackEvent("settings.restriction_acknowledged", { metadata: { decision: item.id } });
    haptic("light");
    toast.success("Marked as read — carry on");
    router.replace("/settings");
  }

  async function send(note: string) {
    /* The event reference rides along inside the note, so the reviewer (and
       the admin ref lookup) can pull the exact record behind the decision. */
    const ref = getAccountState()?.refCode;
    const fullNote = `${ref ? `[ref ${ref} · decision ${item.id}] ` : `[decision ${item.id}] `}${note}`.slice(0, MAX_CHARS);
    const filed = await run(
      () => appeal(item.id, fullNote),
      "Review requested — we'll answer under Account status",
    );
    if (!filed) return;
    /* An appeal is an answer, so it clears the stop the same way reading the
       decision does. Both leave the decision itself on file — now on the
       account, where a review server can answer it. */
    skipRestriction(item.id);
    setAppealRow(filed);
    setSheetOpen(false);
    trackEvent("settings.appeal_filed", { metadata: { decision: item.id, appeal: filed.id } });
    router.replace("/settings");
  }

  return (
    <>
      <StatementScreen
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
          <StatementActions
            primary={
              appealRow ? (
                <Full label="I've read this — carry on" onClick={carryOn} />
              ) : (
                <Full label="Appeal this decision" onClick={() => setSheetOpen(true)} />
              )
            }
            secondary={[
              /* Setting the decision aside is the choice most readers of a
                 notice actually want, so it is a button beside support rather
                 than a word under it — once it has been taken, the loud row
                 above is the same thing, and saying it twice would be noise. */
              appealRow ? null : (
                <Full tone="outline" label="I've read this — carry on" onClick={carryOn} />
              ),
              <SupportPill
                subject={`Account decision — ref ${getAccountState()?.refCode ?? "none"}`}
                lines={[
                  `Event reference: ${getAccountState()?.refCode ?? "none"}`,
                  `Decision: ${item.title}`,
                  `Decision id: ${item.id}`,
                  item.guideline ? `Rule applied: ${item.guideline}` : null,
                  item.at ? `Decided on: ${formatStamp(item.at)}` : null,
                ]}
              />,
            ]}
            quiet={<SignOutPill />}
          />
        }
        foot="Setting the decision aside stops it blocking the account; it stays listed under Account status."
      />

      {sheetOpen ? (
        <ReviewSheet ask={item.ask} busy={busy} onClose={() => setSheetOpen(false)} onFiled={send} />
      ) : null}
    </>
  );
}

/* ── 3b. A closure only the account can explain ────────────────────
   A ban, a suspension and a deletion read the same way on purpose: the
   reason, what it means for the data, and the one way out. What differs is
   the way out — a ban and a suspension can be appealed (both are decisions
   with a live restriction behind them), a deletion cannot, so it only offers
   support. Unlike a restriction, none of these can be set aside: they are
   closure, not a notice. */

function Blocked({ lock }: { lock: Lock }) {
  const account = getAccountState();
  const [appealRow, setAppealRow] = useState<Appeal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { busy, run } = useAction();

  const banned = lock.kind === "banned";
  const suspended = lock.kind === "suspended";
  const deleted = lock.kind === "deleted";
  const appealable = banned || suspended;
  /* The account says whether the live decision has already been appealed, so a
     reload cannot hand back a button for a second filing of the same decision —
     and a closure that was closed before this device ever opened it is shown as
     what it is: waiting on a review. */
  const filed = appealRow !== null || (account?.appealFiled ?? false);

  const refCode = account?.refCode ?? null;
  const reason = account?.reason ?? null;
  const untilMs = account?.until ? Date.parse(account.until) : null;
  const meta = untilMs
    ? suspended
      ? `Suspended until ${formatDate(untilMs)}`
      : `Ends ${formatDate(untilMs)}`
    : null;

  async function send(note: string) {
    /* The event reference rides inside the note so the reviewer (and the admin
       ref lookup) can pull the exact decision behind the closure. The decision
       row is named too — the API only falls back to "the latest live
       restriction" when a session can't say which decision it means. */
    const ref = getAccountState()?.refCode;
    const fullNote = `${ref ? `[ref ${ref}] ` : ""}${note}`.slice(0, MAX_CHARS);
    const row = await run(
      () => appeal(getAccountState()?.decisionId ?? "", fullNote),
      "Review requested — we'll answer under Account status",
    );
    if (!row) return;
    setAppealRow(row);
    setSheetOpen(false);
    trackEvent("settings.appeal_filed", { metadata: { scope: lock.kind, appeal: row.id } });
  }

  const supportLines = [
    `Event reference: ${refCode ?? "none"}`,
    `Account state: ${deleted ? "deleted" : banned ? "banned" : "suspended"}`,
    reason ? `Reason: ${reason}` : null,
    untilMs ? `Ends on: ${formatDate(untilMs)}` : null,
  ];

  return (
    <>
      <StatementScreen
        title={lock.title}
        lead={lock.sub}
        meta={meta}
        blocks={[
          {
            label: "Why this happened",
            body: reason ? (
              <Prose>{reason}</Prose>
            ) : (
              <Prose>
                A decision on this account closed access. Its reason is on the account record, and
                support can read it back to you.
              </Prose>
            ),
          },
          {
            label: "What this means",
            body: deleted ? (
              <Prose>The account and everything saved to it have been removed. Nothing here can bring it back.</Prose>
            ) : (
              <Prose>
                Nothing has been deleted. The account is simply closed to you until the decision
                changes — your details, choices and records are held exactly as they were.
              </Prose>
            ),
          },
          {
            label: "What you can do",
            body: appealable ? (
              filed ? (
                <Prose>Your appeal is filed and waiting on a review. Support can be reached below as well.</Prose>
              ) : (
                <Prose>Appeal the decision below, or write to support. A person reads every appeal.</Prose>
              )
            ) : (
              <Prose>Write to support using the button below — the account cannot be reopened from this screen.</Prose>
            ),
          },
        ]}
        actions={
          <StatementActions
            /* Nothing loud for a closure that cannot be undone from here: a
               deleted account has no action worth shouting, and support is the
               only way it can speak to anyone. */
            primary={
              appealable && !filed ? (
                <Full label="Appeal this decision" onClick={() => setSheetOpen(true)} />
              ) : null
            }
            secondary={[
              <SupportPill subject={`Closed account — ref ${refCode ?? "none"}`} lines={supportLines} />,
            ]}
            quiet={<SignOutPill />}
          />
        }
      />

      {sheetOpen ? (
        <ReviewSheet
          ask="What happened, in your own words — and what you think was misread."
          busy={busy}
          onClose={() => setSheetOpen(false)}
          onFiled={send}
        />
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
    <StatementScreen
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
      actions={<StatementActions primary={<Full label="Done" onClick={done} />} />}
      foot="This screen only tells you what already happened — the account reopened the moment you pressed the button on the page before it."
    />
  );
}

function ReviewSheet({
  ask,
  busy = false,
  onClose,
  onFiled,
}: {
  ask: string;
  busy?: boolean;
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
          confirmLabel={busy ? "Sending…" : "Send appeal"}
          loading={busy}
          onConfirm={() => { if (!busy) onFiled(trimmed); }}
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
