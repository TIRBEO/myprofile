"use client";

import { useEffect, useState } from "react";

import { Sheet, SheetOption } from "@/components/ig-ui";
import {
  Group,
  Helper,
  OptionRow,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Email preferences.

   "Pause all" is the master switch, and pausing dims the choices below
   rather than switching them off — resume and they are as they were. The
   duration is read back as the time actually left, and the page says out
   loud that account and security mail ignores all of it. Nothing leaves
   this browser: it is the choice, kept until the mail service exists.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:email-prefs";

type Frequency = "instant" | "daily" | "weekly";

type Prefs = {
  /** Epoch ms when the pause lapses; -1 = until turned off; null = not paused. */
  pausedUntil: number | null;
  productUpdates: boolean;
  offers: boolean;
  tips: boolean;
  weeklySummary: boolean;
  monthlyRecap: boolean;
  frequency: Frequency;
};

const DEFAULT: Prefs = {
  pausedUntil: null,
  productUpdates: true,
  offers: false,
  tips: true,
  weeklySummary: true,
  monthlyRecap: false,
  frequency: "instant",
};

const PAUSE_DURATIONS: { label: string; ms: number }[] = [
  { label: "For 1 day", ms: 24 * 60 * 60_000 },
  { label: "For 1 week", ms: 7 * 24 * 60 * 60_000 },
  { label: "For 1 month", ms: 30 * 24 * 60 * 60_000 },
  { label: "For 1 year", ms: 365 * 24 * 60 * 60_000 },
  { label: "Until I turn it back on", ms: -1 },
];

const FREQUENCIES: { value: Frequency; label: string; sub: string }[] = [
  { value: "instant", label: "Instant", sub: "Each email arrives as it is sent." },
  { value: "daily", label: "Once a day", sub: "Everything held for one daily bundle." },
  { value: "weekly", label: "Up to once a week", sub: "One email a week at most." },
];

export default function EmailPreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [pauseSheet, setPauseSheet] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const toast = useToast();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const saved = { ...DEFAULT, ...(JSON.parse(raw) as Partial<Prefs>) };
        if (saved.pausedUntil && saved.pausedUntil !== -1 && saved.pausedUntil <= Date.now())
          saved.pausedUntil = null;
        setPrefs(saved);
      }
    } catch {
      /* unreadable blob — keep the defaults */
    }
  }, []);

  // Re-render on the minute so "Paused until …" and the auto-resume stay honest.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  function commit(next: Partial<Prefs>) {
    setPrefs((p) => {
      const merged = { ...p, ...next };
      try {
        window.localStorage.setItem(STORE, JSON.stringify(merged));
      } catch {
        /* private mode — the change still holds for this session */
      }
      return merged;
    });
  }

  const paused =
    prefs.pausedUntil !== null && (prefs.pausedUntil === -1 || prefs.pausedUntil > now);

  const indefinite = paused && prefs.pausedUntil === -1;

  /* The shortest duration option that still covers the remaining pause. */
  const activeMs = indefinite
    ? -1
    : paused
      ? (PAUSE_DURATIONS.find(
          (d) => d.ms !== -1 && (prefs.pausedUntil as number) - now <= d.ms,
        )?.ms ?? null)
      : null;

  function pauseFor(ms: number, label: string) {
    commit({ pausedUntil: ms === -1 ? -1 : Date.now() + ms });
    setPauseSheet(false);
    toast.error(
      ms === -1
        ? "Emails paused until you turn them back on"
        : `Emails paused ${label.toLowerCase()} — essential alerts still arrive`,
    );
  }

  function resume() {
    commit({ pausedUntil: null });
    toast.success("Emails resumed");
  }

  const held = indefinite
    ? "until you turn it back on"
    : `until ${new Date(prefs.pausedUntil as number).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`;

  return (
    <SettingsPage title="Email preferences">

      {/* ── The master switch ── */}
      <SectionTitle>Pause everything at once</SectionTitle>
      <Group>
        <ToggleRow
          title="Pause all non-essential emails"
          sub={
            paused
              ? `Paused ${held.replace(/^until /, "")} — tap to resume now.`
              : "Pick how long. They resume on their own when the time is up."
          }
          on={paused}
          onChange={(next) => (next ? setPauseSheet(true) : resume())}
          label="Pause all non-essential emails"
        />
      </Group>

      {/* ── Emails from Tirbeo ── */}
      <SectionTitle>Emails from Tirbeo</SectionTitle>
      <Group dimmed={paused}>
        <ToggleRow
          title="Account and security emails"
          sub="Sign-in alerts, password changes and other account activity. These can't be turned off."
          on
          disabled
          locked
          blockedHint={() => toast.error("Account and security emails are always sent")}
          onChange={() => {}}
          label="Account and security emails"
        />
        <ToggleRow
          title="Product updates"
          sub="New features, improvements and tips to get the most out of Tirbeo."
          on={prefs.productUpdates}
          onChange={(next) => commit({ productUpdates: next })}
          label="Product updates"
        />
        <ToggleRow
          title="Offers and promotions"
          sub="Deals, campaigns and special offers from Tirbeo."
          on={prefs.offers}
          onChange={(next) => commit({ offers: next })}
          label="Offers and promotions"
        />
        <ToggleRow
          title="Tips and inspiration"
          sub="Short guides on settings, privacy and getting around Tirbeo."
          on={prefs.tips}
          onChange={(next) => commit({ tips: next })}
          label="Tips and inspiration"
        />
      </Group>

      {/* ── Summaries and digests ── */}
      <SectionTitle>Summaries and digests</SectionTitle>
      <Group dimmed={paused}>
        <ToggleRow
          title="Weekly summary"
          sub="One email every week with your highlights instead of individual emails."
          on={prefs.weeklySummary}
          onChange={(next) => commit({ weeklySummary: next })}
          label="Weekly summary"
        />
        <ToggleRow
          title="Monthly recap"
          sub="A monthly look back at your activity, growth and milestones."
          on={prefs.monthlyRecap}
          onChange={(next) => commit({ monthlyRecap: next })}
          label="Monthly recap"
        />
      </Group>

      {/* ── How often ── */}
      <SectionTitle desc="Everything except account and security mail is held to this pace, whether that is one email the moment it happens or one a week.">
        How often you receive them
      </SectionTitle>
      <Group dimmed={paused}>
        {FREQUENCIES.map((f) => (
          <OptionRow
            key={f.value}
            title={f.label}
            sub={f.sub}
            selected={prefs.frequency === f.value}
            onSelect={() => {
              commit({ frequency: f.value });
              toast.info(`Mail bundled ${f.value === "instant" ? "as it happens" : f.label.toLowerCase()}`);
            }}
          />
        ))}
      </Group>
      <Helper className="mt-10">
        Essential emails about your account, security and compliance are always sent — even when
        everything above is off, and even while everything above is paused.
      </Helper>

      {pauseSheet ? (
        <Sheet
          title="Pause emails"
          description="Non-essential emails resume automatically when the time is up."
          onClose={() => setPauseSheet(false)}
        >
          <div
            className="-mx-4 list-divide sm:-mx-5"
            role="radiogroup"
            aria-label="Pause for how long"
          >
            {PAUSE_DURATIONS.map((d) => (
              <SheetOption
                key={d.label}
                selected={d.ms === activeMs}
                onClick={() => pauseFor(d.ms, d.label)}
              >
                {d.label}
              </SheetOption>
            ))}
          </div>
        </Sheet>
      ) : null}
    </SettingsPage>
  );
}
