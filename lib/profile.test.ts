import { beforeEach, describe, expect, it, vi } from "vitest";

/* The wire answers `null` for every field nobody has filled in, and `Profile`
   types those fields as `string`. Merging one straight through put a `null`
   into a `.trim()` and took the whole edit-profile page down with
   `can't access property "trim", bio is null` — for an account with no bio,
   which is most accounts. The type said it could not happen, so the only thing
   that catches it now is these cases. */

vi.mock("@/lib/api-client", () => ({ fetchProfile: vi.fn(), saveProfile: vi.fn() }));

import { fetchProfile } from "@/lib/api-client";
import type { ProfilePatchResult } from "./api-client";

/** A signed-in account whose profile row is described by `profile`. */
const wire = (profile: Record<string, unknown>): ProfilePatchResult => ({
  ok: true,
  data: { profile, unsupported: [], revision: "1" },
});

/** localStorage + window, which is all this module touches in node. */
function installBrowser() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as any).localStorage = localStorage;
  (globalThis as any).window = {
    localStorage,
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return store;
}

async function load() {
  const mod = await import("./profile");
  return mod;
}

describe("profile wire normalisation", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    vi.resetModules();
    store = installBrowser();
  });

  it("turns a null bio into an empty string rather than passing it through", async () => {
    // The exact shape that crashed: the account row holds a profile, but the
    // bio column is empty.
    vi.mocked(fetchProfile).mockResolvedValue(
      wire({ name: "Ada", username: "ada", bio: null, photoUrl: null, bannerUrl: null }),
    );
    const { syncProfile } = await load();

    const merged = await syncProfile();

    expect(merged?.bio).toBe("");
    expect(merged?.name).toBe("Ada");
  });

  it("empties every nullable string field, not just the bio", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(
      wire({
        name: null,
        username: "ada",
        bio: null,
        pronouns: null,
        location: null,
        website: null,
        gender: null,
        dob: null,
        jobRole: null,
        jobCompany: null,
        jobPlace: null,
        jobStartedOn: null,
        email: null,
        phone: null,
      }),
    );
    const { syncProfile } = await load();

    const merged = await syncProfile();

    for (const key of [
      "name",
      "bio",
      "pronouns",
      "location",
      "website",
      "gender",
      "dob",
      "jobRole",
      "jobCompany",
      "jobPlace",
      "jobStartedOn",
      "email",
      "phone",
    ] as const) {
      expect({ [key]: merged?.[key] }, `${key} should be a string`).toEqual({
        [key]: "",
      });
    }
  });

  it("keeps null for the two fields where null is a real answer", async () => {
    // photoUrl/bannerUrl are `string | null`; blanking them to "" would make
    // every consumer test for emptiness instead of absence.
    vi.mocked(fetchProfile).mockResolvedValue(wire({ photoUrl: null, bannerUrl: null }));
    const { syncProfile } = await load();

    const merged = await syncProfile();

    expect(merged?.photo).toBeNull();
    expect(merged?.banner).toBeNull();
  });

  it("still carries a real photo and banner through", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(
      wire({ photoUrl: "https://cdn/x.png", bannerUrl: "https://cdn/b.png" }),
    );
    const { syncProfile } = await load();

    const merged = await syncProfile();

    expect(merged?.photo).toBe("https://cdn/x.png");
    expect(merged?.banner).toBe("https://cdn/b.png");
  });

  it("reduces a timestamped birthday to the bare date the forms use", async () => {
    // JSON hands back a full ISO timestamp; the date pickers want `YYYY-MM-DD`
    // and would otherwise prefill the control with something unparseable.
    vi.mocked(fetchProfile).mockResolvedValue(wire({ birthday: "1994-03-17T00:00:00.000Z" }));
    const { syncProfile } = await load();

    const merged = await syncProfile();

    expect(merged?.dob).toBe("1994-03-17");
  });

  it("repairs a skills value that is not a list", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(wire({ skills: "design, typescript" }));
    const { syncProfile } = await load();

    const merged = await syncProfile();

    expect(merged?.skills).toEqual([]);
  });

  it("normalises a cache written before this was fixed", async () => {
    // An account that already painted once wrote the nulls back to
    // localStorage. Reading the cache must not hand them out again.
    store.set(
      "tirbeo:edit-profile",
      JSON.stringify({ name: "Ada", bio: null, photo: null, banner: null }),
    );
    const { readProfile } = await load();

    const cached = readProfile();

    expect(cached.bio).toBe("");
    expect(cached.name).toBe("Ada");
    expect(cached.photo).toBeNull();
  });
});