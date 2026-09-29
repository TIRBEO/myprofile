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
}: {
  value: string[];
  onChange: (next: string[]) => void;
  length?: number;
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
          className="size-12 rounded-xl border border-border bg-surface-2 text-center text-[20px] font-bold text-fg outline-none transition-colors focus:border-accent"
        />
      ))}
    </div>
  );
}
