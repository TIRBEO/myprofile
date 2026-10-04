"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";

import { cn, Skeleton } from "@/components/ig-ui";
import { SectionTitle, SettingsPage } from "@/components/settings-shell";
import { THEMES, applyTheme, onSystemThemeChange, readTheme, type ThemeId } from "@/lib/theme";
import { reloadSettings } from "@/lib/remote-store";
import { useToast } from "@/lib/use-toast";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Appearance — three sample screens side by side rather than three
   sentences in a list. A theme is a thing you look at, so the choice
   shows you the thing; the blue frame is the only mark of what is
   currently picked.

   The previews are drawn from the same two palettes the app itself
   uses, so what you approve here is what you get.
   ═══════════════════════════════════════════════════════════════════ */

type Concrete = "light" | "dark";

const PALETTE: Record<Concrete, { bg: string; ink: string; line: string; soft: string }> = {
  light: { bg: "#ffffff", ink: "#0b0b0d", line: "#e2e2e8", soft: "#c9c9d1" },
  dark: { bg: "#000000", ink: "#f5f5f7", line: "#2a2a2f", soft: "#4a4a52" },
};

export default function AppearancePage() {
  // readTheme() answers "system" on the server, so the read happens after
  // mount — reading localStorage during render would desync the markup.
  // Until it has, the page shows the three tiles as shapes, not a tick on
  // the option the reader may not have picked.
  const [theme, setTheme] = useState<ThemeId | undefined>(undefined);
  const toast = useToast();

  const look = useCallback(() => setTheme(readTheme()), []);

  useEffect(() => {
    look();
  }, [look]);

  usePageRefresh(() => {
    void reloadSettings().then(look);
    look();
  });

  // While pinned to "system", follow the OS the moment it flips.
  useEffect(() => {
    if (theme !== "system") return;
    return onSystemThemeChange(() => setTheme(readTheme()));
  }, [theme]);

  function choose(next: ThemeId) {
    setTheme(next);
    applyTheme(next);
    const label = THEMES.find((t) => t.id === next)?.label ?? next;
    toast.success(`${label} theme applied`);
  }

  if (theme === undefined)
    return (
      <SettingsPage title="Appearance">
        <Skeleton className="mb-3 h-[17px] w-[140px] rounded-full" />
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {THEMES.map((t) => (
            <span key={t.id} className="flex flex-col gap-2">
              <Skeleton className="aspect-[4/5] w-full rounded-[12px]" />
              <Skeleton className="mx-auto h-[13px] w-[60%] rounded-full" />
            </span>
          ))}
        </div>
      </SettingsPage>
    );

  const current = THEMES.find((t) => t.id === theme);

  return (
    <SettingsPage title="Appearance">
      <SectionTitle desc="The theme is kept in this browser, so a different device or browser starts on System again.">
        Choose a theme
      </SectionTitle>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {THEMES.map((t) => (
          <ThemeTile
            key={t.id}
            id={t.id}
            label={t.label}
            active={t.id === theme}
            onSelect={() => choose(t.id)}
          />
        ))}
      </div>
      {current?.description ? (
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">{current.description}</p>
      ) : null}
    </SettingsPage>
  );
}

/* ── One sample screen, and the word under it ────────────────────── */

function ThemeTile({
  id,
  label,
  active,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl border-2 p-2 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-2.5",
        active ? "border-accent" : "border-border-strong hover:border-muted/55",
      )}
    >
      <Preview id={id} />
      <span className="flex min-w-0 items-center gap-1 px-0.5 pb-0.5">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-semibold sm:text-[13.5px]",
            active ? "text-accent-text" : "text-fg",
          )}
        >
          {label}
        </span>
        {active ? <Check className="size-[14px] shrink-0 text-accent-text" strokeWidth={2.6} /> : null}
      </span>
    </button>
  );
}

/** A settings screen in miniature: a heading, two rows, a switch. Drawn with
    boxes rather than an image so it stays crisp and recolors with the palette
    it is meant to demonstrate. */
function Screen({ p }: { p: (typeof PALETTE)[Concrete] }) {
  return (
    <>
      <span className="block h-[7px] w-[46%] rounded-full" style={{ backgroundColor: p.ink }} />
      <span
        className="mt-2 flex flex-col gap-[9px] rounded-[9px] px-[7px] py-[8px]"
        style={{ backgroundColor: p.bg, border: `1px solid ${p.line}` }}
      >
        <span className="flex items-center gap-[6px]">
          <span className="min-w-0 flex-1 space-y-[4px]">
            <span className="block h-[5px] w-[70%] rounded-full" style={{ backgroundColor: p.ink, opacity: 0.8 }} />
            <span className="block h-[4px] w-[45%] rounded-full" style={{ backgroundColor: p.soft }} />
          </span>
          <span className="flex h-[10px] w-[18px] shrink-0 items-center rounded-full bg-accent px-[2px]">
            <span className="ml-auto block size-[7px] rounded-full bg-white" />
          </span>
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="min-w-0 flex-1 space-y-[4px]">
            <span className="block h-[5px] w-[58%] rounded-full" style={{ backgroundColor: p.ink, opacity: 0.8 }} />
            <span className="block h-[4px] w-[38%] rounded-full" style={{ backgroundColor: p.soft }} />
          </span>
          <span
            className="flex h-[10px] w-[18px] shrink-0 items-center rounded-full px-[2px]"
            style={{ backgroundColor: p.line }}
          >
            <span className="block size-[7px] rounded-full bg-white" />
          </span>
        </span>
      </span>
    </>
  );
}

function Preview({ id }: { id: ThemeId }) {
  if (id === "system") {
    /* Half and half, because there is no single palette to show: the top of
       the card is the light app, the bottom is the dark one. */
    return (
      <span
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-[12px] border border-divider [background:linear-gradient(116deg,#ffffff_0_48%,#0c0c0e_52%_100%)]"
        aria-hidden
      >
        <span className="absolute inset-x-2 top-2 block h-[6px] w-[40%] rounded-full bg-[#8b8b93]" />
        <span className="absolute inset-x-2 top-[26%] rounded-[9px] border border-[#8b8b93]/35 bg-white/12 px-[7px] py-[8px] backdrop-blur-[1px]">
          <span className="block h-[5px] w-[68%] rounded-full bg-[#8b8b93]" />
          <span className="mt-[7px] block h-[4px] w-[42%] rounded-full bg-[#8b8b93]/55" />
          <span className="mt-[9px] block h-[5px] w-[55%] rounded-full bg-[#8b8b93]" />
        </span>
        <span className="absolute inset-x-2 bottom-2 h-[13px] rounded-full bg-accent/85" />
      </span>
    );
  }
  const p = PALETTE[id];
  return (
    <span
      className="relative block aspect-[4/5] w-full overflow-hidden rounded-[12px] p-2"
      style={{ backgroundColor: p.bg, border: `1px solid ${p.line}` }}
      aria-hidden
    >
      <Screen p={p} />
    </span>
  );
}
