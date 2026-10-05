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
    it("caps the length", () => {
      expect(validateProfilePatch({ bio: "x".repeat(201) })).toEqual({
        bio: "Bio is limited to 200 characters",
      });
      expect(validateProfilePatch({ bio: "x".repeat(200) })).toEqual({});
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
