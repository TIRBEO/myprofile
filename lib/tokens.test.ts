import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ═══════════════════════════════════════════════════════════════════
   The palette, checked as arithmetic

   There is no browser on the machine this app gets built on, so the colour
   decisions in globals.css would otherwise land unreviewed. Two failure
   modes here are silent in the strongest sense: they do not throw, they do
   not fail typecheck, and they do not look wrong on whichever screen you
   happen to be looking at.

     - a token defined for dark and forgotten for light, which paints the
       other palette's colour. Because the dark block's selector is
       `:root, :root[data-theme="dark"]`, a dark-only token is a *fallback* —
       usually deliberate (a font stack, an easing curve) and occasionally
       exactly this bug, which is why the deliberate ones are named below.
     - the surface ladder inverted, so a plate sits *below* the ground it is
       meant to float on. That inversion is why every section read as a box
       sunk into a box, and it survived review because each hex on its own
       looks like a plausible grey.

   So the stylesheet is parsed and the numbers are compared.

   The Appearance tiles are pinned to the same source: they preview a palette
   that is *not* the one applied, so `lib/theme.ts` has to hand-copy the
   hexes, and a picture of the app that quietly stops being the app is the
   exact drift the miniature was built to avoid.
   ═══════════════════════════════════════════════════════════════════ */

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(here, "../app/globals.css"), "utf8");

/** Declarations of one top-level block, keyed by custom-property name (the
    leading `--` dropped). Stops at the first `}` at column 0; no declaration
    in this file contains a brace. */
function block(startAfter: string): Record<string, string> {
  const at = css.indexOf(startAfter);
  if (at < 0) throw new Error(`no block starting ${startAfter}`);
  const body = css.slice(css.indexOf("{", at) + 1);
  const end = body.search(/^\}/m);
  const out: Record<string, string> = {};
  for (const m of body.slice(0, end).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const dark = block(':root[data-theme="dark"]');
const light = block(':root[data-theme="light"]');
const theme = block("@theme inline");
const THEMES = [["dark", dark], ["light", light]] as const;

/* ── colour arithmetic ────────────────────────────────────────────── */

/** `#rgb` / `#rrggbb` → channels. Anything else — rgba, var(), currentColor —
    returns null, so an assertion about a colour it cannot read fails loudly
    instead of passing on `NaN`. */
function rgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const s = m[1]!.length === 3 ? m[1]!.replace(/./g, (c) => c + c) : m[1]!;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex) ?? [];
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`not an opaque hex colour: ${hex}`);
  }
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

/** A token's value in one scheme, falling back to the dark block exactly the
    way the cascade does — `:root` and `:root[data-theme="dark"]` are one
    selector, so dark is the base and light only carries the overrides. */
function value(palette: Record<string, string>, name: string): string {
  const v = palette[name] ?? dark[name];
  if (v === undefined) throw new Error(`--${name} is defined in neither palette`);
  return v;
}

/* ── token coverage ───────────────────────────────────────────────── */

