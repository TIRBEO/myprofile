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
    description: "What this build collects, in plain terms.",
    lines: [
      "Everything on these pages — settings, sessions, support requests — is written to this browser's storage and to nowhere else. There is no upload in this app.",
      "No analytics and no campaign code runs here unless you turn it on under Data and permissions, and even then nothing leaves this build.",
      "Clearing this site's data in your browser deletes all of it, and no one can get it back. A different browser or device starts empty.",
    ],
  },
  {
    slug: "terms",
    title: "Terms of service",
    sub: "What this build promises, and what it doesn't.",
    keywords: "terms service conditions agreement licence warranty",
    description: "What this build does and doesn't commit to.",
    lines: [
      "Tirbeo is provided as it is. This build has no backend, so there is no service level to guarantee, no content to license and no account for anyone but you to reinstate.",
      "The controls here do what a browser can do on its own: remember a choice, copy to the clipboard, ask for a permission, vibrate. Where an action would need a server, the page says so instead of pretending.",
      "Nothing is stored about you that you didn't set on these pages yourself.",
    ],
  },
  {
    slug: "community",
    title: "Community guidelines",
    sub: "How people are expected to behave in Tirbeo apps.",
    keywords: "community guidelines conduct harassment hate rules behaviour behavior",
    description: "The behaviour Tirbeo apps ask for.",
    lines: [
      "This build shows your profile to nobody but you, so there is nothing yet to moderate between people.",
      "The rules the rest of Tirbeo runs on are ordinary ones: be who you say you are, leave people alone, no harassment or hate, nothing that sexualises anyone under 18.",
      "Report what you see. Anything you write to support is kept on this device, so if you need it seen by a person, copy it into a message you can actually send.",
    ],
  },
];

export function findPolicy(slug: string | undefined): Policy | null {
  if (!slug) return null;
  return POLICIES.find((row) => row.slug === slug) ?? null;
}
