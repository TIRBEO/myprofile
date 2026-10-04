"use client";

import { useEffect, useState } from "react";
import { Field, Input, Sheet, SheetActions } from "@/components/ig-ui";
import {
  ActionRow,
  Group,
  Helper,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { LoadFailed, SkeletonPage } from "@/components/page-loading";
import {
  MAX_PASSKEYS,
  addPasskey,
  passkeysSupported,
  readKeys,
  removePasskey,
  wasCancelled,
  type Passkey,
} from "@/lib/passkeys";
import { formatDate } from "@/lib/dates";
import { guessDevice } from "@/lib/device";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Passkeys — one decision per screen.

   The list is the account's own record: the name the owner gave each key,
   how the authenticator says it can be reached, and when it was added.
   Adding one runs the real ceremony — the account asks for a challenge,
   this device signs it, the account keeps the public half. Removing one
   goes through the shared identity check first, because a session someone
   else walked up to shouldn't be able to take away a way of getting back in.
   ═══════════════════════════════════════════════════════════════════ */

export default function PasskeysPage() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const [supported, setSupported] = useState(true);
  const toast = useToast();

  /** Re-read from the account rather than editing what's on screen — the id,
      the name and the instant are all the account's to decide. */
  async function refresh() {
    setKeys(await readKeys().catch(() => keys ?? []));
  }

  useEffect(() => {
    setSupported(passkeysSupported());
    load();
  }, []);

  const load = () => {
    setFailed(false);
    readKeys().then(setKeys).catch(() => setFailed(true));
  };

  usePageRefresh(load);

  if (failed) {
    return (
      <LoadFailed
        title="Passkeys"
        message="The passkeys on the account couldn't be read right now. Nothing about them has changed — try again in a moment."
        onRetry={load}
      />
    );
  }

  if (keys === null) return <SkeletonPage title="Passkeys" count={3} />;

  const full = keys.length >= MAX_PASSKEYS;

  return (
    <SettingsPage title="Passkeys">
      <SectionTitle
        desc={<>
          A passkey is created on the device or password manager you pick and never leaves it —
          Tirbeo keeps the name you give it and when it was added. Up to {MAX_PASSKEYS} per
          account.
        </>}
      >
        Your passkeys
      </SectionTitle>

      {keys.length ? (
        <Group>
          {keys.map((key) => (
            <ActionRow
              key={key.id}
              title={key.name}
              sub={
                key.transports.length
                  ? `Added ${formatDate(key.createdAt)} · ${key.transports.join(", ")}`
                  : `Added ${formatDate(key.createdAt)}`
              }
              danger
              opens={false}
              onClick={() => setRemoving(key)}
            />
          ))}
        </Group>
      ) : (
        <Helper className="mt-0">No passkeys on your account yet.</Helper>
      )}

      {!supported ? (
        <Helper lead tone="warn">
          This browser can&apos;t create a passkey. Add one from a device that can — a phone, a
          laptop with a fingerprint reader, or a password manager that supports them — and it will
          show up in this list.
        </Helper>
      ) : null}

      <PillStack>
        <PillButton
          label="Add passkey"
          disabled={!supported || full}
          sub={full ? "Limit reached — remove one to add another." : undefined}
          onClick={() => setAdding(true)}
        />
      </PillStack>

      {adding ? (
        <AddSheet
          onClose={() => setAdding(false)}
          onAdded={async (key) => {
            setAdding(false);
            await refresh();
            toast.success(`${key.name} added`);
          }}
        />
      ) : null}

      {removing ? (
        <RemoveSheet
          passkey={removing}
          onClose={() => setRemoving(null)}
          onRemoved={async () => {
            setRemoving(null);
            await refresh();
            toast.error("Passkey removed");
          }}
        />
      ) : null}
    </SettingsPage>
  );
}

/* ── Add: name it, then the device's own prompt ────────────────────
   The name is asked for first because the account stores it and the
   authenticator doesn't know it. Everything after that is the browser's
   dialog, and the reason for a refusal — if there is one — is printed on
   this sheet, where the button that started it still is.              */

function AddSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (key: Passkey) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onAdded(await addPasskey(name));
    } catch (err) {
      setBusy(false);
      // Walking away from the device's prompt is an answer, not a fault.
      if (wasCancelled(err)) {
        onClose();
        return;
      }
      setError(err instanceof Error && err.message ? err.message : "The passkey wasn’t added");
    }
  }

  return (
    <Sheet
      title="Name this passkey"
      description="So you recognise it later. Your device will ask you to confirm the key before it is saved."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel={busy ? "Waiting for your device" : "Add"}
          disabled={!name.trim()}
          loading={busy}
          onConfirm={submit}
        />
      }
    >
      <Field label="Name" error={error} className="-mx-4 sm:-mx-5">
        <Input
          value={name}
          onChange={(e) => {
            setError(null);
            setName(e.target.value);
          }}
          placeholder={guessDevice().name}
          maxLength={40}
          disabled={busy}
        />
      </Field>
    </Sheet>
  );
}

/* ── Remove: proof, then gone ────────────────────────────────────── */

function RemoveSheet({
  passkey,
  onClose,
  onRemoved,
}: {
  passkey: Passkey;
  onClose: () => void;
  onRemoved: () => void | Promise<void>;
}) {
  const { guard, reauthDialog } = useReauthGuard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await guard((proof) => removePasskey(passkey.id, proof));
      await onRemoved();
    } catch (err) {
      setBusy(false);
      // Backing out of the check leaves the passkey exactly where it was.
      if (wasDeclined(err)) return;
      setError(err instanceof Error && err.message ? err.message : "The passkey wasn’t removed");
    }
  }

  return (
    <>
      <Sheet
        title={`Remove ${passkey.name}?`}
        description="Signing in with this passkey stops working right away. Other passkeys and your password still work."
        onClose={onClose}
        footer={
          <SheetActions
            cancelLabel="Keep it"
            onCancel={onClose}
            confirmLabel="Remove"
            confirmVariant="danger"
            loading={busy}
            onConfirm={confirm}
          />
        }
      >
        <Helper>
          Taking away a way of getting back in needs one more check than being signed in —
          we&apos;ll ask how you&apos;d like to prove it&apos;s you.
        </Helper>
      </Sheet>
      {reauthDialog}
    </>
  );
}
