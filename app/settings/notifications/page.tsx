"use client";

import { useCallback, useEffect, useState } from "react";

import { Sheet, SheetOption } from "@/components/ig-ui";
import { LoadFailed, TogglePageSkeleton } from "@/components/page-loading";
import {
  Group,
  Helper,
  OptionRow,
  SectionTitle,
  SettingsPage,
  ToggleRow,
} from "@/components/settings-shell";
import { ApiError } from "@/lib/api";
import {
  EmailPrefs,
  SummaryFrequency,
  readEmailPrefs,
  saveEmailPrefs,
} from "@/lib/notification-prefs";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Email preferences.

   Every answer here is the account's, read from and written to the brain
   over /api/notifications/prefs — no localStorage, no laptop-specific copy.
   "Pause all" is the master switch (`emailPaused` + `emailPausedUntil`),
   and pausing dims the choices below rather than switching them off —
   resume and they are as they were. The duration is read back as the time
   actually left, and the page says out loud that only sign-in codes and
   critical security alerts still arrive while the pause holds, because
   that is exactly what the senders do.
   ═══════════════════════════════════════════════════════════════════ */

const PAUSE_DURATIONS: { label: string; ms: number }[] = [
  { label: "For 1 day", ms: 24 * 60 * 60_000 },
  { label: "For 1 week", ms: 7 * 24 * 60 * 60_000 },
  { label: "For 1 month", ms: 30 * 24 * 60 * 60_000 },
  { label: "For 1 year", ms: 365 * 24 * 60 * 60_000 },
  { label: "Until I turn it back on", ms: -1 },
];

const FREQUENCIES: { value: SummaryFrequency; label: string; sub: string }[] = [
  { value: "daily", label: "Once a day", sub: "The recap arrives every day." },
  { value: "weekly", label: "Once a week", sub: "One recap a week with your highlights." },
  { value: "monthly", label: "Once a month", sub: "A monthly look back at your activity and milestones." },
];

