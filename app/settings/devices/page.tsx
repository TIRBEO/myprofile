"use client";

import { useEffect, useState } from "react";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { DeviceRow } from "@/components/device-tile";
import { type Device, type SessionEvent, readDevices, readLog } from "@/lib/devices";
import { ago, formatStamp } from "@/lib/dates";
import { LogOut } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Devices and sessions — modelled on Instagram's login activity.

   This device leads the list, then everything else signed in sits under
   "Logins on other devices". Nothing here opens a popup: a machine is a
   page of its own, and so is the multi-select that ends several sessions
   at once. The whole screen is one question — is there a device here you
   don't recognise, and if so, how do you shut it out.
   ═══════════════════════════════════════════════════════════════════ */

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);

  useEffect(() => {
    setDevices(readDevices());
    setEvents(readLog());
  }, []);

  if (devices === null) return <PageSkeleton title="Devices and sessions" />;

  const here = devices.find((device) => device.current) ?? null;
  const others = devices.filter((device) => !device.current);

  return (
    <SettingsPage title="Devices and sessions">
      {/* ── Three sections, one heading style, like every other page here ── */}
      <SectionTitle>You&apos;re logged in on these devices</SectionTitle>
      {here ? (
        <Group>
          <SessionLine device={here} />
        </Group>
      ) : null}

      {others.length ? (
        <>
          <SectionTitle desc="Signing out ends that session right away. It can get back in with your password and, if two-factor is on, a fresh code.">
            Logins on other devices
          </SectionTitle>
          <Group>
            {others.map((device) => (
              <LinkRow
                key={device.id}
                href={`/settings/devices/${device.id}`}
                title={device.name}
                sub={`${device.location} · Active ${ago(device.lastActiveAt)} · ${device.browser} · ${device.ip}`}
              />
            ))}
            <LinkRow
              danger
              href="/settings/devices/sign-out"
              title="Select devices to log out"
              sub="Pick several machines and end their sessions in one go."
              icon={<LogOut className="size-[18px]" strokeWidth={1.9} />}
            />
          </Group>
        </>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          No other device holds a session. Anyone signing in somewhere new will show up here.
        </p>
      )}

      {/* ── History ─ */}
      {events.length ? (
        <>
          <SectionTitle desc="Ended sessions stay here so a gap in the device list has an explanation next to it.">
            Recent activity
          </SectionTitle>
          <Group>
            {events.map((event) => (
              <EventLine key={event.id} event={event} />
            ))}
          </Group>
        </>
      ) : null}

      <Helper className="mt-8">
        Location and address come from the network a session arrived on, so they&apos;re approximate.
        If you see a device you don&apos;t recognise, log it out and change your password.
      </Helper>
    </SettingsPage>
  );
}

/* ── One machine on the list ───────────────────────────────────── */

function SessionLine({ device }: { device: Device }) {
  return (
    <DeviceRow
      href={`/settings/devices/${device.id}`}
      kind={device.kind}
      tone="plain"
      title={device.name}
      location={device.location}
      current={device.current}
      sub={
        /* The tile's detail line clips to one line, and an address cut short
           is the one fact here you have to read whole — so this line wraps. */
        <span className="block whitespace-normal">
          {device.current
            ? `Signed in ${ago(device.signedInAt)} · ${device.browser}`
            : `Active ${ago(device.lastActiveAt)} · ${device.browser}`}{" "}
          · {device.ip}
        </span>
      }
    />
  );
}

/* ── A session that already ended ──────────────────────────────── */

function EventLine({ event }: { event: SessionEvent }) {
  // Labels are written as "<what happened> · <where>", so the place rides on
  // the same quiet line as the timestamp.
  const [head, ...rest] = event.label.split(" · ");
  const where = rest.join(" · ");
  return (
    <StaticRow
      icon={<LogOut className="size-[18px]" strokeWidth={1.9} />}
      title={head}
      sub={where ? `${where} · ${formatStamp(event.at)} · ${ago(event.at)}` : `${formatStamp(event.at)} · ${ago(event.at)}`}
    />
  );
}
