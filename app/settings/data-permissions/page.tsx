"use client";


import {
  Group,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { usePrefs } from "@/lib/prefs";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Data and permissions — what Tirbeo may do with your activity.

   Two groups of persisted switches. Marketing cookies run on analytics
   data, so they depend on analytics being on: switching analytics off
   takes marketing with it and locks the row until analytics returns.
   Essential cookies are on for everyone, always — tapping says why.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:data-permissions";

type Prefs = {
  personalised: boolean;
  shareWithPartners: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
};

const DEFAULTS: Prefs = {
  personalised: true,
  shareWithPartners: false,
  analyticsCookies: true,
  marketingCookies: false,
};

export default function DataPermissionsPage() {
  const { values: p, set } = usePrefs(STORE, DEFAULTS);
  const toast = useToast();

  if (!p) return <PageSkeleton title="Data and permissions" sections={2} />;

  const leavesApp = p.shareWithPartners || p.marketingCookies;
  const usedInsideApp = p.personalised || p.analyticsCookies;

  function togglePersonalised(on: boolean) {
    set({ personalised: on });
    toast.toggled(on ? "Personalisation on — Tirbeo will tailor what you see" : "Personalisation off", on);
  }

  function togglePartners(on: boolean) {
    set({ shareWithPartners: on });
    toast.toggled(on ? "Anonymous usage data will be shared with partners" : "Stopped sharing with partners", on);
  }

  function toggleAnalytics(on: boolean) {
    if (!on) {
      set({ analyticsCookies: false, marketingCookies: false });
      toast.error("Analytics cookies off — marketing cookies went with them, they run on this data");
      return;
    }
    set({ analyticsCookies: true });
    toast.success("Analytics cookies on");
  }

  function toggleMarketing(on: boolean) {
    set({ marketingCookies: on });
    toast.toggled(on ? "Marketing cookies on" : "Marketing cookies off", on);
  }

  return (
    <SettingsPage title="Data and permissions">

      {/* ── Data usage ── */}
      <SectionTitle>Data usage</SectionTitle>
      <Group>
        <ToggleRow
          title="Personalised experience"
          sub={
            p.personalised
              ? "What you do on Tirbeo shapes what you're shown."
              : "You see the same thing as everyone else, in the same order."
          }
          on={p.personalised}
          onChange={togglePersonalised}
        />
        <ToggleRow
          title="Share anonymous usage data with partners"
          sub="Counts of how the app is used, with no name, profile or content attached."
          on={p.shareWithPartners}
          onChange={togglePartners}
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
          onChange={() => {}}
          blockedHint={() => toast.error("Essential cookies stay on — without them Tirbeo can't keep you signed in")}
        />
        <ToggleRow
          title="Analytics cookies"
          sub="Tell the Tirbeo team which features people use and where they get stuck."
          on={p.analyticsCookies}
          onChange={toggleAnalytics}
        />
        <ToggleRow
          title="Marketing cookies"
          sub={
            p.analyticsCookies
              ? "Measure how well campaigns and ads work."
              : "Off with analytics cookies — they count campaign results from analytics data."
          }
          on={p.analyticsCookies && p.marketingCookies}
          disabled={!p.analyticsCookies}
          blockedHint={() => toast.error("Marketing cookies need analytics cookies on first")}
          onChange={toggleMarketing}
        />
      </Group>
    </SettingsPage>
  );
}
