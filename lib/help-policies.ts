/* ═══════════════════════════════════════════════════════════════════
   The policy documents

   Three pages of plain text, held here so the help list and the page
   that reads them out can't drift apart. They live in a file rather
   than a sheet because a policy is something you read, not something
   you dismiss.
   ═══════════════════════════════════════════════════════════════════ */

export type Policy = {
  slug: string;
  title: string;
  /** One line for the list. */
  sub: string;
  /** Extra words the help search should answer to. */
  keywords: string;
  /** The line under the title on its own page. */
  description: string;
  lines: string[];
};

export const POLICIES: Policy[] = [
  {
    slug: "privacy",
    title: "Privacy policy",
    sub: "What is collected here, and where it goes.",
    keywords: "privacy policy personal data collected tracking",
    description: "What this app collects, in plain terms.",
    lines: [
      "Your settings, profile, sessions, security log and support requests are stored on your Tirbeo account, on Tirbeo's servers — not just in this browser. Signing in from another device shows the same account, because the account is the store.",
      "Product analytics is off until you turn it on under Data and permissions; crash reports are on and can be turned off there too. Only what those switches cover leaves your device beyond the account data above, and no campaign tracking runs here without your answer.",
      "Clearing this site's data in your browser logs this device out and drops this browser's local copy — it does not delete what your account holds. Deleting your account does, after a short waiting period that lets you change your mind, and then the backups age out.",
      "You can take everything with you: Download your data produces a file of the account's own records — profile, settings, sessions, security events, messages you filed.",
    ],
  },
  {
    slug: "terms",
    title: "Terms of service",
    sub: "What this app promises, and what it doesn't.",
    keywords: "terms service conditions agreement licence warranty",
    description: "What this app does and doesn't commit to.",
    lines: [
      "Tirbeo runs on a backend: the choices you make here are saved to your account, sign-out ends real sessions on real servers, verification codes are actually mailed, and a support request is read by a person who can act on it.",
      "We aim to keep it running and your data yours, but the service is provided as it is: no uptime guarantee is promised here, and the honest status of an outage is said on the screen rather than papered over.",
      "Account decisions — restrictions and their appeals — are recorded on your account with a reference, and a reviewer's decision is shown back to you rather than sent to a private pile.",
      "Nothing about you is kept here beyond what these pages create: the account you opened, the settings you set, and the record of what happened to the account.",
    ],
  },
  {
    slug: "community",
    title: "Community guidelines",
    sub: "How people are expected to behave in Tirbeo apps.",
    keywords: "community guidelines conduct harassment hate rules behaviour behavior",
    description: "The behaviour Tirbeo apps ask for.",
    lines: [
      "What other people can see of you is what your profile and privacy settings let them see — the profile page in these settings is where that line is drawn.",
      "The rules the rest of Tirbeo runs on are ordinary ones: be who you say you are, leave people alone, no harassment or hate, nothing that sexualises anyone under 18.",
      "Report what you see. Write to support from these pages and the request is filed on your account with a reference — you'll see what the reviewer decided here, and you can quote that reference if you follow up.",
    ],
  },
];

export function findPolicy(slug: string | undefined): Policy | null {
  if (!slug) return null;
  return POLICIES.find((row) => row.slug === slug) ?? null;
}
