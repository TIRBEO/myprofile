"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { haptic } from "@/lib/haptics";

/* ── Toasts ───────────────────────────────────────────────────────
   One provider replaces the per-page `toast` state + timer ref +
   cleanup effect that every screen used to carry. Toasts are the
   accounts frosted pill, floating bottom-center at every width.
   Capped at MAX, each clears itself after DURATION.                */

export type ToastTone = "success" | "error" | "info";

type ToastItem = { id: number; tone: ToastTone; message: string; leaving: boolean };

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** A switch that moved. Green on, red off. */
  toggled: (message: string, on: boolean) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DURATION = 3000;
const OUT_MS = 220;
const MAX = 3;

// Tone carries meaning, so the three of them are not interchangeable: green
// for something now on, red for something now off or lost, blue for a plain
// fact. The pill itself is the same frosted glass every time — only its border
// and mark answer for the tone (see .tb-toast in globals.css).
const TONE: Record<ToastTone, { pill: string }> = {
  success: { pill: "tb-toast--success" },
  error: { pill: "tb-toast--error" },
  info: { pill: "tb-toast--info" },
};

/** The shape beside the colour — the tone can't be carried by hue alone. */
function Mark({ tone }: { tone: ToastTone }) {
  const Icon = tone === "success" ? Check : tone === "error" ? CircleAlert : Info;
  return <Icon className="size-[14px]" strokeWidth={2.4} />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const drop = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    // Play the exit animation, then unmount.
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, OUT_MS);
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, tone, message, leaving: false }].slice(-MAX));
      haptic(tone === "error" ? "error" : tone === "success" ? "success" : "light");
      timers.current.set(id, setTimeout(() => drop(id), DURATION));
    },
    [drop],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m: string) => show(m, "success"),
      error: (m: string) => show(m, "error"),
      info: (m: string) => show(m, "info"),
      toggled: (m: string, on: boolean) => show(m, on ? "success" : "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length ? <ToastViewport toasts={toasts} onDismiss={drop} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // A page rendered outside the provider should still work, just silently.
    return { show: () => {}, success: () => {}, error: () => {}, info: () => {}, toggled: () => {} };
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom,0px))] z-[100] flex flex-col items-center gap-2.5 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const tone = TONE[t.tone];
        return (
          <div
            key={t.id}
            style={{
              animation: `${t.leaving ? "ig-toast-out" : "ig-toast-in"} ${t.leaving ? OUT_MS : 300}ms cubic-bezier(0.32, 0.72, 0, 1) both`,
            }}
            className={`tb-toast pointer-events-auto ${tone.pill}`}
          >
            <span aria-hidden className="shrink-0 [&_svg]:size-[17px]">
              <Mark tone={t.tone} />
            </span>
            <span className="min-w-0 flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              className="relative grid size-6 shrink-0 place-items-center rounded-full text-text-4 transition-colors hover:bg-fg/10 hover:text-fg after:absolute after:-inset-2 after:content-['']"
            >
              <X className="size-3.5" strokeWidth={2.25} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
