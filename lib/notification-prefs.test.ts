import { beforeEach, describe, expect, it, vi } from "vitest";

/* The notifications page and the settings hub both ask the account the same
   question, and in dev a page mounts twice — so the same GET used to arrive at
   the brain two and three times for one visit. These cases pin the fix: one
   read per answer, whoever asks, and a read that is actually re-asked when the
   page says refresh. Nothing here is a localStorage cache: the values handed
   out are only ever what the brain answered. */

vi.mock("@/lib/api", () => ({ apiJson: vi.fn() }));

import { apiJson } from "@/lib/api";

const ACCOUNT_ANSWER = {
  emailPaused: false,
  emailPausedUntil: null,
  productEmail: true,
  offersEmail: false,
  tipsEmail: true,
  summaryEnabled: true,
  summaryFrequency: "weekly",
};

/** A fresh copy of the module each case, so no case inherits another's answer. */
async function load() {
  vi.resetModules();
  return import("./notification-prefs");
}

beforeEach(() => {
  (apiJson as ReturnType<typeof vi.fn>).mockReset();
});

describe("readEmailPrefs", () => {
  it("answers two callers of the same read with one request", async () => {
    const { readEmailPrefs } = await load();
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ACCOUNT_ANSWER });

    const [a, b] = await Promise.all([readEmailPrefs(), readEmailPrefs()]);

    expect(apiJson).toHaveBeenCalledTimes(1);
    expect(a).toEqual(ACCOUNT_ANSWER);
    expect(b).toEqual(ACCOUNT_ANSWER);
  });

  it("serves a second mount from the answer the brain just gave", async () => {
    const { readEmailPrefs } = await load();
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ACCOUNT_ANSWER });

    await readEmailPrefs();
    const again = await readEmailPrefs();

    expect(apiJson).toHaveBeenCalledTimes(1);
    expect(again).toEqual(ACCOUNT_ANSWER);
  });

  it("asks the account again when the page pulls to refresh", async () => {
    const { readEmailPrefs } = await load();
    (apiJson as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...ACCOUNT_ANSWER })
      .mockResolvedValueOnce({ ...ACCOUNT_ANSWER, emailPaused: true });

    await readEmailPrefs();
    const refreshed = await readEmailPrefs({ refresh: true });

    expect(apiJson).toHaveBeenCalledTimes(2);
    expect(refreshed.emailPaused).toBe(true);
  });

  it("keeps the failure as the page's own and lets the next read try again", async () => {
    const { readEmailPrefs } = await load();
    (apiJson as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...ACCOUNT_ANSWER });

    await expect(readEmailPrefs()).rejects.toThrow("offline");
    // A read that never landed is not an answer worth sharing.
    expect(await readEmailPrefs()).toEqual(ACCOUNT_ANSWER);
    expect(apiJson).toHaveBeenCalledTimes(2);
  });
});

describe("saveEmailPrefs", () => {
  it("puts the account's merged reply where every reader will find it", async () => {
    const { readEmailPrefs, saveEmailPrefs } = await load();
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ACCOUNT_ANSWER });
    await readEmailPrefs();

    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ACCOUNT_ANSWER,
      offersEmail: true,
      emailPaused: true,
    });
    const saved = await saveEmailPrefs({ offersEmail: true });
    expect(saved.offersEmail).toBe(true);

    // The hub's badge reads this next, without another round trip, and sees
    // what the account really holds rather than what the patch hoped for.
    (apiJson as ReturnType<typeof vi.fn>).mockClear();
    const after = await readEmailPrefs();
    expect(apiJson).not.toHaveBeenCalled();
    expect(after).toEqual({ ...ACCOUNT_ANSWER, offersEmail: true, emailPaused: true });
  });

  it("sends the patch as a PUT and nothing else", async () => {
    const { saveEmailPrefs } = await load();
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ACCOUNT_ANSWER });

    await saveEmailPrefs({ tipsEmail: false });

    expect(apiJson).toHaveBeenCalledWith(
      "/api/notifications/prefs",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ tipsEmail: false }) }),
    );
  });
});

/* The pause, read the way the senders read it. A switch that says "paused"
   while the mail keeps coming is worse than no switch at all, so the rule
   that a date already behind us means "not paused" is pinned here — on both
   sides: the screen and the account. */
describe("the pause", () => {
  const NOW = 1_800_000_000_000;

  it("holds while the date is still ahead of us", async () => {
    const { isPaused, pauseLabel } = await load();
    const prefs = { emailPaused: true, emailPausedUntil: NOW + 60_000 };

    expect(isPaused(prefs, NOW)).toBe(true);
    expect(pauseLabel(prefs, NOW)).toMatch(/^until /);
  });

  it("holds for good when there is no end date", async () => {
    const { isPaused, pauseLabel } = await load();
    const prefs = { emailPaused: true, emailPausedUntil: null };

    expect(isPaused(prefs, NOW)).toBe(true);
    expect(pauseLabel(prefs, NOW)).toBe("until you turn it back on");
  });

  it("is over once its date is behind us, with nobody running a job", async () => {
    const { isPaused, pauseLabel, hasLapsed } = await load();
    const prefs = { emailPaused: true, emailPausedUntil: NOW - 1 };

    expect(isPaused(prefs, NOW)).toBe(false);
    expect(hasLapsed(prefs, NOW)).toBe(true);
    expect(pauseLabel(prefs, NOW)).toBe("");
  });

  it("is not a pause at all when the switch was never thrown", async () => {
    const { isPaused, hasLapsed, clearingLapsed } = await load();
    const prefs = { emailPaused: false, emailPausedUntil: null };

    expect(isPaused(prefs, NOW)).toBe(false);
    expect(hasLapsed(prefs, NOW)).toBe(false);
    expect(clearingLapsed(prefs, NOW)).toEqual({});
  });

  it("clears a pause that ran out, so the account stops saying 'paused'", async () => {
    const { clearingLapsed } = await load();
    const lapsed = { emailPaused: true, emailPausedUntil: NOW - 1 };

    expect(clearingLapsed(lapsed, NOW)).toEqual({ emailPaused: false, emailPausedUntil: null });
  });

  it("leaves a live pause alone — a lapsed clear would end it early", async () => {
    const { clearingLapsed } = await load();
    const live = { emailPaused: true, emailPausedUntil: NOW + 60_000 };

    expect(clearingLapsed(live, NOW)).toEqual({});
  });
});
