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
