import { beforeEach, describe, expect, it, vi } from "vitest";

/* localStorage is keyed by the browser, not by the account, so every cache of
   what the account said has to die with it. The one that matters most is the
   lifecycle snapshot: it names a state, a reason and dates, and the settings
   gate paints from it before the first read of a new visit lands. These cases
   pin that sign-out and an account switch both wipe the bag AND the copy the
   module is still holding in memory. */

vi.mock("@/lib/api", () => ({ apiJson: vi.fn(), apiSend: vi.fn() }));

const SNAPSHOT_KEY = "tirbeo:account-state";

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

const snapshot = { state: { status: "banned", reason: "Repeat violations" }, at: Date.now() };

/** One module graph per case: the cache and the lifecycle store must be the
    two copies that actually talk to each other, not one from each side of a
    reset. */
async function load() {
  vi.resetModules();
  const lifecycle = await import("./account-lifecycle");
  const cache = await import("./account-cache");
  return { lifecycle, ...cache };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("clearAccountTraces", () => {
  it("drops the lifecycle snapshot with the rest of the account's traces", async () => {
    const bag = fakeBrowser({ [SNAPSHOT_KEY]: JSON.stringify(snapshot), "tirbeo:edit-profile": "{}" });
    const { lifecycle, clearAccountTraces } = await load();
    expect(lifecycle.accountStateKnown()).toBe(true);

    clearAccountTraces();

    expect(bag.has(SNAPSHOT_KEY)).toBe(false);
    expect(bag.has("tirbeo:edit-profile")).toBe(false);
    expect(lifecycle.getAccountState()).toBeNull();
    expect(lifecycle.accountStateKnown()).toBe(false);
  });

  it("says the account is unknown again, so the next gate cannot paint the last one's lock", async () => {
    fakeBrowser({ [SNAPSHOT_KEY]: JSON.stringify(snapshot) });
    const { lifecycle, clearAccountTraces } = await load();

    clearAccountTraces();

    // "not asked yet", not "open" — the gate holds at its loading screen.
    expect(lifecycle.accountStateKnown()).toBe(false);
    expect(lifecycle.accountStateLoaded()).toBe(false);
    expect(lifecycle.accountStateFailed()).toBe(false);
  });
});

describe("bindAccount", () => {
  it("wipes the traces when the account changes under the same browser", async () => {
    const bag = fakeBrowser({ [SNAPSHOT_KEY]: JSON.stringify(snapshot), "tirbeo:account-id": "ada" });
    const { bindAccount } = await load();

    expect(bindAccount("someone-else")).toBe(true);
    expect(bag.get("tirbeo:account-id")).toBe("someone-else");
    expect(bag.has(SNAPSHOT_KEY)).toBe(false);

    // The same account, announced twice, changes nothing.
    expect(bindAccount("someone-else")).toBe(false);
  });

  it("leaves the traces alone when the server did not say who it is", async () => {
    const bag = fakeBrowser({ [SNAPSHOT_KEY]: JSON.stringify(snapshot), "tirbeo:account-id": "ada" });
    const { bindAccount } = await load();

    expect(bindAccount(null)).toBe(false);
    expect(bag.has(SNAPSHOT_KEY)).toBe(true);
  });
});
