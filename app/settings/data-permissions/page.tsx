"use client";

import { useCallback, useEffect, useState } from "react";

import { LoadFailed, TogglePageSkeleton } from "@/components/page-loading";
import {
  Group,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { ApiError } from "@/lib/api";
import { DataUsagePrefs, readDataUsage, saveDataUsage } from "@/lib/data-usage";
import { usePageRefresh } from "@/lib/page-refresh";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Data and permissions — what Tirbeo may do with your activity.

   Every answer is the account's, read from and written to the brain over
   /api/preferences/data-usage — no localStorage, no laptop-specific copy.
   The switches wait for the stored values rather than painting defaults
   and correcting themselves; a failed write rolls the control back to the
   last value the server confirmed.

   Marketing cookies run on analytics data, so they depend on analytics
   being on: switching analytics off takes marketing with it and locks the
   row until analytics returns. The same rule is enforced on the brain —
   the screen mirrors it, it doesn't own it. Essential cookies are on for
   everyone, always — tapping says why.
   ═══════════════════════════════════════════════════════════════════ */

export default function DataPermissionsPage() {
  /* null = the account's answer hasn't been read yet. A failed read is kept
     apart from an empty one, so the page can say which. */
  const [prefs, setPrefs] = useState<DataUsagePrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setPrefs(null);
    setLoadError(null);
    readDataUsage()
      .then(setPrefs)
      .catch((err) => {
        setLoadError(
          err instanceof ApiError && err.message
            ? err.message
            : "Your data permissions couldn't be read from your account.",
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(load);

  /** Write to the account, optimistically, and settle on the server's full
      merged answer. A refused write rolls the control back to the value the
      server actually holds — not to a guess. Returns whether it landed. */
  async function save(patch: Partial<DataUsagePrefs>): Promise<boolean> {
    const before = prefs;
    if (!before || pending) return false;
    setPending(true);
    setPrefs({ ...before, ...patch });
    try {
      setPrefs(await saveDataUsage(patch));
      return true;
    } catch (err) {
      setPrefs(before);
      toast.error(
        err instanceof ApiError && err.message
          ? `${err.message} — nothing changed`
          : "The account wouldn't take that change — nothing changed",
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  if (loadError)
    return (
      <LoadFailed title="Data and permissions" message={loadError} onRetry={load} />
    );

  if (!prefs) return <TogglePageSkeleton title="Data and permissions" count={4} />;

  function busyHint() {
    toast.info("One change at a time — the account is still saving this one");
  }

  return (
    <SettingsPage title="Data and permissions">

      {/* ── Data usage ── */}
      <SectionTitle>Data usage</SectionTitle>
      <Group>
        <ToggleRow
          title="Personalised experience"
          sub={
            prefs.personalised
              ? "What you do on Tirbeo shapes what you're shown."
              : "You see the same thing as everyone else, in the same order."
          }
          on={prefs.personalised}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            if (await save({ personalised: next }))
              toast.toggled(next ? "Personalisation on — Tirbeo will tailor what you see" : "Personalisation off", next);
          }}
          label="Personalised experience"
        />
        <ToggleRow
          title="Share anonymous usage data with partners"
          sub="Counts of how the app is used, with no name, profile or content attached."
          on={prefs.shareWithPartners}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            if (await save({ shareWithPartners: next }))
              toast.toggled(next ? "Anonymous usage data will be shared with partners" : "Stopped sharing with partners", next);
          }}
          label="Share anonymous usage data with partners"
        />
      </Group>

      {/* ── Cookies ── */}
      <SectionTitle desc="Marketing cookies depend on analytics data. Turning analytics off switches marketing off with it — to get marketing back, turn both on.">
        Cookies
      </SectionTitle>
      <Group>
        <ToggleRow
          title="Essential cookies"
          sub="Keep you signed in and the app working. Can't be turned off."
          on
          disabled
          blockedHint={() => toast.error("Essential cookies stay on — without them Tirbeo can't keep you signed in")}
          onChange={() => {}}
          label="Essential cookies"
        />
        <ToggleRow
          title="Analytics cookies"
          sub="Tell the Tirbeo team which features people use and where they get stuck."
          on={prefs.analyticsCookies}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            // Turning analytics off takes marketing with it here, so the
            // switches don't lie for the round trip — and the brain enforces
            // the same rule whatever this screen sends.
            if (await save(next ? { analyticsCookies: true } : { analyticsCookies: false, marketingCookies: false })) {
              if (next) toast.success("Analytics cookies on");
              else toast.error("Analytics cookies off — marketing cookies went with them, they run on this data");
            }
          }}
          label="Analytics cookies"
        />
        <ToggleRow
          title="Marketing cookies"
          sub={
            prefs.analyticsCookies
              ? "Measure how well campaigns and ads work."
              : "Off with analytics cookies — they count campaign results from analytics data."
          }
          on={prefs.analyticsCookies && prefs.marketingCookies}
          disabled={!prefs.analyticsCookies || pending}
          blockedHint={() =>
            !prefs.analyticsCookies
              ? toast.error("Marketing cookies need analytics cookies on first")
              : busyHint()
          }
          onChange={async (next) => {
            if (await save({ marketingCookies: next }))
              toast.toggled(next ? "Marketing cookies on" : "Marketing cookies off", next);
          }}
          label="Marketing cookies"
        />
      </Group>
    </SettingsPage>
  );
}
