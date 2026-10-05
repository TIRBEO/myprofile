/**
 * What this service attaches to a write on behalf of the browser that made it.
 *
 * The account service owns the change record, so the machine and place on that
 * record can only come from here — and the values come from a client, onto a
 * new request. Both halves matter: a write that loses them blames the datacentre
 * for the owner's edit, and a write that forwards them raw lets a value reach a
 * call signed with this service's own secret.
 *
 * fetch is stubbed and the headers are a plain object with a `get` — the real
 * Headers rejects CR/LF on construction, which would hide the sanitising this
 * file is here to pin down. No server, Redis or database is involved.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

let sent: { url: string; method: string; headers: Record<string, string> } | null = null;

beforeAll(() => {
  process.env.INTERNAL_API_SECRET = "test-service-secret";
  process.env.API_INTERNAL_BASE_URL = "http://brain.test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: any) => {
      sent = {
        url: String(url),
        method: String(init?.method || "GET"),
        headers: { ...(init?.headers || {}) },
      };
      return new Response(JSON.stringify({ id: "u1", updatedAt: "2026-10-02T00:00:00.000Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  sent = null;
});

import { originFacts, writeProfile, type OriginFacts } from "./transport";

/** Only `.get()` is ever called on these, so a stub keeps invalid values legal. */
const request = (pairs: Record<string, string>) =>
  ({ get: (name: string) => pairs[name.toLowerCase()] ?? null } as unknown as Headers);

const NOTHING: OriginFacts = { ip: null, userAgent: null, city: null, country: null, lat: null, lng: null };

describe("originFacts — the browser's own facts, before the hop", () => {
  it("takes the client off the head of the proxy chain", () => {
    const facts = originFacts(
      request({
        "x-forwarded-for": "203.0.113.9, 10.0.0.1, 192.168.0.2",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      }),
    );
    expect(facts.ip).toBe("203.0.113.9");
    expect(facts.userAgent).toContain("iPhone");
  });

  it("prefers the Vercel edge and falls back to Cloudflare", () => {
    expect(originFacts(request({ "x-vercel-ip-country": "NP", "cf-ipcountry": "US" })).country).toBe("NP");
    expect(originFacts(request({ "cf-ipcountry": "US" })).country).toBe("US");
    expect(originFacts(request({ "x-vercel-ip-city": "Pune" })).city).toBe("Pune");
    // A proxy that only tells us x-real-ip is still an address worth recording.
    expect(originFacts(request({ "x-real-ip": "198.51.100.3" })).ip).toBe("198.51.100.3");
    // The coordinates ride along as the edge's own words; the account service
    // is the one that decides whether they are numbers worth pinning.
    const pinned = originFacts(
      request({ "x-vercel-ip-latitude": "27.7172", "x-vercel-ip-longitude": "85.3240" }),
    );
    expect(pinned).toMatchObject({ lat: "27.7172", lng: "85.3240" });
  });

  it("says nothing about a local request instead of filling in a guess", () => {
    expect(originFacts(request({}))).toEqual(NOTHING);
    // Placeholders some proxies send when they have no answer.
    expect(originFacts(request({ "x-forwarded-for": "unknown", "x-vercel-ip-city": "undefined" }))).toMatchObject({
      ip: null,
      city: null,
    });
  });
});

describe("the hop to the account service", () => {
  it("carries the origin as x-origin-* and keeps its own signature", async () => {
    await writeProfile(
      "u1",
      { name: "Bishnu" },
      undefined,
      originFacts(request({ "x-forwarded-for": "203.0.113.9", "user-agent": "Mozilla/5.0 (Macintosh)", "cf-ipcountry": "NP", "x-vercel-ip-latitude": "27.7172", "x-vercel-ip-longitude": "85.3240" })),
    );
    expect(sent?.url).toBe("http://brain.test/api/internal/profile");
    expect(sent?.method).toBe("PATCH");
    expect(sent?.headers).toMatchObject({
      "x-internal-token": "test-service-secret",
      "x-user-id": "u1",
      "x-origin-ip": "203.0.113.9",
      "x-origin-user-agent": "Mozilla/5.0 (Macintosh)",
      "x-origin-country": "NP",
      "x-origin-lat": "27.7172",
      "x-origin-lng": "85.3240",
    });
    // A profile call never carries the browser's cookie — the user id is the claim.
    expect(sent?.headers.cookie).toBeUndefined();
  });

  it("sends no x-origin-* header when nothing was collected", async () => {
    await writeProfile("u1", { name: "Bishnu" });
    expect(Object.keys(sent?.headers || {}).filter((k) => k.startsWith("x-origin-"))).toEqual([]);
  });

  it("sends only the facts that were actually there", async () => {
    await writeProfile("u1", { name: "Bishnu" }, undefined, { ...NOTHING, country: "NP" });
    expect(sent?.headers).toMatchObject({ "x-origin-country": "NP" });
    expect("x-origin-ip" in (sent?.headers || {})).toBe(false);
    expect("x-origin-user-agent" in (sent?.headers || {})).toBe(false);
  });

  it("keeps a collected value from becoming a second header on the signed call", async () => {
    await writeProfile("u1", { name: "X" }, undefined, {
      ip: "203.0.113.9\r\nx-user-id: someone-else",
      userAgent: "Mozilla\r\n\r\nPOST /api/internal/admin HTTP/1.1",
      city: "Kath%E2%80%99mandu",
      country: "NP",
      lat: null,
      lng: null,
    });
    expect(sent?.headers["x-origin-ip"]).toBe("203.0.113.9x-user-id: someone-else");
    expect(sent?.headers["x-origin-user-agent"]).toBe("MozillaPOST /api/internal/admin HTTP/1.1");
    // An edge-encoded city is ASCII already and travels unchanged for the brain
    // to decode; the CRLF around it does not.
    expect(sent?.headers["x-origin-city"]).toBe("Kath%E2%80%99mandu");
    expect(sent?.headers["x-user-id"]).toBe("u1");
  });

  it("drops a value that is nothing but characters the wire cannot carry", async () => {
    await writeProfile("u1", { name: "X" }, undefined, { ...NOTHING, city: "नालंदा" });
    expect("x-origin-city" in (sent?.headers || {})).toBe(false);
  });

  it("caps what a browser could otherwise pad out", async () => {
    await writeProfile("u1", { name: "X" }, undefined, { ...NOTHING, userAgent: "a".repeat(5000) });
    expect((sent?.headers["x-origin-user-agent"] || "").length).toBe(300);
  });
});
