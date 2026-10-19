import { beforeEach, describe, expect, it, vi } from "vitest";

/* The settings gate paints from whatever this browser last saw and revalidates
   in the background, because it is a presentation gate — the brain's own status
   gate is what refuses a closed account at a door. These cases pin both halves
   of that: a returning reader is not made to watch a spinner for a round trip,
   and a kept answer is never trusted past its short life or past a sign-out. */

vi.mock("@/lib/api", () => ({ apiJson: vi.fn(), apiSend: vi.fn() }));

import { apiJson } from "@/lib/api";

const STORE_KEY = "tirbeo:account-state";

function state(over: Record<string, unknown> = {}) {
  return {
    status: "active",
    reason: null,
    until: null,
    decisionId: null,
    appealFiled: false,
    deactivated: false,
    deactivatedAt: null,
    deactivatedReason: null,
    deletionPending: false,
    deletionFinalAt: null,
    refCode: null,
    signInMethods: { password: true, passkey: false, oauth: [], total: 1 },
    connections: [],
    ...over,
  };
}

/** A browser with nothing but a bag of keys — enough for the store and the
    `ACCOUNT_EVENT` the module fires when an answer lands. */
function fakeBrowser(seed: Record<string, string> = {}) {
  const bag = new Map(Object.entries(seed));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => bag.get(k) ?? null,
      setItem: (k: string, v: string) => void bag.set(k, v),
      removeItem: (k: string) => void bag.delete(k),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return bag;
}

/** A fresh copy of the module, so no case inherits another's memory. */
async function load() {
  vi.resetModules();
  return import("./account-lifecycle");
}

beforeEach(() => {
  (apiJson as ReturnType<typeof vi.fn>).mockReset();
  vi.unstubAllGlobals();
});

describe("the account snapshot", () => {
  it("keeps the answer it read, and a later load paints from it unread", async () => {
    const bag = fakeBrowser();
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue(state({ status: "deactivated" }));
    const first = await load();
    expect((await first.loadAccountState())?.status).toBe("deactivated");
    expect(bag.get(STORE_KEY)).toContain("deactivated");

    // Same browser, next visit: the module hydrates from the bag before anyone
    // asks, so the gate knows the account is paused at once.
    fakeBrowser({ [STORE_KEY]: bag.get(STORE_KEY)! });
    const next = await load();
    apiJson.mockClear();
    expect(next.accountStateKnown()).toBe(true);
    expect(next.accountStateLoaded()).toBe(false);
    expect(next.getAccountState()?.status).toBe("deactivated");
    expect(apiJson).not.toHaveBeenCalled();
  });

  it("does not paint from an answer the account has outgrown", async () => {
    const fresh = { state: state({ status: "banned" }), at: Date.now() };
    const stale = { state: state({ status: "banned" }), at: Date.now() - 6 * 60_000 };

    fakeBrowser({ [STORE_KEY]: JSON.stringify(stale) });
    const expired = await load();
    expect(expired.accountStateKnown()).toBe(false);
    expect(expired.getAccountState()).toBeNull();

    fakeBrowser({ [STORE_KEY]: JSON.stringify(fresh) });
    const alive = await load();
    expect(alive.accountStateKnown()).toBe(true);
  });

  it("shrugs off a bag that holds rubbish", async () => {
    fakeBrowser({ [STORE_KEY]: "{not json" });
    const module = await load();
    expect(module.accountStateKnown()).toBe(false);
  });

  it("keeps the state it knew when the brain stops answering", async () => {
    fakeBrowser();
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue(state({ status: "suspended" }));
    const module = await load();
    await module.loadAccountState();

    (apiJson as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));
    const again = await module.loadAccountState();
    expect(again?.status).toBe("suspended");
    // Failure is only "we could not ask" when there is nothing to fall back on.
    expect(module.accountStateFailed()).toBe(false);
  });

  it("answers two readers of the same fact with one round trip", async () => {
    fakeBrowser();
    let settle: (v: unknown) => void = () => {};
    (apiJson as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (settle = resolve)),
    );
    const module = await load();

    const both = Promise.all([module.loadAccountState(), module.loadAccountState()]);
    settle(state());
    await both;

    expect(apiJson).toHaveBeenCalledTimes(1);
  });
});
