"use client";

/* ═══════════════════════════════════════════════════════════════════
   Who this account is

   The name, the handle, the photo, the line people read and the links
   under it — the part of the account other people see. It used to live
   inside the edit-profile page, which meant the profile screen, the
   navigation and the chat rows each had to guess at it; now they all read
   the same record.

   Still one localStorage key, still nothing sent anywhere. The handle is
   what the profile page is filed under, so it's kept lowercase and
   filesystem-safe in one place rather than tidied up by every caller.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

const STORE = "tirbeo:edit-profile";

export type Profile = {
  name: string;
  /** Dr., Prof., Er. — written before the name, but never part of it. */
  prefix: string;
  /** MBBS, Ph.D. — written after the name, off a comma. */
  suffix: string;
  username: string;
  bio: string;
  pronouns: string;
  location: string;
  dob: string;
  gender: string;
  photo: string | null;
  banner: string | null;
  following: number;
  followers: number;
};

export const DEFAULT_PROFILE: Profile = {
  name: "Soham Dhitle",
  prefix: "",
  suffix: "",
  username: "sohamdhitle",
  bio: "I am a very good boy\nI build cool things",
  pronouns: "He/him",
  location: "Pune, India",
  dob: "1998-04-12",
  gender: "Male",
  photo: null,
  banner: null,
  following: 380,
  followers: 387,
};

/** The titles this region actually writes in front of a name. Held here
    rather than in the form so the picker and the reader agree on the list. */
export const NAME_PREFIXES = ["Dr.", "Prof.", "Er.", "CA.", "Adv.", "Shree", "Smt.", "Km."];

/** The name as it should be read — title in front, qualifications after.
    The pieces are stored apart so the handle, the initial beside an avatar
    and the order of a list can all keep using the bare name: fold "Dr." into
    the name and you get a "D." initial and a `dr-soham` handle. */
export function displayName(profile: Profile): string {
  const before = [profile.prefix.trim(), profile.name.trim()].filter(Boolean).join(" ");
  const after = profile.suffix.trim().replace(/^,\s*/, "");
  return before && after ? `${before}, ${after}` : before || after;
}

/** A title typed straight into the name box belongs in the field beside it,
    not inside the name — left there it drags into the handle, the initial
    beside an avatar and the order of every list. */
export function liftTitle(name: string): { title: string; name: string } {
  const cut = name.indexOf(" ");
  if (cut < 0) return { title: "", name };
  const head = name.slice(0, cut).replace(/\.$/, "");
  const hit = NAME_PREFIXES.find((p) => p.replace(/\.$/, "") === head);
  return hit ? { title: hit, name: name.slice(cut + 1).trim() } : { title: "", name };
}

/** What a typed-in handle becomes: no @, nothing a path can't hold. */
export function slugOf(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
}

export function readProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<Profile>;
    return {
      ...DEFAULT_PROFILE,
      ...saved,
      username: slugOf(saved.username ?? DEFAULT_PROFILE.username),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function writeProfile(next: Profile): Profile {
  const clean: Profile = { ...next, username: slugOf(next.username) };
  try {
    localStorage.setItem(STORE, JSON.stringify(clean));
  } catch {
    /* private mode — it still holds for this session */
  }
  window.dispatchEvent(new Event(PROFILE_EVENT));
  return clean;
}

/** A saved photo is a data URL in a several-hundred-kilobyte string, so the
    navigation and the chat rows shouldn't be re-reading it on every render.
    Anyone who changes the profile announces it here instead. */
export const PROFILE_EVENT = "tirbeo:profile";

/** "Soham Dhitle" → "Soham D." — what fits beside an avatar without
    pushing the rest of the row out. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** `null` until the store has been read, so a page shows its skeleton rather
    than the default name and then correct itself mid-paint. */
export function useProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    const look = () => setProfile(readProfile());
    look();
    window.addEventListener(PROFILE_EVENT, look);
    window.addEventListener("storage", look);
    return () => {
      window.removeEventListener(PROFILE_EVENT, look);
      window.removeEventListener("storage", look);
    };
  }, []);
  return profile;
}
