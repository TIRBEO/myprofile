"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sheet, SheetActions } from "@/components/ig-ui";
import { DeviceGlyph } from "@/components/device-tile";
import { MapCard } from "@/components/map-card";
import {
  Prose,
  StatementBody,
  StatementHead,
  StatementMark,
  StatementSection,
  Value,
} from "@/components/statement";
import {
  Group,
  Helper,
  PageSkeleton,
  PillButton,
  PillStack,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { type Device, findDevice, signOut } from "@/lib/devices";
import { placeFor } from "@/lib/places";
import { ago, formatDate, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { ExternalLink } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   One machine, in full

   This used to be a form: Browser / Operating system / Network address /
   Signed in / Last active / Traced to, six rows of label and value. It read
   in two seconds and explained nothing — it never said where the city comes
   from, or that a mobile network can put it a hundred kilometres out, which
   is the exact thing a person staring at an unfamiliar town needs to know.

   So it's a statement now, the way the account-status pages are: the machine
   up top, then the three questions under hairlines — what it is, where it
   signs in from, when it was used — with the values inside the sentences
   rather than beside their labels.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [device, setDevice] = useState<Device | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setDevice(findDevice(params.id));
  }, [params.id]);

  if (device === undefined) return <PageSkeleton title="Device" sections={2} />;

  if (!device) {
    return (
      <SettingsPage title="Device">
        <Helper lead>
          That session has ended. The device is no longer signed in, so there&apos;s nothing left to
          show here.
        </Helper>
        <PillStack>
          <PillButton label="Back to devices" href="/settings/devices" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const machine = device;
  const recent = [...device.logins].sort((a, b) => b - a).slice(0, 5);
  /* Every machine's position is traced from the network address its own
     session arrived on, so each one keeps the place it actually signed in from. */
  const place = placeFor(device.location);
  const coords: [number, number] | null = place ? place.coords : null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function eject() {
    signOut(machine.id);
    haptic("success");
    toast.error(`${machine.name} signed out`);
    router.push("/settings/devices");
  }

  return (
    <SettingsPage>
      <StatementHead
        title={device.name}
        mark={
          <StatementMark>
            <DeviceGlyph kind={device.kind} />
          </StatementMark>
        }
        sub={
          device.current
            ? "The machine you're reading this on. Nothing here ends your own session."
            : "A machine holding a signed-in session on this account."
        }
        meta={
          device.current
            ? `Signed in ${formatDate(device.signedInAt)} · active now`
            : `Last active ${formatStamp(device.lastActiveAt)}`
        }
      />

      <StatementBody>
        <StatementSection label="What this machine is">
          <Prose>
            It reports itself as <Value>{device.browser || "a browser that wouldn't say"}</Value>
            {" "}running{" "}
            <Value>{device.os || "an operating system it didn't name"}</Value>, under the name{" "}
            <Value>{device.name}</Value>. All three are what the browser chose to send when the
            session opened, so they describe what it asked to be treated as rather than what the
            hardware is.
          </Prose>
        </StatementSection>

        <StatementSection label="Where it signs in from">
          <Prose>
            Every session here has come in on <Value>{device.ip}</Value>, which resolves to{" "}
            <Value>{device.location}</Value>.
          </Prose>
          <Prose>
            That town is estimated from the network address, which is registered to the carrier that
            routed the session — accurate to a city, never to a street. A mobile network or a VPN
            can therefore show a place the device was not standing in.
          </Prose>
        </StatementSection>

        <StatementSection label="When it was used">
          <Prose>
            Signed in <Value>{formatDate(device.signedInAt)}</Value> ({ago(device.signedInAt)})
            {device.current ? (
              <> and active now.</>
            ) : (
              <>
                , last active <Value>{formatDate(device.lastActiveAt)}</Value> (
                {ago(device.lastActiveAt)}).
              </>
            )}
          </Prose>
          <Prose>
            Every time on this page is your own clock ({zone}), converted from the instant the
            session recorded it.
          </Prose>
        </StatementSection>

        {recent.length > 1 ? (
          <StatementSection label="Recent sign-ins from this machine">
            <Prose>
              Only the sign-ins made from this one device. Everything, from every machine, is in{" "}
              <Link
                href="/settings/login-activity"
                className="font-medium text-link underline underline-offset-2"
              >
                Login activity
              </Link>
              .
            </Prose>
            <div className="mt-1">
              <Group>
                {recent.map((at, i) => (
                  <StaticRow
                    key={at}
                    title={formatStamp(at)}
                    sub={`${device.location} · ${device.ip}${i === 0 ? " · latest" : ""}`}
                  />
                ))}
              </Group>
            </div>
          </StatementSection>
        ) : null}

        {coords ? (
          <StatementSection label="The place, on a map">
            <MapCard coords={coords} label={device.location} />
            <Prose>
              Pinned from the network address, which names a city rather than a place.{" "}
              <Link
                href={`https://www.openstreetmap.org/?mlat=${coords[0]}&mlon=${coords[1]}#map=17/${coords[0]}/${coords[1]}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-link underline underline-offset-2"
              >
                Open a larger map
                <ExternalLink className="size-3" strokeWidth={2.4} />
              </Link>
            </Prose>
          </StatementSection>
        ) : null}

        <StatementSection label={device.current ? "What you can do here" : "Ending this session"}>
          {device.current ? (
            <Prose>
              Nothing, on this page. This is the machine you&apos;re reading it from, so logging out
              of Tirbeo closes this session too — the button is at the bottom of the menu.
            </Prose>
          ) : (
            <Prose>
              Ending it signs that machine out at once and deletes the session token on this device.
              Nothing is removed from the machine itself, and it will need your password and a fresh
              two-factor code to get back in.
            </Prose>
          )}
        </StatementSection>
      </StatementBody>

      {device.current ? null : (
        <PillStack>
          <PillButton
            label="Log out of this device"
            tone="danger"
            onClick={() => setConfirming(true)}
          />
          <PillButton label="Back to devices" href="/settings/devices" tone="outline" />
        </PillStack>
      )}

      {/* The question, asked on its own surface — a bottom sheet on a phone
          where the thumb already is. The session only ends here. */}
      {confirming ? (
        <Sheet
          title="Log out of this device?"
          description="That device will need your password, and a fresh two-factor code, to sign back in."
          onClose={() => setConfirming(false)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setConfirming(false)}
              confirmLabel="Log out"
              confirmVariant="danger"
              onConfirm={eject}
            />
          }
        />
      ) : null}
    </SettingsPage>
  );
}
