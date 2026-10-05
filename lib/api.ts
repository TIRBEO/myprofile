"use client";

/* ═══════════════════════════════════════════════════════════════════
   Talking to the account service

   Every settings screen needs the same thing: hit a brain endpoint over
   this app's own origin (the catch-all proxy forwards the session cookie)
   and get JSON back. One tiny wrapper keeps that honest — always JSON,
   never cached, and a thrown error carrying the brain's own message so a
   page can show *why* something failed rather than just "failed".

   It also reports whether the service answered at all (see
   lib/service-events): a failed read is the page's business, but a service
   that never answered is the shell's, and both wrappers say so once.
   ═══════════════════════════════════════════════════════════════════ */

import { announceServiceDown, answered } from "@/lib/service-events";
import { SESSION_EXPIRED_EVENT } from "@/lib/profile";

export class ApiError extends Error {
  status: number;
  code?: string;
  /** The parsed reply. A page usually needs the message, but a refusal that
      comes with instructions — "verify yourself, and here are the ways this
      account can" — carries them in fields no message can hold. */
  data?: Record<string, any>;
  constructor(message: string, status: number, code?: string, data?: Record<string, any>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    accept: "application/json",
    ...((init?.headers as Record<string, string> | undefined) || {}),
  };
  // The brain gates cookie-authed writes on a double-submit token: the
  // X-CSRF-Token header must equal the __csrf cookie login set. Reads are exempt.
  if (method !== "GET" && method !== "HEAD" && !headers["x-csrf-token"]) {
    const csrf = csrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
      headers,
    });
  } catch (error) {
    // Offline, aborted, a proxy that dropped the connection — the request never
    // reached the service, which the shell shows exactly as it shows a 5xx.
    announceServiceDown();
    throw error;
  }
  if (!answered(response.status)) announceServiceDown();
  return response;
}

function csrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Read JSON from the brain. Throws ApiError on any non-2xx. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

/** Send a request whose reply we don't read back (writes, deletes). */
export async function apiSend(path: string, init?: RequestInit): Promise<void> {
  const res = await request(path, init);
  if (!res.ok) throw await toError(res);
}

async function toError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let code: string | undefined;
  let body: Record<string, any> | undefined;
  try {
    body = await res.json();
    /* The brain answers a refused proof with a machine token in `error`
       ("REAUTH_REQUIRED") and the sentence a person can act on in `message`.
       Taking the first field that has text would print the token as if it were
       an explanation, so the sentence wins and the token becomes the code. */
    const machine = /^[A-Z][A-Z0-9_]{4,}$/.test(String(body?.error || ""));
    code = machine ? String(body?.error) : body?.code;
    message = (machine ? body?.message || body?.error : body?.error || body?.message) || message;
  } catch {
    /* reply wasn't JSON — keep the status-line message */
  }
  /* A dead credential is the shell's business: one 401 that says "the session
     is no good" moves every screen to the accounts login. Only the plain
     gate answers qualify — a wrong password (401 "Current password is
     incorrect") or a refused second factor (REAUTH_REQUIRED) describe the
     person's input, not the session, and must never bounce them out. */
  if (res.status === 401 && code !== "REAUTH_REQUIRED" &&
      /^(not authenticated|unauthorized|authentication required)/i.test(message)) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return new ApiError(message, res.status, code, body);
}
