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
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { type Device, findDevice, signOut } from "@/lib/devices";
import { useReauthGuard } from "@/components/reauth-sheet";
import { wasDeclined } from "@/lib/reauth";
import { placeFor } from "@/lib/places";
import { ago, formatDate, formatStamp } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import { LoadFailed } from "@/components/page-loading";
import { ExternalLink } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   One machine, in full — one short line per fact.

   The machine up top, then its details as a small key/value list: what it
   is, where it signs in from, when it was used. The map shows itself when
   the session has a place. Ending a session still asks in a sheet.
   ═══════════════════════════════════════════════════════════════════ */

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [device, setDevice] = useState<Device | null | undefined>(undefined);
  /* A session that isn't there and a service that didn't answer are different
     facts, and the first one shouldn't be printed when the second happened. */
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { guard, reauthDialog } = useReauthGuard();

  const load = () => {
    setFailed(false);
    findDevice(params.id).then(setDevice).catch(() => setFailed(true));
  };

  usePageRefresh(load);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (failed)
    return (
      <LoadFailed
        title="Device"
        message="This session couldn't be read from the account. Nothing about it has changed — the account just didn't answer."
        onRetry={load}
      />
    );

  if (device === undefined) return <PageSkeleton title="Device" sections={2} />;

  if (!device) {
    return (
      <SettingsPage title="Device">
        <Helper lead>That session has ended — there&apos;s nothing left to show here.</Helper>
        <PillStack>
          <PillButton label="Back to devices" href="/settings/devices" tone="outline" />
        </PillStack>
      </SettingsPage>
    );
  }

  const machine = device;
  const recent = [...device.logins].sort((a, b) => b - a).slice(0, 5);
  /* Every machine's position is traced from the network address its own
     session arrived on; a place nothing knows has no map. */
  const coords: [number, number] | null = device.coords ?? placeFor(device.location)?.coords ?? null;

  async function eject() {
    try {
      await guard((proof) => signOut(machine.id, proof));
    } catch (err) {
      // Backing out of the check leaves the session exactly where it was.
      if (wasDeclined(err)) return;
      haptic("error");
      toast.error(err instanceof Error && err.message ? err.message : `${machine.name} wasn't signed out`);
      return;
    }
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
            ? "The machine you're reading this on."
            : "A machine holding a signed-in session."
        }
        meta={
          device.current
            ? `Signed in ${formatDate(device.signedInAt)} · active now`
            : `Last active ${formatStamp(device.lastActiveAt)}`
        }
      />

      <StatementBody>
        <StatementSection label="This machine">
          <Prose>
            <Value>{device.browser || "A browser"}</Value> on{" "}
            <Value>{device.os || "an unreported system"}</Value>.
          </Prose>
          <Prose>
            It signs in from the network address <Value>{device.ip}</Value>, which traces to{" "}
            <Value>{device.location}</Value>. A location read from an address names a city, not an
            exact place.
          </Prose>
        </StatementSection>

        <StatementSection label="How long it's been open">
          <Prose>
            The session started on <Value>{formatDate(device.signedInAt)}</Value> —{" "}
            <Value>{ago(device.signedInAt)}</Value>.
          </Prose>
          {device.current ? null : (
            <Prose>
              It was last used on <Value>{formatDate(device.lastActiveAt)}</Value> —{" "}
              <Value>{ago(device.lastActiveAt)}</Value>.
            </Prose>
          )}
        </StatementSection>
      </StatementBody>

      {recent.length > 1 ? (
        <>
          <SectionTitle
            desc={
              <>
                This machine&apos;s sign-ins only — everything is in{" "}
                <Link
                  href="/settings/login-activity"
                  className="font-medium text-link underline underline-offset-2"
                >
                  Login activity
                </Link>
                .
              </>
            }
          >
            Recent sign-ins
          </SectionTitle>
          <Group>
            {recent.map((at, i) => (
              <StaticRow
                key={at}
                title={formatStamp(at)}
                sub={`${device.location} · ${device.ip}${i === 0 ? " · latest" : ""}`}
              />
            ))}
          </Group>
        </>
      ) : null}

      {coords ? (
        <div className="mt-8">
          <MapCard coords={coords} label={device.location} />
          <Link
            href={`https://www.openstreetmap.org/?mlat=${coords[0]}&mlon=${coords[1]}#map=17/${coords[0]}/${coords[1]}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-link underline underline-offset-2"
          >
            Open a larger map
            <ExternalLink className="size-3" strokeWidth={2.4} />
          </Link>
        </div>
      ) : null}

      {device.current ? null : (
        <>
          <PillStack>
            <PillButton
              label="Log out of this device"
              tone="danger"
              onClick={() => setConfirming(true)}
            />
            <PillButton label="Back to devices" href="/settings/devices" tone="outline" />
          </PillStack>
          <Helper>
            Signing out ends this device&apos;s session — it doesn&apos;t change your password.
          </Helper>
        </>
      )}

      {/* The question, asked on its own surface. The session only ends here. */}
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

      {reauthDialog}
    </SettingsPage>
  );
}
