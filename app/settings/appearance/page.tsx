"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/components/ig-ui";
import { SectionTitle, SettingsPage } from "@/components/settings-shell";
import { THEMES, ThemeDef, ThemeId, applyTheme } from "@/lib/theme";

/* ═══════════════════════════════════════════════════════════════════
   Appearance — two palettes, and picking one applies it immediately.
   Both are ink-first: the contrast lives in the foreground (near-black
   text, dark blue actions, dark red danger), so the light theme is not
   built out of pale accents.

   The selection is read off <html data-theme> rather than local state,
   because that attribute is what the boot script, the account sync and
   this page all agree on. A MutationObserver keeps the tick honest when
   another device changes the choice.
   ═══════════════════════════════════════════════════════════════════ */

export default function AppearancePage() {
  const [current, setCurrent] = useState<ThemeId | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const show = () => {
      const attr = root.getAttribute("data-theme");
      setCurrent((attr === "light" || attr === "dark") ? attr : null);
    };
    show();
    const watch = new MutationObserver(show);
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);

  return (
    <SettingsPage title="Appearance">
      <SectionTitle desc="Pick a palette. It applies to this device at once and follows your account everywhere else you sign in.">
        Theme
      </SectionTitle>
      <div className="grid max-w-[460px] grid-cols-2 gap-3">
        {THEMES.map((def) => (
          <ThemeTile
            key={def.id}
            def={def}
            selected={current === def.id}
            onSelect={() => applyTheme(def.id)}
          />
        ))}
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
        {THEMES.find((d) => d.id === current)?.description ??
          "Sign-in and security screens are always dark — they are the one surface every reader should see the same way."}
      </p>
    </SettingsPage>
  );
}

/* ── One sample screen, and the word under it ────────────────────── */

function ThemeTile({
  def,
  selected,
  onSelect,
}: {
  def: ThemeDef;
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
      <Preview def={def} />
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

function Preview({ def }: { def: ThemeDef }) {
  const p = {
    canvas: def.swatch.bg,
    bg: def.swatch.card,
    ink: def.swatch.ink,
    line: def.swatch.line,
    soft: def.swatch.line,
    bar: def.swatch.bar,
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
