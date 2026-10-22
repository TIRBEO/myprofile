import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_STATE_BOOT, SIGNED_OUT_ANSWER } from "@/lib/account-prefetch";

/* The boot script runs before any bundle, so nothing here can import it under
   test — it is evaluated as the string the layout inlines, against a browser
   thin enough to hold only what the script touches. Two facts are worth
   pinning, because both were the cost of a page that could not load: the read
   must not start on a path that has no session to ask about, and a 401 must
   come back as the answer it is rather than as "no answer". */

function bootAt(path: string, reply: { status?: number; body?: unknown } = null) {
  const held: Record<string, unknown> = {};
  const fetch = vi.fn(async () =>
    reply === null
      ? undefined
      : {
          status: reply.status ?? 200,
          ok: (reply.status ?? 200) >= 200 && (reply.status ?? 200) < 300,
          json: async () => reply.body ?? {},
        },
  );
  vi.stubGlobal("window", held);
  vi.stubGlobal("location", { pathname: path });
  vi.stubGlobal("fetch", fetch);
  // eslint-disable-next-line no-eval
  (0, eval)(ACCOUNT_STATE_BOOT);
  return { held, fetch };
}

const marker = (held: Record<string, unknown>) =>
  (held.__tirbeoAccountState as Promise<unknown> | undefined) ?? null;

describe("the account-state boot read", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("starts on a settings page and hands over a promise", async () => {
    const { held, fetch } = bootAt("/settings/security", { body: { status: "active" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(marker(held)).resolves.toMatchObject({ status: "active" });
  });

  it("does not ask on the sign-in screen, where there is no session to read", async () => {
    for (const path of ["/login", "/oauth-complete", "/"]) {
      const { held, fetch } = bootAt(path);
      expect(fetch).not.toHaveBeenCalled();
      expect(marker(held)).toBeNull();
    }
  });

  it("names a refused cookie instead of calling it a missing answer", async () => {
    const { held } = bootAt("/settings", { status: 401 });
    await expect(marker(held)).resolves.toBe(SIGNED_OUT_ANSWER);
  });

  it("leaves anything else for the page to ask about again", async () => {
    await expect(marker(bootAt("/settings", { status: 502 }).held)).resolves.toBeNull();
    await expect(marker(bootAt("/settings", null).held)).resolves.toBeNull();
  });
});
