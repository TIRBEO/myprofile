"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, Sheet, SheetActions } from "@/components/ig-ui";
import { DeviceTile } from "@/components/device-tile";
import { Group, Helper, PillButton, PageSkeleton, PillStack, SettingsPage } from "@/components/settings-shell";
import { type Device, readDevices, signOutMany } from "@/lib/devices";
import { ago } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
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
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setOthers(readDevices().filter((device) => !device.current));
  }, []);

  if (others === null) return <PageSkeleton title="Select devices to log out" />;

  const allPicked = others.length > 0 && picked.length === others.length;

  function toggle(id: string) {
    haptic("selection");
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function eject() {
    const n = picked.length;
    signOutMany(picked);
    haptic("success");
    toast.success(`Signed out of ${n} ${n === 1 ? "device" : "devices"}`);
    router.push("/settings/devices");
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
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setPicked(allPicked ? [] : others.map((d) => d.id));
          }}
 className="min-h-10 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-fg outline-none transition-colors hover:bg-surface-3 active:bg-surface-3"
        >
          {allPicked ? "Deselect all" : "Select all"}
        </button>
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
