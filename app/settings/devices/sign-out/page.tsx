"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, cn, Sheet, SheetActions } from "@/components/ig-ui";
import { DeviceTile } from "@/components/device-tile";
import { Group, Helper, PillButton, PageSkeleton, PillStack, SettingsPage } from "@/components/settings-shell";
import { LoadFailed } from "@/components/page-loading";
import { type Device, readDevices, signOutMany } from "@/lib/devices";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { ago } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import { Check } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   End several sessions at once

   Its own page rather than a mode on the list, because the whole screen
   changes job — every row becomes a tick box and the only thing at the
   bottom is the decision. The red button names how many sessions it's
   about to end, and the sheet that follows repeats it before anything
   happens.
   ═══════════════════════════════════════════════════════════════════ */

export default function SignOutDevicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [others, setOthers] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const { guard, reauthDialog } = useReauthGuard();

  const load = () => {
    setFailed(false);
    readDevices()
      .then((devices) => setOthers(devices.filter((device) => !device.current)))
      .catch(() => setFailed(true));
  };

  usePageRefresh(load);

  useEffect(() => {
    load();
  }, []);

  if (failed)
    return (
      <LoadFailed
        title="Select devices to log out"
        message="The sessions on the account couldn't be read right now. Nothing has been signed out — the account just didn't answer."
        onRetry={load}
      />
    );

  if (others === null) return <PageSkeleton title="Select devices to log out" />;

  const allPicked = others.length > 0 && picked.length === others.length;

  function toggle(id: string) {
    haptic("selection");
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function eject() {
    /* The count only gets claimed once the account has actually ended the
       sessions — a failed write must not read as a sign-out that happened.
       One guarded call for the whole batch: the emailed code that pays for it
       works once, so it can't fund three separate deletes. */
    try {
      const n = await guard((proof) => signOutMany(picked, proof));
      setConfirming(false);
      haptic("success");
      toast.success(`Signed out of ${n} ${n === 1 ? "device" : "devices"}`);
      router.push("/settings/devices");
    } catch (err: any) {
      /* Backing out of the check leaves every session signed in, and the
         question on screen, so it can be answered again. */
      if (wasDeclined(err)) return;
      haptic("error");
      toast.error(err?.message || "The sessions couldn't be ended. Nothing was signed out.");
    }
  }

  if (!others.length) {
    return (
      <SettingsPage title="Select devices to log out">
        <Helper lead>
          Nothing else is signed in. This is the only device holding a session, so there&apos;s
          nothing here to end.
        </Helper>
        <PillStack>
          <PillButton label="Back to devices" href="/settings/devices" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Select devices to log out">
      <Helper className="mt-6">
        Tick every machine you don&apos;t recognise. Their sessions end the moment you confirm, and
        they&apos;ll need your password to get back in.
      </Helper>

      <div className="mt-5 mb-3 flex items-center justify-between gap-4 px-1">
        <span className="text-[13px] font-medium tabular-nums text-muted">
          {picked.length} of {others.length} selected
        </span>
        <Chip
          active={allPicked}
          className="min-h-10"
          onClick={() => {
            haptic("light");
            setPicked(allPicked ? [] : others.map((d) => d.id));
          }}
        >
          {allPicked ? "Deselect all" : "Select all"}
        </Chip>
      </div>

      <Group>
        {others.map((device) => (
          <PickRow
            key={device.id}
            device={device}
            checked={picked.includes(device.id)}
            onToggle={() => toggle(device.id)}
          />
        ))}
      </Group>

      {/* Full width down the column on a phone, side by side once there is
          room — and never a surprise: the label carries the count. */}
      <PillStack>
        <PillButton
          label={picked.length ? `Log out of ${picked.length} ${picked.length === 1 ? "device" : "devices"}` : "Log out"}
          tone="danger"
          disabled={picked.length === 0}
          onClick={() => {
            haptic("heavy");
            setConfirming(true);
          }}
        />
        <PillButton label="Back to devices" href="/settings/devices" tone="outline" />
      </PillStack>

      {confirming ? (
        <Sheet
          title={`End ${picked.length} ${picked.length === 1 ? "session" : "sessions"} now?`}
          description="People using those machines are signed out immediately. Nothing is deleted — only the session."
          onClose={() => setConfirming(false)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setConfirming(false)}
              confirmLabel={`Log out of ${picked.length} ${picked.length === 1 ? "device" : "devices"}`}
              confirmVariant="danger"
              onConfirm={eject}
            />
          }
        />
      ) : null}

      {reauthDialog}
    </SettingsPage>
  );
}

/* ── One machine, as a tick box ────────────────────────────────── */

function PickRow({
  device,
  checked,
  onToggle,
}: {
  device: Device;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={device.name}
      onClick={onToggle}
 className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-surface-2/50 active:bg-surface-2/70"
    >
      <DeviceTile kind={device.kind} tone={checked ? "current" : "plain"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{device.name}</span>
        {/* The address has to be readable while you decide, so this line wraps
            instead of clipping. */}
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">
          {device.location} · Active {ago(device.lastActiveAt)} · {device.ip}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          checked ? "border-accent bg-accent text-accent-fg" : "border-border",
        )}
      >
        {checked ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
