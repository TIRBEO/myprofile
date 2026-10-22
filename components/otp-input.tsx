"use client";

import { useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════
   A 6-digit one-time-code input: one box per digit, auto-advance on
   type, backspace steps back, and a paste fills every box at once.
   ═══════════════════════════════════════════════════════════════════ */

export function OtpInput({
  value,
  onChange,
  length = 6,
  onEnter,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  length?: number;
  /** Enter submits once every box is full — the keyboard's "Continue". */
  onEnter?: () => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < value.length - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "Enter") onEnter?.();
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, value.length);
    if (!digits) return;
    e.preventDefault();
    const next = Array.from({ length }, () => "");
    digits.split("").forEach((d, idx) => (next[idx] = d));
    onChange(next);
    refs.current[Math.min(digits.length, value.length - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" onPaste={onPaste}>
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          className="h-14 min-w-0 flex-1 rounded-lg border border-border bg-field text-center text-[21px] font-semibold text-fg outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-placeholder hover:border-border-strong hover:bg-field-hover focus:border-accent-solid focus:bg-field-focus focus:shadow-[0_0_0_3px_var(--accent-soft-ring)]"
        />
      ))}
    </div>
  );
}
