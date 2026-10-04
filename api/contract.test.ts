import { describe, expect, it } from "vitest";

import { PROFILE_FIELDS, UNSUPPORTED_FIELDS, fromWire, toWire, unsupportedDetails } from "./contract";

describe("PROFILE_FIELDS", () => {
  it("declares each local name once, so no field can shadow another", () => {
    const locals = PROFILE_FIELDS.map((f) => f.local);
    expect(new Set(locals).size).toBe(locals.length);
  });

  it("keeps the fields the row owns out of the writable set", () => {
    for (const local of ["email", "phone"]) {
      expect(PROFILE_FIELDS.find((f) => f.local === local)?.writable).toBe(false);
    }
  });
});

describe("toWire", () => {
  it("maps every local name onto its column name", () => {
    expect(
      toWire({
        name: "Ada",
        photo: "https://cdn/p.png",
        jobRole: "Engineer",
        jobCompany: "ACME",
        jobPlace: "Kathmandu",
        jobStartedOn: "2021-03",
      }),
    ).toEqual({
      name: "Ada",
      photoUrl: "https://cdn/p.png",
      companyRole: "Engineer",
      companyName: "ACME",
      jobPlace: "Kathmandu",
      jobStarted: "2021-03",
    });
  });

  it("carries skills — dropping them saved nothing and still reported success", () => {
    expect(toWire({ skills: ["TypeScript", "PostgreSQL"] })).toEqual({
      skills: ["TypeScript", "PostgreSQL"],
    });
    expect(toWire({ skills: [] })).toEqual({ skills: [] });
  });

  it("turns a plain calendar date into the timestamp the row holds", () => {
    expect(toWire({ dob: "1990-05-06" })).toEqual({ birthday: "1990-05-06T00:00:00.000Z" });
  });

  it("never sends the fields the account row owns", () => {
    expect(toWire({ name: "Ada", email: "ada@example.com", phone: "+9779800000000" })).toEqual({
      name: "Ada",
    });
  });

  it("drops keys it does not know, so a stray field cannot reach the row", () => {
    expect(toWire({ notAField: 1 })).toEqual({});
  });

  it("sends null to clear a field rather than omitting it", () => {
    expect(toWire({ bio: null })).toEqual({ bio: null });
  });
});

describe("fromWire", () => {
  it("maps every column name back onto its local name", () => {
    expect(
      fromWire({
        photoUrl: "https://cdn/p.png",
        companyRole: "Engineer",
        companyName: "ACME",
        jobPlace: "Kathmandu",
        jobStarted: "2021-03",
        birthday: "1990-05-06T00:00:00.000Z",
        skills: ["TypeScript"],
        email: "ada@example.com",
        phoneNumber: "+9779800000000",
      }),
    ).toEqual({
      photo: "https://cdn/p.png",
      jobRole: "Engineer",
      jobCompany: "ACME",
      jobPlace: "Kathmandu",
      jobStartedOn: "2021-03",
      dob: "1990-05-06",
      skills: ["TypeScript"],
      email: "ada@example.com",
      phone: "+9779800000000",
    });
  });

  it("reduces a timestamp to the bare date the form shows", () => {
    expect(fromWire({ birthday: "1990-05-06T00:00:00.000Z" })).toEqual({ dob: "1990-05-06" });
  });

  it("omits columns the row did not return instead of inventing blanks", () => {
    expect(fromWire({})).toEqual({});
  });
});

describe("a round trip", () => {
  it("returns the values it was given, so an edit survives a save and reload", () => {
    const local = {
      name: "Ada Lovelace",
      username: "ada",
      bio: "Numbers.",
      gender: "female",
      dob: "1815-12-10",
      photo: null,
      jobRole: "Mathematician",
      jobCompany: "Analytical Engine",
      jobPlace: "London",
      jobStartedOn: "1833-01",
      skills: ["Mathematics", "Writing"],
    };

    expect(fromWire(toWire(local))).toEqual(local);
  });
});

describe("unsupportedDetails", () => {
  it("reports only the unsupported fields the caller actually tried to change", () => {
    expect(unsupportedDetails({ name: "Ada" })).toEqual([]);
    expect(unsupportedDetails({ followers: 12 })).toEqual([
      { field: "followers", reason: "counted from the social graph, not editable" },
    ]);
  });

  it("names every remaining local-only field, so the set cannot drift silently", () => {
    expect(UNSUPPORTED_FIELDS.map((f) => f.local)).toEqual(["followers", "following"]);
  });
});
