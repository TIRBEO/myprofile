"use client";

import { useState } from "react";
import { Disclosure, Field, Sheet, SheetActions, Textarea } from "@/components/ig-ui";
import {
  Group,
  Helper,
  LinkRow,
  OptionRow,
  PageSkeleton,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
  SheetGroup,
  StaticRow,
} from "@/components/settings-shell";
import { REASONS } from "@/lib/deactivate";
import { GRACE_DAYS } from "@/lib/delete-account";
import { formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { apiDeactivate, apiReactivate, useAccountState } from "@/lib/account-lifecycle";


/* ═══════════════════════════════════════════════════════════════════
   Deactivate for a while

   The middle door, and the one people usually want: the profile leaves
   public view and every session ends, but nothing is written away. What
   you gave up is stated as a list, the thing you keep is stated once
   plainly, and there is exactly one red thing on the page — the
   deactivation itself, which asks once more in a sheet before it acts.
   Signing back in, here or anywhere, is the only undo there is, so
   coming back to this page while it's active shows the record and a
   plain reactivate instead of the form.
   ═══════════════════════════════════════════════════════════════════ */

const HIDDEN = [
  "Your profile page stops loading, for you and for anyone else",
  "Your username stays reserved — nobody else can take it",
  "Every device is signed out, including this one",
  "Nothing is deleted — it all returns the moment you sign in again",
];

const KEEP = [
  "Your username stays reserved — nobody else can take it",
  "Nothing is deleted — it all returns the moment you sign in again",
];

/** The one reason with room for more than a sentence. */
const OTHER = "Something else";
const NOTE_MAX = 240;

export default function DeactivatePage() {
  const { state, loading } = useAccountState();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  /* The record is the brain's, not a flag left in this browser: a device that
     never deactivated the account sees the same paused state. */
  const record = state?.deactivated
    ? { at: state.deactivatedAt ? Date.parse(state.deactivatedAt) : Date.now(), reason: state.deactivatedReason ?? "" }
    : null;

  if (loading) return <PageSkeleton title="Deactivate account" sections={2} />;

  /* A reason of "Something else" is a category with nothing in it, so that one
     waits for the note; every other reason stands on its own. */
  const canFile = !!reason && (reason !== OTHER || !!note.trim());

  /* The note goes with whichever reason it was written for, so the record
     reads as one sentence rather than a category and a stray paragraph. */
  function given() {
    const extra = note.trim();
    return reason && extra ? `${reason} — ${extra}` : reason;
  }

  async function doDeactivate() {
    setConfirm(false);
    setBusy(true);
    try {
      await apiDeactivate(given() || null);
      haptic("heavy");
      toast.error("Your profile is now hidden");
    } catch {
      toast.error("Couldn't deactivate the account — please try again");
    } finally {
      setBusy(false);
    }
  }

  async function doReactivate() {
    setBusy(true);
    try {
      await apiReactivate();
      haptic("success");
      toast.success("Welcome back — your profile is visible again");
    } catch {
      toast.error("Couldn't reactivate the account — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (record) {
    return (
      <SettingsPage title="Deactivate account">
        <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
          Your profile is hidden. Everything is still there — reactivating brings it straight
          back, and the {GRACE_DAYS}-day deletion clock never started.
        </p>

        <SectionTitle>The record</SectionTitle>
        <Group>
          <StaticRow
            title="Hidden"
            sub="When the profile stopped being visible."
            right={formatStamp(record.at)}
          />
          {record.reason ? (
            <StaticRow title={record.reason} sub="Reason given — what you told us on the way out." />
          ) : null}
        </Group>

        <PillStack>
          <PillButton label="Reactivate now" disabled={busy} onClick={doReactivate} />
        </PillStack>
        <Helper>
          Reactivating reopens the account here. Any other device was signed out when the profile
          went away and will need to sign in again once it&apos;s back.
        </Helper>

        <DeleteInstead />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Deactivate account">
      <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
        Deactivating hides your profile until you sign back in. It isn&apos;t deletion — nothing is
        removed, and there&apos;s no clock running.
      </p>

      <SectionTitle desc="Your profile details, saved choices and device sessions all wait exactly as they are. Signing back in restores every one of them.">
        What you&apos;re giving up
      </SectionTitle>
      <Group>
        {HIDDEN.map((line) => (
          <StaticRow key={line} title={line} />
        ))}
      </Group>

      <SectionTitle desc="Nobody reads this but us. It's the only reason we get to ask, and it doesn't change what the deactivation does.">
        Why are you taking a break?
      </SectionTitle>
      <Group label="Reason for deactivating">
        {REASONS.map((line) => (
          <OptionRow
            key={line}
            title={line}
            selected={reason === line}
            onSelect={() => setReason(line)}
          />
        ))}
        {/* Every choice opens a box on the same page rather than a popup — it
            isn't a different decision, it's the one you just made, said in your
            own words. "Something else" without the words says nothing, so that
            one is the reason that needs the note. */}
        <Disclosure open={!!reason}>
          <div className="border-t border-divider px-4 py-4 sm:px-5">
            <Field
              label="Tell us what it was"
              hint={
                reason === OTHER
                  ? "Say it in your own words — this is the part we can actually act on."
                  : "Optional. Nobody reads this but us, and it doesn't change what the deactivation does."
              }
              action={
                <span className="text-[12px] tabular-nums text-muted">
                  {note.length}/{NOTE_MAX}
                </span>
              }
            >
              <Textarea
                value={note}
                maxLength={NOTE_MAX}
                rows={3}
                placeholder="In your own words — what made you want a break?"
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </div>
        </Disclosure>
      </Group>

      <PillStack>
        <PillButton
          tone="danger"
          label="Deactivate account"
          disabled={!canFile}
          onClick={() => {
            haptic("medium");
            setConfirm(true);
          }}
        />
      </PillStack>
      {!canFile ? (
        <Helper>
          {reason
            ? "“Something else” needs a word about what else was — that's the only reason that can't stand on its own."
            : "Pick a reason above to unlock the button."}
        </Helper>
      ) : null}

      <DeleteInstead />

      {confirm ? (
        <Sheet
          title="Deactivate account?"
          description="Your profile stops loading for everyone and every device is signed out, including this one."
          onClose={() => setConfirm(false)}
          footer={
            <SheetActions
              cancelLabel="Not now"
              onCancel={() => setConfirm(false)}
              confirmLabel="Deactivate account"
              confirmVariant="danger"
              onConfirm={doDeactivate}
            />
          }
        >
          <SheetGroup>
            {KEEP.map((line) => (
              <StaticRow key={line} title={line} />
            ))}
            <StaticRow title="Reason given" sub={given()} />
          </SheetGroup>
        </Sheet>
      ) : null}
    </SettingsPage>
  );
}

/* The louder way out is a link, not a second red button: this page's one
   filled red action is the deactivation. */
function DeleteInstead() {
  return (
    <>
      <SectionTitle desc="Deleting is the one thing you can't take back.">
        Taking a break isn&apos;t enough?
      </SectionTitle>
      <Group>
        <LinkRow
          href="/settings/delete-account"
          danger
          title="Permanently delete my account"
          sub="Your account, your profile and everything saved to it, after a window you can cancel within."
        />
      </Group>
    </>
  );
}