export default function EmailPreferencesPage() {
  /* null = the account's answer hasn't been read yet. The switches wait for
     it rather than painting defaults and correcting themselves. A failed
     read is kept apart from an empty one, so the page can say which. */
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pauseSheet, setPauseSheet] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const toast = useToast();

  /* One read, shared: this page and the settings hub ask the same question of
     the same endpoint, and a mount that happens twice in dev must not fetch
     twice. `load(true)` is the pull-to-refresh path, which means "ask the
     account again". */
  const load = useCallback((refresh = false) => {
    setPrefs(null);
    setLoadError(null);
    readEmailPrefs({ refresh })
      .then(setPrefs)
      .catch((err) => {
        setLoadError(
          err instanceof ApiError && err.message
            ? err.message
            : "Your email preferences couldn't be read from your account.",
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(() => load(true));

  // Re-render on the minute so "Paused until …" and the auto-resume stay honest
  // — an expired emailPausedUntil reads as unpaused here and on the send path.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /** Write to the account, optimistically, and settle on the server's full
      merged answer. A refused write rolls the control back to the value the
      server actually holds — not to a guess. Returns whether it landed. */
  async function save(patch: Partial<EmailPrefs>): Promise<boolean> {
    const before = prefs;
    if (!before || pending) return false;
    setPending(true);
    setPrefs({ ...before, ...patch });
    try {
      setPrefs(await saveEmailPrefs(patch));
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
      <LoadFailed title="Email preferences" message={loadError} onRetry={() => load(true)} />
    );

  if (!prefs) return <TogglePageSkeleton title="Email preferences" count={4} />;

  const paused =
    prefs.emailPaused === true &&
    (typeof prefs.emailPausedUntil !== "number" || prefs.emailPausedUntil > now);

  const indefinite = paused && prefs.emailPausedUntil === null;

  /* The shortest duration option that still covers the remaining pause. */
  const activeMs = indefinite
    ? -1
    : paused
      ? (PAUSE_DURATIONS.find(
          (d) => d.ms !== -1 && (prefs.emailPausedUntil as number) - now <= d.ms,
        )?.ms ?? null)
      : null;

  async function pauseFor(ms: number, label: string) {
    // "Until I turn it back on" is null; every other choice is a real epoch ms
    // the senders compare against their own clock.
    const landed = await save({
      emailPaused: true,
      emailPausedUntil: ms === -1 ? null : Date.now() + ms,
    });
    if (!landed) return;
    setPauseSheet(false);
    toast.error(
      ms === -1
        ? "Emails paused until you turn them back on — sign-in codes and security alerts still arrive"
        : `Emails paused ${label.toLowerCase()} — only sign-in codes and security alerts still arrive`,
    );
  }

  async function resume() {
    const landed = await save({ emailPaused: false, emailPausedUntil: null });
    if (landed) toast.success("Emails resumed");
  }

  const held = indefinite
    ? "until you turn it back on"
    : `until ${new Date(prefs.emailPausedUntil as number).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`;

  function busyHint() {
    toast.info("One change at a time — the account is still saving this one");
  }

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
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={(next) => (next ? setPauseSheet(true) : void resume())}
          label="Pause all non-essential emails"
        />
      </Group>
      {paused ? (
        <Helper tone="warn">
          While paused, only sign-in codes and critical security alerts still arrive.
        </Helper>
      ) : null}

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
          on={prefs.productEmail}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            if (await save({ productEmail: next }))
              toast.toggled(next ? "Product updates on" : "Product updates off", next);
          }}
          label="Product updates"
        />
        <ToggleRow
          title="Offers and promotions"
          sub="Deals, campaigns and special offers from Tirbeo."
          on={prefs.offersEmail}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            if (await save({ offersEmail: next }))
              toast.toggled(next ? "Offers and promotions on" : "Offers and promotions off", next);
          }}
          label="Offers and promotions"
        />
        <ToggleRow
          title="Tips and inspiration"
          sub="Short guides on settings, privacy and getting around Tirbeo."
          on={prefs.tipsEmail}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            if (await save({ tipsEmail: next }))
              toast.toggled(next ? "Tips and inspiration on" : "Tips and inspiration off", next);
          }}
          label="Tips and inspiration"
        />
      </Group>

      {/* ── The account recap: one recurring mail, one switch ── */}
      <SectionTitle desc="One recurring email with your highlights — the weekly summary and the monthly recap are the same letter at two different paces, so there is one switch for it.">
        Account recap
      </SectionTitle>
      <Group dimmed={paused}>
        <ToggleRow
          title="Account recap email"
          sub={
            prefs.summaryEnabled
              ? `Arrives ${findFrequency(prefs.summaryFrequency).label.toLowerCase()} — pick the pace below.`
              : "Off — no recurring recap email is sent."
          }
          on={prefs.summaryEnabled}
          disabled={pending}
          blockedHint={pending ? busyHint : undefined}
          onChange={async (next) => {
            if (await save({ summaryEnabled: next }))
              toast.toggled(next ? "Account recap on" : "Account recap off", next);
          }}
          label="Account recap email"
        />
      </Group>

      {/* ── How often ── */}
      <SectionTitle desc="The pace at which your account recap arrives. Account and security mail ignores all of it and is sent the moment it happens.">
        How often you receive them
      </SectionTitle>
      <Group dimmed={paused}>
        {FREQUENCIES.map((f) => (
          <OptionRow
            key={f.value}
            title={f.label}
            sub={f.sub}
            selected={prefs.summaryFrequency === f.value}
            onSelect={async () => {
              if (prefs.summaryFrequency === f.value || pending) return;
              if (await save({ summaryFrequency: f.value }))
                toast.info(`Account recap ${f.label.toLowerCase()}`);
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
                onClick={() => void pauseFor(d.ms, d.label)}
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

function findFrequency(value: SummaryFrequency) {
  return FREQUENCIES.find((f) => f.value === value) ?? FREQUENCIES[1];
}
