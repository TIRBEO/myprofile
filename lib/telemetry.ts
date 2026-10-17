"use client";

/* ═══════════════════════════════════════════════════════════════════
   Client telemetry — fire-and-forget, never in the way

   Every meaningful user action and every error the UI swallowed posts one
   small event to POST {API}/api/telemetry/event, which answers
   { ok, id }. Three rules hold everywhere in this file:

   • It must never break the UI. Every path is wrapped, every failure is
     dropped on the floor — telemetry is the first thing to lose when a
     network is flaky, and the last thing a person should feel.
   • Nothing secret is ever sent. No password, no OTP code, no token, no
     full email. Where an address matters, only its domain goes.
   • The API origin follows the same rule as the rest of the monorepo (see
     apps/accounts/src/lib/api.ts): NEXT_PUBLIC_API_URL wins, but a
     loopback URL baked into a production build by a dirty .env.local is
     dropped rather than shipped — prod falls back to api.tirbeo.com.

   `errorRef`/`withRef` live here too: the account service answers a 500
   with a typed event id (body `eventId`), and a failure the person can't
   explain is much easier to report when the screen quotes that id.
   ═══════════════════════════════════════════════════════════════════ */

export const TELEMETRY_ENDPOINT = "/api/telemetry/event";

/** Loopback URLs must never survive a production build (mirrors
    apps/accounts/src/lib/api.ts lines 12-23). */
const dropLoopbackInProd = (v?: string) =>
  v && process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(v) ? undefined : v;

const configuredApiUrl = dropLoopbackInProd(process.env.NEXT_PUBLIC_API_URL);

/** The api app's origin: env first, then the same dev/prod defaults every
    Tirbeo front end uses. Exported so a caller that already needs the origin
    (avatar upload, support links) doesn't re-derive it a fourth way. */
export const API_BASE_URL =
  configuredApiUrl?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://api.tirbeo.com");

/** One uuid per event so the backend (and a person quoting a "Ref:") can
    dedupe retries. crypto.randomUUID is everywhere modern, and the fallback
    keeps old WebViews posting rather than silently losing the event. */
function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the hand-rolled id */
  }
  const rnd = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}

export type TrackOptions = {
  /** Short machine-readable reason/step, e.g. "wrong_password". */
  detail?: string;
  /** Structured extras. Keep them free of secrets — see the file header. */
  metadata?: Record<string, unknown>;
};

/**
 * Record one client event. Never throws, never awaits: `keepalive` lets the
 * request finish across a navigation (a logout redirect would otherwise kill
 * its own telemetry), and `credentials:'include'` lets the backend attribute
 * the event to the session when there is one.
 */
export function trackEvent(kind: string, opts: TrackOptions = {}): void {
  try {
    if (typeof window === "undefined") return;
    const metadata: Record<string, unknown> = {
      ...(opts.metadata || {}),
      page: window.location.pathname,
    };
    void fetch(`${API_BASE_URL}${TELEMETRY_ENDPOINT}`, {
      method: "POST",
      keepalive: true,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: newEventId(),
        kind,
        ...(opts.detail ? { detail: opts.detail } : {}),
        metadata,
      }),
    }).catch(() => {
      /* telemetry that can't reach the network is telemetry that's gone */
    });
  } catch {
    /* and a broken fetch call itself must not reach the person's screen */
  }
}

/** A trimmed, single-line message — error text is human prose, not a stack. */
function errorLine(err: unknown): string | undefined {
  if (err instanceof Error) return err.message.slice(0, 300) || undefined;
  if (typeof err === "string") return err.slice(0, 300) || undefined;
  return undefined;
}

/**
 * Report an error the UI swallowed. The behaviour stays exactly as it was —
 * this only means it also reaches the backend. Duck-typed so this module
 * doesn't import lib/api (no cycle, no "use client" entanglement).
 */
export function trackError(where: string, err: unknown): void {
  const any = err as { status?: number; code?: string } | null | undefined;
  trackEvent("client_error", {
    detail: where,
    metadata: {
      name: err instanceof Error ? err.name : undefined,
      message: errorLine(err),
      status: typeof any?.status === "number" ? any.status : undefined,
      code: typeof any?.code === "string" ? any.code : undefined,
    },
  });
}

/* ── Quoteable reference ids ───────────────────────────────────────
   The account service answers a 500 with { error, eventId } (and an
   X-Event-Id header); ApiError keeps that body in `.data`. Some flows
   carry `refCode` or a plain `id` instead. Whichever it is, a person
   quoting eight characters beats quoting a screenshot. */

export function errorRef(err: unknown): string | null {
  const data = (err as { data?: Record<string, unknown> } | null)?.data || {};
  const raw =
    data.eventId ?? (err as { eventId?: unknown })?.eventId ??
    data.refCode ?? (err as { refCode?: unknown })?.refCode ??
    data.id ?? null;
  const text = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  const ref = text.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  return ref.length >= 6 ? ref : null;
}

/** Append "Ref: XXXXXXXX" to a failure message when the reply carried an id. */
export function withRef(message: string, err: unknown): string {
  const ref = errorRef(err);
  return ref ? `${message} · Ref: ${ref}` : message;
}

/** Only an address's domain is ever telemetry-safe — a full email never
    leaves this file. */
export function emailDomain(email: string | null | undefined): string | undefined {
  const at = (email || "").trim().lastIndexOf("@");
  const domain = at > 0 ? email!.slice(at + 1).trim().toLowerCase() : "";
  return domain || undefined;
}
