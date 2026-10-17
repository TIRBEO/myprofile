"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/components/ig-ui";
import { SectionTitle, SettingsPage } from "@/components/settings-shell";
import { trackEvent } from "@/lib/telemetry";
import { THEMES, ThemeDef, ThemeId, applyTheme, readTheme } from "@/lib/theme";

/* ═══════════════════════════════════════════════════════════════════
   Appearance — three choices, and picking one applies it immediately.

   The tick reads the *stored preference*, not the resolved palette: with
   "Follow device" selected, <html data-theme> says light or dark, and
   matching on that would tick the wrong tile. A MutationObserver on
   data-theme re-reads the preference so the tick stays honest when the
   account sync or another device changes it.

   Both palettes are ink-first: the contrast lives in the foreground
   (white text on black, near-black on white) and one royal blue marks
   the actions.
   ═══════════════════════════════════════════════════════════════════ */

export default function AppearancePage() {
  const [pref, setPref] = useState<ThemeId | null>(null);
  const [osLight, setOsLight] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const refresh = () => setPref(readTheme());
    const onScheme = () => {
      setOsLight(mq.matches);
      refresh();
    };
    onScheme();
    mq.addEventListener("change", onScheme);
    const watch = new MutationObserver(refresh);
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", onScheme);
      watch.disconnect();
    };
  }, []);

  const current: ThemeId | null = pref;

  return (
    <SettingsPage title="Appearance">
      <SectionTitle desc="Pick a palette. It applies to this device at once and follows your account everywhere else you sign in.">
        Theme
      </SectionTitle>
      <div className="grid max-w-[620px] grid-cols-3 gap-3">
        {THEMES.map((def) => (
          <ThemeTile
            key={def.id}
            def={def}
            swatch={def.id === "system" ? swatchFor(osLight ? "light" : "dark") : def.swatch}
            selected={current === def.id}
            onSelect={() => {
              applyTheme(def.id);
              trackEvent("settings.theme_changed", { metadata: { theme: def.id } });
            }}
          />
        ))}
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
        {THEMES.find((d) => d.id === current)?.description ??
          "Midnight is a black canvas with graphite plates; Daylight is pale grey with white ones."}
      </p>
    </SettingsPage>
  );
}

/** The concrete swatches behind the "Follow device" tile, so its preview
    shows what the device is actually getting rather than a stock image. */
function swatchFor(id: "light" | "dark") {
  return THEMES.find((d) => d.id === id)!.swatch;
}

/* ── One sample screen, and the word under it ────────────────────── */

function ThemeTile({
  def,
  swatch,
  selected,
  onSelect,
}: {
  def: ThemeDef;
  swatch: ThemeDef["swatch"];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl border-2 p-2 text-left transition-colors sm:p-2.5",
        selected
          ? "border-accent bg-card"
          : "border-border bg-card hover:border-border-strong",
      )}
    >
      <Preview swatch={swatch} />
      <span className="flex min-w-0 items-center gap-1 px-0.5 pb-0.5">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-semibold sm:text-[13.5px]",
            selected ? "text-accent-text" : "text-fg",
          )}
        >
          {def.label}
        </span>
        {selected && <Check className="size-[14px] shrink-0 text-accent-text" strokeWidth={2.6} />}
      </span>
    </button>
  );
}

/** A miniature of the settings screen in this palette, drawn from the same
    swatches the theme itself declares — so the tile cannot drift from the app. */
function Screen({ p }: { p: Record<string, string> }) {
  return (
    <>
      <span className="block h-[7px] w-[46%] rounded-full" style={{ backgroundColor: p.ink }} />
      <span
        className="mt-2 flex flex-col gap-[9px] rounded-[9px] px-[7px] py-[8px]"
        style={{ backgroundColor: p.bg, border: `1px solid ${p.line}` }}
      >
        <Row p={p} w={70} sub={45} on />
        <Row p={p} w={58} sub={38} />
      </span>
      <span
        className="mt-[9px] flex flex-col gap-[9px] rounded-[9px] px-[7px] py-[8px]"
        style={{ backgroundColor: p.bg, border: `1px solid ${p.line}` }}
      >
        <Row p={p} w={64} sub={41} />
        <Row p={p} w={52} sub={33} on />
      </span>
      <span className="absolute inset-x-2 bottom-2 block h-[13px] rounded-full" style={{ backgroundColor: p.bar }} />
    </>
  );
}

function Row({ p, w, sub, on }: { p: Record<string, string>; w: number; sub: number; on?: boolean }) {
  return (
    <span className="flex items-center gap-[6px]">
      <span className="min-w-0 flex-1 space-y-[4px]">
        <span
          className="block h-[5px] rounded-full"
          style={{ backgroundColor: p.ink, opacity: 0.8, width: `${w}%` }}
        />
        <span
          className="block h-[4px] rounded-full"
          style={{ backgroundColor: p.soft, width: `${sub}%` }}
        />
      </span>
      <span
        className="flex h-[10px] w-[18px] shrink-0 items-center rounded-full px-[2px]"
        style={{ backgroundColor: on ? p.bar : p.line }}
      >
        <span
          className={cn("block size-[7px] rounded-full", on && "ml-auto")}
          style={{ backgroundColor: "#ffffff" }}
        />
      </span>
    </span>
  );
}

function Preview({ swatch }: { swatch: ThemeDef["swatch"] }) {
  const p = {
    canvas: swatch.bg,
    bg: swatch.card,
    ink: swatch.ink,
    line: swatch.line,
    soft: swatch.line,
    bar: swatch.bar,
  };
  return (
    <span
      className="relative block aspect-[4/5] w-full overflow-hidden rounded-[12px] p-2"
      style={{ backgroundColor: p.canvas, border: `1px solid ${p.line}` }}
      aria-hidden
    >
      <Screen p={p} />
    </span>
  );
}
