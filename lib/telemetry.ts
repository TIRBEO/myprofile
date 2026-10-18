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

/* ── Analytics consent ────────────────────────────────────────────
   The "Analytics cookies" row on Data and permissions is the person's
   answer about measurement. The brain already refuses ingestion of
   analytics-category events without it (features/preferences/dataUsage
   .ts); this stops the posts at the source, so the switch turning off
   actually silences the device rather than just the database. Same three
   rules as the server's gate:

   • absent answer = allow — an account that has never been asked keeps
     reporting exactly what it reports today;
   • while the answer is still loading, events go out — loading consent
     is not withholding it, and this file must never make a person's
     telemetry wait;
   • a failed read = allow — a hiccup must not become mass data loss.

   Only measured behaviour is gated. `client_error` and the sign-in,
   security and account-lifecycle signals the app runs on are not
   "analytics", and unknown kinds are never treated as analytics — a
   classifier must not be the thing that switches off a production signal
   by not knowing it. */

/** Kinds in this app that measure behaviour rather than run the product. */
const ANALYTICS_KINDS = new Set([
  "settings.theme_changed",
  "settings.language_changed",
  "settings.device_viewed",
  "settings.avatar_cropped",
  "settings.profile_updated",
]);

/** Measurement categories, mirroring the server's prefix list, so a kind
    added later lands on the right side of the gate without an edit here. */
const ANALYTICS_PREFIXES = [
  "ui.", "page.", "docs.", "view", "click", "impression", "perf", "web-vital",
  "funnel.", "marketing.", "ads.", "analytics.", "experiment.", "feature.",
];

function isAnalyticsEvent(kind: string): boolean {
  const k = (kind || "").toLowerCase();
  if (!k) return false;
  if (ANALYTICS_KINDS.has(k)) return true;
  // Everything the app depends on stays loud no matter what the switch says.
  if (k.startsWith("client_error") || k.startsWith("auth.") || k.startsWith("settings.")) return false;
  return ANALYTICS_PREFIXES.some((p) => k.startsWith(p));
}

/** The account's stored answer. `null` until read — and unread means allow.
    Read through this app's own origin (the catch-all proxy forwards the
    session cookie), not lib/api: this module never imports it, so a
    consent read cannot drag a telemetry-reporting cycle in behind it. */
let analyticsCookies: boolean | null = null;
let consentProbe: Promise<void> | null = null;

function probeConsent(): void {
  if (consentProbe) return;
  consentProbe = fetch("/api/preferences/data-usage", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((json: { analyticsCookies?: unknown } | null) => {
      analyticsCookies = typeof json?.analyticsCookies === "boolean" ? json.analyticsCookies : true;
    })
    .catch(() => {
      analyticsCookies = true;
    });
}

/** Whether an analytics-category event may leave the device right now. */
function analyticsAllowed(): boolean {
  if (analyticsCookies === null) probeConsent(); // first gated event starts the read
  return analyticsCookies !== false;
}

/** The Data and permissions screen calls this when the answer changes, so
    the gate follows inside the session rather than only after a reload. */
export function noteAnalyticsCookiesConsent(on: boolean): void {
  analyticsCookies = on;
  consentProbe = Promise.resolve(); // a known answer beats the stored one
}

/** One uuid per event so the backend (and a person quoting a "Ref:") can
    dedupe retries. crypto.randomUUID is everywhere modern, and the fallback
    keeps old WebViews posting rather than silently losing the event. */function newEventId(): string {
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
 * the event to the session when there is one. Analytics-category events
 * first pass the consent gate below — an off switch means no request leaves
 * this device at all, not just one the brain throws away.
 */
export function trackEvent(kind: string, opts: TrackOptions = {}): void {
  try {
    if (typeof window === "undefined") return;
    if (isAnalyticsEvent(kind) && !analyticsAllowed()) return;
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
