"use client";

import { useEffect, useState } from "react";
import { Field, Input, Sheet, SheetActions } from "@/components/ig-ui";
import {
  ActionRow,
  Group,
  Helper,
  PageSkeleton,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { MAX_PASSKEYS, type Passkey, createPasskey, readKeys, removePasskey } from "@/lib/passkeys";
import { formatDate } from "@/lib/dates";
import { guessDevice } from "@/lib/device";
import { useToast } from "@/lib/use-toast";


/* ═══════════════════════════════════════════════════════════════════
   Passkeys — one decision per screen.

   The list, and a single Add button under it. A passkey itself is held
   by the browser, so the row only names it and says when it was added,
   and tapping the row asks before it's revoked. Nothing secret is stored.
   ═══════════════════════════════════════════════════════════════════ */

export default function PasskeysPage() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const toast = useToast();

  useEffect(() => {
    setKeys(readKeys());
  }, []);

  if (keys === null) return <PageSkeleton title="Passkeys" />;

  const full = keys.length >= MAX_PASSKEYS;

  return (
    <SettingsPage title="Passkeys">
      <SectionTitle
        desc={<>
          A passkey is created on the device or password manager you pick and never leaves it — Tirbeo
          only stores the name and when it was added. Up to {MAX_PASSKEYS} per account.
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
              sub={`Added ${formatDate(key.createdAt)} · ${key.device || "This device"}`}
              danger
              opens={false}
              onClick={() => setRemoving(key)}
            />
          ))}
        </Group>
      ) : (
        <Helper className="mt-0">No passkeys on your account yet.</Helper>
      )}

      <PillStack>
        <PillButton
          label="Add passkey"
          disabled={full}
          sub={full ? "Limit reached — remove one to add another." : undefined}
          onClick={() => setAdding(true)}
        />
      </PillStack>

      {adding ? (
        <AddSheet
          onClose={() => setAdding(false)}
          onAdded={(key) => {
            setAdding(false);
            setKeys(readKeys());
            toast.success(`${key.name} added`);
          }}
        />
      ) : null}

      {removing ? (
        <Sheet
          title={`Remove ${removing.name}?`}
          description="Signing in with this passkey stops working right away. Other passkeys and your password still work."
          onClose={() => setRemoving(null)}
          footer={
            <SheetActions
              cancelLabel="Keep it"
              onCancel={() => setRemoving(null)}
              confirmLabel="Remove"
              confirmVariant="danger"
              onConfirm={() => {
                removePasskey(removing.id);
                setRemoving(null);
                setKeys(readKeys());
                toast.error("Passkey removed");
              }}
            />
          }
        />
      ) : null}
    </SettingsPage>
  );
}

/* ── Add sheet: the name only ──────────────────────────────────────
   One field, then Cancel or Add. The API call is the stub in
   lib/passkeys — `createPasskey` — and the row appears as soon as it
   resolves.                                                          */

function AddSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (key: Passkey) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    const key = await createPasskey(name);
    setBusy(false);
    onAdded(key);
  }

  return (
    <Sheet
      title="Name this passkey"
      description="So you recognise it later."
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel="Add"
          disabled={!name.trim()}
          loading={busy}
          onConfirm={submit}
        />
      }
    >
      <Field label="Name" className="-mx-4 sm:-mx-5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={guessDevice().name}
          maxLength={40}
        />
      </Field>
    </Sheet>
  );
}
