/**
 * Field rules for a profile write, in one place.
 *
 * The screens already render a note under the field that failed, so this
 * returns errors *keyed by field* rather than one message — a single blob of
 * text at the top of a sheet cannot tell you which row to go back to. The keys
 * are the local names the form uses, so the note lands under the right input
 * without a second mapping pass.
 *
 * These are deliberately the same rules the edit-profile screen enforces before
 * enabling Save. A browser-side check is a courtesy; the server cannot trust it,
 * and a write through any other client has to fail for the same reason.
 */

const USERNAME = /^[a-z0-9._]{2,30}$/;
const BIO_MAX = 200;
const NAME_MAX = 60;
/** Same cap the account row enforces per skill, so the check happens here
    instead of costing a round trip and coming back as a mysterious failure. */
const SKILL_MAX = 60;

/** Mirrors `REQ_LABELS` on the edit-profile screen. */
export const REQUIRED_FIELDS = ["name", "username", "location"] as const;

/** Every field the row holds as text. `null` clears one; anything that is not
    a string or null is a client bug, and catching it here is what keeps it
    from reaching the account service as a "service unavailable". */
const TEXT_FIELDS = [
  "name", "username", "bio", "gender", "dob", "photo", "banner",
  "pronouns", "location", "website", "jobRole", "jobCompany",
  "jobPlace", "jobStartedOn",
] as const;

export type FieldErrors = Record<string, string>;

export type ValidateOptions = {
  /** The handle already on the row, so re-saving an unchanged name is not
      reported as a clash with itself. */
  currentUsername?: string;
  /** Held handles to test a *changed* username against. */
  takenUsernames?: string[];
};

export function validateProfilePatch(
  input: Record<string, unknown>,
  options: ValidateOptions = {},
): FieldErrors {
  const errors: FieldErrors = {};

  /* Types first, so a numeric bio is reported as a bad bio rather than sent
     upstream and read back as an outage. */
  for (const key of TEXT_FIELDS) {
    const value = input[key];
    if (value === undefined || value === null || typeof value === "string") continue;
    errors[key] = "Must be text";
  }

  if (input.skills !== undefined && !Array.isArray(input.skills)) {
    errors.skills = "Must be a list of items";
  }

  for (const key of REQUIRED_FIELDS) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim() === "") {
      errors[key] = "Needed before you can save";
    }
  }

  if (typeof input.name === "string" && input.name.trim().length > NAME_MAX) {
    errors.name = `Keep it under ${NAME_MAX} characters`;
  }

  if (typeof input.username === "string" && !USERNAME.test(input.username)) {
    errors.username = "2-30 characters: lowercase letters, numbers, dot or underscore";
  }

  if (typeof input.bio === "string" && input.bio.length > BIO_MAX) {
    errors.bio = `Bio is limited to ${BIO_MAX} characters`;
  }

  if (typeof input.dob === "string" && input.dob !== "") {
    const parsed = new Date(input.dob);
    if (Number.isNaN(parsed.getTime())) errors.dob = "Not a real date";
    else if (parsed.getTime() > Date.now()) errors.dob = "Cannot be in the future";
  }

  if (typeof input.website === "string" && input.website !== "") {
    let ok = true;
    try {
      const url = new URL(input.website);
      ok = url.protocol === "https:" || url.protocol === "http:";
    } catch {
      ok = false;
    }
    if (!ok) errors.website = "Include the full address, starting with https://";
  }

  if (Array.isArray(input.skills)) {
    if (input.skills.some((skill) => typeof skill !== "string")) {
      errors.skills = "Must be a list of items";
    } else if (input.skills.length > 8) {
      errors.skills = "Up to 8 skills";
    } else if (input.skills.some((skill) => skill.length > SKILL_MAX)) {
      errors.skills = `Keep each skill under ${SKILL_MAX} characters`;
    }
  }

  /* A handle is claimed once, so an unchanged one must not be reported as
     taken by the re-validation on save. */
  if (
    typeof input.username === "string" &&
    input.username !== options.currentUsername &&
    options.takenUsernames?.includes(input.username)
  ) {
    errors.username = "That username is taken";
  }

  return errors;
}
