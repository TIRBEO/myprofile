import { describe, expect, it } from "vitest";

import { validateProfilePatch } from "./validation";

describe("validateProfilePatch", () => {
  it("accepts a patch with nothing wrong with it", () => {
    expect(
      validateProfilePatch({
        name: "Ada Lovelace",
        username: "ada",
        bio: "Numbers.",
        gender: "female",
        dob: "1815-12-10",
        location: "London",
        website: "https://example.com",
        skills: ["Mathematics", "Writing"],
      }),
    ).toEqual({});
  });

  it("only judges the fields that were actually sent", () => {
    expect(validateProfilePatch({ bio: "Numbers." })).toEqual({});
  });

  it("reports a wrongly-typed field instead of forwarding it upstream", () => {
    // A numeric bio used to pass here, reach the account service, and come
    // back to the user as "the service is unavailable".
    expect(validateProfilePatch({ bio: 12345 })).toEqual({ bio: "Must be text" });
    expect(validateProfilePatch({ gender: 7 })).toEqual({ gender: "Must be text" });
    expect(validateProfilePatch({ jobRole: {} })).toEqual({ jobRole: "Must be text" });
  });

  it("takes null as a request to clear a field, not as a type error", () => {
    expect(validateProfilePatch({ bio: null, gender: null, website: null })).toEqual({});
  });

  describe("required fields", () => {
    it("rejects an empty required field", () => {
      expect(validateProfilePatch({ name: "" })).toEqual({ name: "Needed before you can save" });
      expect(validateProfilePatch({ username: "  " })).toEqual({
        username: "2-30 characters: lowercase letters, numbers, dot or underscore",
      });
      expect(validateProfilePatch({ location: "" })).toEqual({
        location: "Needed before you can save",
      });
    });
  });

  describe("name", () => {
    it("caps the length at the column's limit", () => {
      expect(validateProfilePatch({ name: "x".repeat(61) })).toEqual({
        name: "Keep it under 60 characters",
      });
      expect(validateProfilePatch({ name: "x".repeat(60) })).toEqual({});
    });
  });

  describe("username", () => {
    it("accepts lowercase handles with dot and underscore", () => {
      expect(validateProfilePatch({ username: "ada.lovelace_1" })).toEqual({});
    });

    it("rejects anything the row would refuse", () => {
      const message = "2-30 characters: lowercase letters, numbers, dot or underscore";
      for (const username of ["A", "Ada", "ada!", "a".repeat(31), ""]) {
        expect(validateProfilePatch({ username }), username).toEqual({ username: message });
      }
    });

    it("does not report an unchanged handle as taken by itself", () => {
      expect(
        validateProfilePatch(
          { username: "ada" },
          { currentUsername: "ada", takenUsernames: ["ada", "grace"] },
        ),
      ).toEqual({});
    });

    it("reports a changed handle that is already claimed", () => {
      expect(
        validateProfilePatch(
          { username: "grace" },
          { currentUsername: "ada", takenUsernames: ["grace"] },
        ),
      ).toEqual({ username: "That username is taken" });
    });
  });

  describe("bio", () => {
    it("caps the length at what the row holds, not shorter", () => {
      /* The sheet's own counter runs to 2000 and the column holds 2000. A local
         cap of 200 refused a legal bio — and because the account answers one
         bad field by refusing the whole patch, it took the pronouns and the
         location typed beside it down with it. */
      expect(validateProfilePatch({ bio: "x".repeat(2001) })).toEqual({
        bio: "Bio is limited to 2000 characters",
      });
      expect(validateProfilePatch({ bio: "x".repeat(2000) })).toEqual({});
    });
  });

  describe("column widths", () => {
    const TOO_LONG = (n: number) => "x".repeat(n + 1);
    const CASES: [string, number][] = [
      ["pronouns", 40],
      ["gender", 40],
      ["location", 120],
      ["jobRole", 120],
      ["jobCompany", 120],
      ["jobPlace", 120],
    ];

    it.each(CASES)("refuses %s past its column", (field, max) => {
      expect(validateProfilePatch({ [field]: TOO_LONG(max) })).toEqual({
        [field]: `Keep it under ${max} characters`,
      });
    });

    it.each(CASES)("accepts %s at exactly its column width", (field, max) => {
      expect(validateProfilePatch({ [field]: "x".repeat(max) })).toEqual({});
    });

    /* Kept apart from the loop: a website is judged on its shape as well as its
       length, so the filler here has to stay a parseable address. */
    it("refuses a well-formed address past its column", () => {
      const long = `https://example.com/${"a".repeat(300)}`;
      expect(validateProfilePatch({ website: long })).toEqual({
        website: "Keep it under 300 characters",
      });
    });

    it("does not lose the rest of the patch when one field is over-long", () => {
      const errors = validateProfilePatch({
        pronouns: "They/them",
        location: "Kathmandu, Nepal",
        bio: TOO_LONG(2000),
      });
      expect(errors).toEqual({ bio: "Bio is limited to 2000 characters" });
    });
  });

  describe("dob", () => {
    it("accepts a calendar date", () => {
      expect(validateProfilePatch({ dob: "1815-12-10" })).toEqual({});
      expect(validateProfilePatch({ dob: "" })).toEqual({});
    });

    it("rejects a date that does not exist", () => {
      expect(validateProfilePatch({ dob: "not-a-date" })).toEqual({ dob: "Not a real date" });
    });

    it("rejects a date in the future", () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      expect(validateProfilePatch({ dob: tomorrow })).toEqual({ dob: "Cannot be in the future" });
    });
  });

  describe("website", () => {
    it("takes a full http(s) address", () => {
      expect(validateProfilePatch({ website: "https://example.com" })).toEqual({});
      expect(validateProfilePatch({ website: "http://example.com/about" })).toEqual({});
      expect(validateProfilePatch({ website: "" })).toEqual({});
    });

    it("rejects a bare host or another scheme", () => {
      const message = "Include the full address, starting with https://";
      expect(validateProfilePatch({ website: "example.com" })).toEqual({ website: message });
      expect(validateProfilePatch({ website: "javascript:alert(1)" })).toEqual({ website: message });
    });
  });

  describe("skills", () => {
    it("accepts a short list of strings", () => {
      expect(validateProfilePatch({ skills: ["TypeScript", "PostgreSQL"] })).toEqual({});
      expect(validateProfilePatch({ skills: new Array(8).fill("skill") })).toEqual({});
      expect(validateProfilePatch({ skills: [] })).toEqual({});
    });

    it("rejects something that is not a list", () => {
      expect(validateProfilePatch({ skills: "TypeScript" })).toEqual({
        skills: "Must be a list of items",
      });
    });

    it("rejects a list holding something that is not a skill", () => {
      expect(validateProfilePatch({ skills: ["TypeScript", 42] })).toEqual({
        skills: "Must be a list of items",
      });
    });

    it("caps the number of skills", () => {
      expect(validateProfilePatch({ skills: new Array(9).fill("skill") })).toEqual({
        skills: "Up to 8 skills",
      });
    });

    it("caps the length of one skill", () => {
      expect(validateProfilePatch({ skills: ["x".repeat(61)] })).toEqual({
        skills: "Keep each skill under 60 characters",
      });
      expect(validateProfilePatch({ skills: ["x".repeat(60)] })).toEqual({});
    });
  });

  it("reports every offending field at once, so one save fixes them all", () => {
    expect(validateProfilePatch({ name: "", bio: 1, website: "nope" })).toEqual({
      name: "Needed before you can save",
      bio: "Must be text",
      website: "Include the full address, starting with https://",
    });
  });
});
