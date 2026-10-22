import { beforeEach, describe, expect, it, vi } from "vitest";

/* Three screens, one navigation, the same question. The gate, the support tray
   and the account-status page each asked for what the others were already
   waiting on, and on a dev pool of six connections those duplicate reads are
   what pushed the account-state read past its deadline — the "stuck on
   loading" the reader sees while six identical queries queue behind each
   other. Whoever asks while a read is in the air joins it; the share ends when
   it answers, so a write that just landed is still followed by a real read. */

vi.mock("@/lib/api", () => ({ apiJson: vi.fn(), apiSend: vi.fn() }));

import { apiJson } from "@/lib/api";
import { loadAccountChecks, loadAppeals } from "@/lib/account-status";
import { loadRequests } from "@/lib/support-requests";

function fakeBrowser() {
  const bag = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, v),
    removeItem: (k: string) => void bag.delete(k),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
}

/** A read that answers only when the case says so, so "in flight" is a state a
    test can stand in. */
function held() {
  let settle: (v: unknown) => void = () => {};
  (apiJson as ReturnType<typeof vi.fn>).mockImplementation(
    () => new Promise((resolve) => (settle = resolve)),
  );
  return (value: unknown) => settle(value);
}

beforeEach(() => {
  (apiJson as ReturnType<typeof vi.fn>).mockReset();
  vi.unstubAllGlobals();
  fakeBrowser();
});

describe("one read per question", () => {
  it("the support desk is asked for its list once, by three screens", async () => {
    const settle = held();
    const three = Promise.all([loadRequests(), loadRequests(), loadRequests()]);
    settle({ ok: true, appeals: [] });
    await three;
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it("the account's checks are asked for once", async () => {
    const settle = held();
    const three = Promise.all([loadAccountChecks(), loadAccountChecks(), loadAccountChecks()]);
    settle({ ok: true, level: 0, sections: [] });
    await three;
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it("the appeals are asked for once", async () => {
    const settle = held();
    const two = Promise.all([loadAppeals(), loadAppeals()]);
    settle({ ok: true, appeals: [] });
    await two;
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it("and asks again once the answer has landed", async () => {
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, level: 0, sections: [] });
    await loadAccountChecks();
    await loadAccountChecks();
    expect(apiJson).toHaveBeenCalledTimes(2);
  });

  it("a read that failed is not held up as anybody's answer", async () => {
    (apiJson as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    await expect(loadAccountChecks()).rejects.toThrow("offline");
    (apiJson as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, level: 0, sections: [] });
    await expect(loadAccountChecks()).resolves.toMatchObject({ level: 0 });
  });
});