describe("token coverage", () => {
  it("gives every utility class a value to resolve to", () => {
    // The class strings across the app say `bg-field`, `text-text-3`,
    // `border-hairline`. An alias pointing at a token nobody defined compiles
    // and renders — as an unset property.
    const unresolved: string[] = [];
    for (const [alias, declaration] of Object.entries(theme)) {
      const ref = /^var\(--([\w-]+)\)$/.exec(declaration)?.[1];
      if (!ref) continue; // a literal, like a radius or a keyframe
      for (const [scheme, palette] of THEMES) {
        const resolves = ref in palette || ref in dark;
        if (!resolves) unresolved.push(`--color-${alias.slice(6)} → --${ref} (${scheme})`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("does not define a token for light alone", () => {
    // The reverse direction is unconditionally a bug: light has no `:root`
    // half, so dark would be left reading an unset property.
    expect(Object.keys(light).filter((k) => !(k in dark)).sort()).toEqual([]);
  });

  it("keeps a dark-only token to the list of things that genuinely do not change", () => {
    const SHARED = ["ease-enter", "ease-exit", "stack-mono", "stack-sans"];
    const onlyDark = Object.keys(dark)
      .filter((k) => !(k in light))
      .sort();
    // A colour appearing here means it now has the dark value in Daylight;
    // either give the light block an override, or add it above and say why.
    expect({ unexpected: onlyDark.filter((k) => !SHARED.includes(k)) }).toEqual({
      unexpected: [],
    });
  });
});

/* ── the ladder ───────────────────────────────────────────────────── */

describe("surface ladder", () => {
  for (const [scheme, palette] of THEMES) {
    it(`${scheme}: a plate is lighter than the ground it sits on`, () => {
      // The defect this pass exists to fix: `--bg` above `--card` makes every
      // group read as a hole cut in the page rather than a sheet laid on it.
      const bg = luminance(value(palette, "bg"));
      const card = luminance(value(palette, "card"));
      expect({ scheme, bgIsUnderCard: bg < card }).toEqual({ scheme, bgIsUnderCard: true });
    });

    it(`${scheme}: a hover is not the ground, and still shows on the plate`, () => {
      // `--hover` used to equal `--bg`. Once the ground moved under the plate,
      // that turned every hover into a hole punched in the row.
      expect(value(palette, "hover")).not.toBe(value(palette, "bg"));
      expect(contrast(value(palette, "hover"), value(palette, "card"))).toBeGreaterThanOrEqual(1.1);
    });

    it(`${scheme}: the separator reads against the plate it divides`, () => {
      // Below about 1.1:1 a hairline is not a hairline; it is a rounding error.
      expect(contrast(value(palette, "divider"), value(palette, "card")))
        .toBeGreaterThanOrEqual(1.1);
    });
  }
});

/* ── legibility ───────────────────────────────────────────────────── */

describe("text contrast", () => {
  /** [what it is, foreground token, background token, floor]

      4.5:1 is the WCAG AA floor for body text. Two pairs sit at 3:1 on
      purpose: a button label is 17px semibold, and a placeholder is
      *meant* to be the least emphatic thing in its field — Apple's own is
      under 3:1. They are floored rather than skipped so a future edit that
      pushes one toward the field colour is caught. */
  const PAIRS: Array<[string, string, string, number]> = [
    ["body on the ground", "fg", "bg", 4.5],
    ["body on a plate", "fg", "card", 4.5],
    ["secondary text on a plate", "text-2", "card", 4.5],
    ["muted text on a plate", "muted", "card", 4.5],
    ["link words on a plate", "accent-text", "card", 4.5],
    ["link words on a field", "accent-text", "field", 4.5],
    ["danger words on a plate", "danger-text", "card", 4.5],
    ["a label on the accent fill", "accent-fg", "accent", 3.0],
    ["a placeholder in a field", "placeholder", "field", 2.5],
  ];

  for (const [scheme, palette] of THEMES) {
    for (const [label, fg, bg, min] of PAIRS) {
      const ratio = contrast(value(palette, fg), value(palette, bg));
      it(`${scheme}: ${label} clears ${min}:1`, () => {
        expect({ scheme, label, ratio: +ratio.toFixed(2) }).toMatchObject({ scheme, label });
        expect(ratio).toBeGreaterThanOrEqual(min);
      });
    }
  }

  it("keeps placeholder text below the text it stands in for", () => {
    // Emphasis order, not a ratio: a token pass that lifts the muted grey and
    // leaves the placeholder alone quietly makes empty fields shout.
    for (const [scheme, palette] of THEMES) {
      const field = value(palette, "field");
      expect({
        scheme,
        placeholderIsFainter:
          contrast(value(palette, "placeholder"), field) <
          contrast(value(palette, "muted"), field),
      }).toMatchObject({ scheme, placeholderIsFainter: true });
    }
  });

  it("keeps the accent's fill separate from its text form, in both schemes", () => {
    // The platform blue is correct as a button fill and wrong as words, in
    // both directions: #0A84FF on a dark plate is 3.8:1, #007AFF on white is
    // 4.0:1. So the fill stays Apple's and the text role takes the adjusted
    // variant — lighter in dark, darker in light. Which way it has to move is
    // the part worth pinning, because a token pass that "unifies the accent"
    // makes link text illegible without changing any hex to an odd value.
    expect(dark["accent"]).not.toBe(dark["accent-text"]);
    expect(light["accent"]).not.toBe(light["accent-text"]);
    expect(luminance(dark["accent-text"]!)).toBeGreaterThan(luminance(dark["accent"]!));
    expect(luminance(light["accent-text"]!)).toBeLessThan(luminance(light["accent"]!));
  });
});

/* ── type ─────────────────────────────────────────────────────────── */

describe("font stack", () => {
  it("leads with the platform font and never names SF Pro", () => {
    const stack = value(dark, "stack-sans");
    // `-apple-system` is the only route to SF Pro's automatic optical-size
    // switching and per-size tracking. A locally installed "SF Pro Text"
    // matches that name ahead of the generic family and pins one cut.
    expect(stack.trim().startsWith("-apple-system")).toBe(true);
    expect(stack).not.toMatch(/SF Pro/i);
  });

  it("asks the platform for optical sizing", () => {
    expect(css).toMatch(/font-optical-sizing:\s*auto/);
  });
});

/* ── the Appearance tiles ─────────────────────────────────────────── */

describe("appearance previews", () => {
  const themeSrc = readFileSync(path.join(here, "theme.ts"), "utf8");

  /** Which token each part of the miniature is a picture of. `bar` is the
      accent pill along the bottom of the mock, `line` the hairline between
      two rows, `ink` the quieter of the two stacked bars in a row. */
  const MAP: Record<string, string> = { bg: "bg", card: "card", line: "divider", ink: "muted", bar: "accent" };

  function swatch(constName: string): Record<string, string> {
    const m = new RegExp(`const ${constName} = \\{([^}]*)\\}`).exec(themeSrc);
    if (!m) throw new Error(`${constName} is no longer an object literal in lib/theme.ts`);
    const out: Record<string, string> = {};
    for (const d of m[1]!.matchAll(/(\w+):\s*"(#[0-9a-f]+)"/gi)) out[d[1]!] = d[2]!;
    return out;
  }

  for (const [constName, palette] of [["DARK_SWATCH", dark], ["LIGHT_SWATCH", light]] as const) {
    it(`${constName} still pictures its own palette`, () => {
      const s = swatch(constName);
      expect(Object.keys(s).sort()).toEqual(Object.keys(MAP).sort());
      const drift = Object.entries(MAP)
        .filter(([key]) => s[key]!.toLowerCase() !== value(palette, MAP[key]!).toLowerCase())
        .map(([key]) => `${key}: ${s[key]} ≠ --${MAP[key]}: ${value(palette, MAP[key]!)}`);
      expect(drift).toEqual([]);
    });
  }
});
