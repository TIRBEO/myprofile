import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The probe is the only thing standing between a signed-in reader and the
   login page, so the three answers it can give are pinned here individually.
   The old boolean collapsed a 5xx into a 401 and logged people out over a
   gateway timeout; each case below is a way that must not happen again.

   The state lives on globalThis (see lib/session.ts), so every case clears it
   and re-imports the module — otherwise a cached "ok" from the previous test
   would answer for this one. */
vi.mock("@/lib/api-client", () => ({ fetchProfile: vi.fn() }));

import type { ProfilePatchResult } from "./api-client";

const signedIn = (): ProfilePatchResult => ({
  ok: true,
  data: { profile: { name: "Ada" }, unsupported: [], revision: "1" },
});

const unauthorized = (): ProfilePatchResult => ({ ok: false, kind: "unauthorized", loginUrl: "/login" });

const unavailable = (): ProfilePatchResult => ({
  ok: false,
  kind: "unavailable",
  message: "upstream_unavailable",
});

/** A fresh copy of the module plus the mocked endpoint it will call. */
async function load() {
  vi.resetModules();
  const client = await import("@/lib/api-client");
  const session = await import("./session");
  return { session, fetchProfile: vi.mocked(client.fetchProfile) };
}

beforeEach(() => {
  delete (globalThis as Record<string, unknown>).__tirbeoSessionProbe;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("probeSessionState", () => {
  it("answers ok when the profile endpoint answers", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockResolvedValue(signedIn());

    await expect(session.probeSessionState()).resolves.toBe("ok");
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("answers unauthorized on a 401 — the one answer that ends a session", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockResolvedValue(unauthorized());

    await expect(session.probeSessionState()).resolves.toBe("unauthorized");
  });

  it("answers unavailable on a 5xx, so a gateway timeout never looks like a logout", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockResolvedValue(unavailable());

    await expect(session.probeSessionState()).resolves.toBe("unavailable");
  });
});

describe("caching", () => {
  it("asks once, then answers from the cache", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockResolvedValue(signedIn());

    await session.probeSessionState();
    await session.probeSessionState();
    await session.probeSessionState();

    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("asks again when the reader presses Try again", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockResolvedValue(unavailable());

    await expect(session.probeSessionState()).resolves.toBe("unavailable");
    fetchProfile.mockResolvedValue(signedIn());

    await expect(session.probeSessionState({ fresh: true })).resolves.toBe("ok");
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("shares one request between callers that ask at the same time", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockImplementation(
      () =>
        new Promise<ProfilePatchResult>((resolve) => setTimeout(() => resolve(signedIn()), 5)),
    );

    const answers = await Promise.all([
      session.probeSessionState(),
      session.probeSessionState(),
      session.probeSessionState(),
    ]);

    expect(answers).toEqual(["ok", "ok", "ok"]);
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("does not let a probe in the air revive a session that signed out mid-flight", async () => {
    const { session, fetchProfile } = await load();
    // endSession() only acts in a browser — give it the least it needs, and a
    // fetch that never leaves the process.
    vi.stubGlobal("window", {
      localStorage: { removeItem: vi.fn(), setItem: vi.fn() },
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    let settle: (result: ProfilePatchResult) => void = () => {};
    fetchProfile.mockImplementation(
      () => new Promise<ProfilePatchResult>((resolve) => (settle = resolve)),
    );

    const inFlight = session.probeSessionState();
    session.endSession(); // the reader logged out while the request was out
    settle(signedIn());
    await inFlight;

    // The sign-out's answer is the newer one, and it is already cached.
    await expect(session.probeSessionState()).resolves.toBe("unauthorized");
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });
});

describe("the shared store", () => {
  it("keeps its answer where a second copy of the module can find it", async () => {
    const { session, fetchProfile } = await load();
    fetchProfile.mockResolvedValue(signedIn());
    await session.probeSessionState();

    // A second copy of the module — the duplicate chunk that made the shell ask
    // twice — must see the same cache and not ask again.
    vi.resetModules();
    const second = await import("./session");
    await expect(second.probeSessionState()).resolves.toBe("ok");
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect((globalThis as Record<string, unknown>)[second.PROBE_STORE_KEY]).toBeDefined();
  });
});
