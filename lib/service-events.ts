"use client";

/* ═══════════════════════════════════════════════════════════════════
   The account service did not answer

   Every settings screen reads through one of two wrappers, and either can
   come back with nothing for reasons that have nothing to do with the
   reader: a 5xx from the brain, a gateway that never answered, a dropped
   connection. Each screen can explain that on its own — and several do —
   but there is only one honest thing the shell can say about all of them
   at once, and only one place to say it.

   So the wrappers announce the failure and the shell shows the same strip
   the session probe raises. One event, no payload.

   Deliberately one-way. A success does not announce the opposite, because
   two requests in flight can answer in either order and the last one to
   land is not the truth — a page whose read failed would have its strip
   wiped by any unrelated 200 that happened to arrive later. The strip
   clears the only way it should: when the reader presses Try again and the
   answers come back clean.
   ═══════════════════════════════════════════════════════════════════ */

export const SERVICE_DOWN = "tirbeo:service-down";

/** Called by the request wrappers when the service did not answer. */
export function announceServiceDown(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SERVICE_DOWN));
}

/** Whether a status means the service answered. Only 5xx says it didn't. */
export function answered(status: number): boolean {
  return status < 500;
}
