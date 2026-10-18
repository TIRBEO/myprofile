import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The tray this cleans up after itself from was seeded with six invented rows,
   and every browser that opened that page pushed them into the account's
   settings bag — where an archive export would find them and hand a stranger's
   fake "trip plan" to somebody as a copy of their own data. So the two
   behaviours that matter are pinned: it clears what is there, and it never
   writes when there is nothing to clear.

   The store is mocked rather than a fake localStorage, because the thing being
   tested is which call this makes against it — and `adoptLegacy`, which the
   first draft called, is exactly the call that would have re-uploaded the
   fiction on the way to deleting it. */
vi.mock("@/lib/remote-store", () => ({
  ensureSettings: vi.fn(async () => ({})),
  getStored: vi.fn(() => []),
  setStored: vi.fn(),
}));

import { ensureSettings, getStored, setStored } from "@/lib/remote-store";
import { retireDeletedTray } from "@/lib/retired-tray";

const TRAY = "tirbeo:your-activity:deleted";

/** The function is fire-and-forget on an effect, so the assertions have to
    wait for the microtask its `.then` runs on. */
const settled = () => new Promise((tick) => setTimeout(tick, 0));

const seededRow = { id: "abc-note", kind: "Note", label: "Upper Mustang trip plan", deletedAt: 1 };

beforeEach(() => {
  vi.mocked(ensureSettings).mockClear();
  vi.mocked(getStored).mockClear();
  vi.mocked(setStored).mockClear();
  (globalThis as Record<string, unknown>).window = {};
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("retireDeletedTray", () => {
  it("empties a bag that still holds the seeded rows", async () => {
    vi.mocked(getStored).mockReturnValue([seededRow, seededRow, seededRow]);

    retireDeletedTray();
    await settled();

    expect(setStored).toHaveBeenCalledTimes(1);
    expect(setStored).toHaveBeenCalledWith(TRAY, []);
  });

  it("does not write when the tray is already empty", async () => {
    vi.mocked(getStored).mockReturnValue([]);

    retireDeletedTray();
    await settled();

    expect(setStored).not.toHaveBeenCalled();
  });

  it("clears a value that is not a tray at all, rather than leaving it", async () => {
    vi.mocked(getStored).mockReturnValue("somebody's earlier shape" as unknown as never);

    retireDeletedTray();
    await settled();

    expect(setStored).toHaveBeenCalledWith(TRAY, []);
  });

  it("waits for the account's bag before reading, so the mirror never answers", async () => {
    vi.mocked(getStored).mockReturnValue([seededRow]);

    retireDeletedTray();
    // Nothing has been read yet: the bag is still on its way.
    expect(getStored).not.toHaveBeenCalled();

    await settled();
    expect(ensureSettings).toHaveBeenCalledTimes(1);
    expect(getStored).toHaveBeenCalledWith(TRAY, []);
  });

  it("does nothing on the server, where there is no browser to clean", async () => {
    delete (globalThis as Record<string, unknown>).window;

    retireDeletedTray();
    await settled();

    expect(ensureSettings).not.toHaveBeenCalled();
    expect(setStored).not.toHaveBeenCalled();
  });
});
