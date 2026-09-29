import type { LucideIcon } from "lucide-react";
import { ARTICLES } from "@/lib/docs";
import {
  Activity,
  CircleAlert,
  CircleHelp,
  Download,
  Fingerprint,
  Globe,
  History,
  KeyRound,
  Mail,
  Monitor,
  Palette,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";

/* ── Navigation model ────────────────────────────────────────────
   Single source of truth for the app shell: the desktop rail, the
   mobile drawer, the bottom tab bar and ⌘K search all read from
   here, so a new page only has to be added once.                  */

export type NavItem = {
  href: string;
  label: string;
  /** One-line explanation — shown under the page title and in search. */
  description: string;
  icon: LucideIcon;
  /** Extra search terms so "2fa" or "logout" still find the page. */
  keywords?: string;
};

export type NavGroup = {
  id: string;
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "usage",
    title: "How you use Tirbeo",
    items: [
      {
        href: "/settings/edit-profile",
        label: "Edit profile",
        description: "Your photo, name, handle and bio",
        icon: UserRound,
        keywords: "avatar picture name username handle bio website",
      },
      {
        href: "/settings/personal-details",
        label: "Personal details",
        description: "Work, education and skills",
        icon: UserRound,
        keywords: "dob birthday age location company industry work",
      },
      {
        href: "/settings/notifications",
        label: "Email preferences",
        description: "Emails from Tirbeo, digests and pausing them",
        icon: Mail,
        keywords: "email emails digest newsletter summary pause notifications alerts",
      },
      {
        href: "/settings/appearance",
        label: "Appearance",
        description: "Light, dark or system theme",
        icon: Palette,
        keywords: "theme dark light system colour color appearance",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    items: [
      {
        href: "/settings/security",
        label: "Password and security",
        description: "Change your password and sign-in options",
        icon: ShieldCheck,
        keywords: "password change login saved session recovery",
      },
      {
        href: "/settings/two-factor",
        label: "Two-factor authentication",
        description: "A second step when you sign in",
        icon: KeyRound,
        keywords: "2fa mfa otp authenticator sms email code backup",
      },
      {
        href: "/settings/passkeys",
        label: "Passkeys",
        description: "Sign in with Face ID, Touch ID or a PIN",
        icon: Fingerprint,
        keywords: "webauthn biometric faceid touchid key",
      },
      {
        href: "/settings/login-activity",
        label: "Login activity",
        description: "Recent sign-ins and security events",
        icon: History,
        keywords: "signin history audit suspicious unknown",
      },
      {
        href: "/settings/devices",
        label: "Devices and sessions",
        description: "Everywhere your account is signed in",
        icon: Monitor,
        keywords: "sessions devices sign out revoke ip",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and safety",
    items: [
      {
        href: "/settings/account-status",
        label: "Account status",
        description: "Blocks, limits and checks on your account",
        icon: CircleAlert,
        keywords: "status violation restricted ineligible appeal strike warning blocked",
      },
      {
        href: "/settings/data-permissions",
        label: "Data and permissions",
        description: "Personalisation and cookie choices",
        icon: SlidersHorizontal,
        keywords: "cookies consent analytics personalisation partners",
      },
    ],
  },
  {
    id: "data",
    title: "Your data",
    items: [
      {
        href: "/settings/activity-log",
        label: "Activity log",
        description: "A record of changes to your account",
        icon: History,
        keywords: "audit changes events password email",
      },
      {
        href: "/settings/your-activity",
        label: "Your activity",
        description: "Time spent, and what you've deleted",
        icon: Activity,
        keywords: "insights time spent archive deleted searches",
      },
      {
        href: "/settings/download-data",
        label: "Download your data",
        description: "Get an archive of everything we hold",
        icon: Download,
        keywords: "export archive gdpr json html copy",
      },
      {
        href: "/settings/connected-apps",
        label: "Connected apps",
        description: "Third-party accounts linked to Tirbeo",
        icon: Plug,
        keywords: "oauth google github discord integrations",
      },
      {
        href: "/settings/delete-account",
        label: "Delete account",
        description: "Close your account permanently",
        icon: Trash2,
        keywords: "close remove erase deactivate danger",
      },
    ],
  },
  {
    id: "general",
    title: "General",
    items: [
      {
        href: "/settings/language",
        label: "Language",
        description: "The language Tirbeo speaks in",
        icon: Globe,
        keywords: "locale i18n translate",
      },
      {
        href: "/settings/help",
        label: "Help and documentation",
        description: "Guides, policies and the way to ask about the rest",
        icon: CircleHelp,
        keywords: "support contact tickets docs faq guide article terms privacy documentation",
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const BY_HREF = new Map(NAV_ITEMS.map((i) => [i.href, i]));

/**
 * Pages reached by drilling in rather than from the sidebar or search, so
 * they stay out of the nav but still get a readable app-bar title.
 */
const SUB_ROUTES = new Map([
  ["/settings/backup-codes", "Backup codes"],
  ["/settings/recently-deleted", "Recently deleted"],
  ["/settings/deactivate", "Deactivate account"],
  ["/settings/confirm-deletion", "Confirm permanent account deletion"],
  /* The three screens a locked account is kept on. They aren't in the rail
     and there's no way back into the app from them — the names are here so a
     browser tab and the history page can call them what they are. */
  ["/settings/deactivated", "Account paused"],
  ["/settings/deletion-pending", "Account closing"],
  ["/settings/restricted", "A decision about your account"],
  ["/settings/account-status/history", "Requests and history"],
  /* The account-status sections each get their own list, then each entry in
     one gets a page — so the back row can name where it leads. */
  ["/settings/account-status/standing", "Account standing"],
  ["/settings/account-status/sign-ins", "Sign-ins we stopped"],
  ["/settings/account-status/limits", "What's limited right now"],
  ["/settings/account-status/checks", "Checks waiting on you"],
  ["/settings/account-status/discovery", "What stops people finding your account"],
  ["/settings/devices/sign-out", "Select devices to log out"],
  ["/settings/help/support", "Write to support"],
]);

/* The documentation articles are pages of their own under the help page, and
   their titles live with them in lib/docs — so the rail and the back row read
   them from there rather than from a second list to keep in step. */
for (const article of ARTICLES) {
  SUB_ROUTES.set(`/settings/help/${article.slug}`, article.title);
}

/** Where a sub-route's parent lives, for the mobile back chevron. */
const SUB_PARENTS = new Map([
  ["/settings/backup-codes", "/settings/two-factor"],
  ["/settings/recently-deleted", "/settings/your-activity"],
  ["/settings/deactivate", "/settings/delete-account"],
  ["/settings/confirm-deletion", "/settings/delete-account"],
]);

export function navItem(href: string): NavItem | undefined {
  return BY_HREF.get(href);
}

/** Human title for the app bar — falls back to the last path segment. */
export function titleFor(pathname: string): string {
  return navItem(pathname)?.label ?? SUB_ROUTES.get(pathname) ?? "Settings";
}

export function descriptionFor(pathname: string): string {
  return navItem(pathname)?.description ?? "";
}

/* ── Where the mobile back chevron goes ───────────────────────────
   Every page is one tap under the settings index, so the answer is
   usually /settings — except the index itself, and pages reached from
   another page rather than the list. A page nested a level deeper still
   (a device's detail, one account-status check) points at whatever sits
   directly above it in the path. */

export function parentHref(pathname: string): string | null {
  if (pathname === "/settings") return null;
  if (SUB_PARENTS.has(pathname)) return SUB_PARENTS.get(pathname)!;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 2) {
    const up = `/${parts.slice(0, -1).join("/")}`;
    /* A dynamic segment can sit under a folder that is not a page itself —
       a policy lives at /help/policy/<slug> but /help/policy renders nothing.
       Keep climbing until a step is somewhere the back button can go. */
    return BY_HREF.has(up) ? up : parentHref(up);
  }
  return "/settings";
}

/* ── Search ───────────────────────────────────────────────────────
   Type what you'd say out loud. Each word is folded — hyphens, slashes
   and apostrophes gone, so "two-factor", "two factor" and "2fa" all
   reach the same place — and matched against the title, the keywords,
   the description and the section. A word that starts a word beats one
   buried inside it, and a title beats a description, so "dev" surfaces
   Devices rather than Download.

   A result that matched every word comes first. If nothing did, the
   closest ones still show, labelled: three words typed and two of them
   found is a better answer than "no results".  */

export type SearchHit = {
  item: NavItem;
  group: string;
  score: number;
  /** Matched every word, as opposed to being the nearest thing available. */
  exact: boolean;
};

/** Lowercase, and every run of non-alphanumerics becomes one space. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function searchNav(query: string): SearchHit[] {
  const tokens = fold(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];

  const hits: SearchHit[] = [];
  for (const group of NAV_GROUPS) {
    const groupText = fold(group.title);
    for (const item of group.items) {
      const haystacks = [
        { text: fold(item.label), weight: 10 },
        { text: fold(item.keywords ?? ""), weight: 6 },
        { text: fold(item.description), weight: 3 },
        { text: groupText, weight: 1 },
      ]
        .filter((h) => h.text)
        .map((h) => ({ ...h, words: h.text.split(" ") }));

      let score = 0;
      let matched = 0;
      for (const token of tokens) {
        let best = 0;
        for (const { text, words, weight } of haystacks) {
          if (words.some((word) => word.startsWith(token))) best = Math.max(best, weight * 2);
          else if (text.includes(token)) best = Math.max(best, weight);
        }
        if (!best) continue;
        matched++;
        score += best;
      }
      if (!matched) continue;

      const exact = matched === tokens.length;
      /* A near miss has to carry at least half the phrase, or one stray word
         in a long sentence would drag the whole list up. */
      if (!exact && matched < Math.ceil(tokens.length / 2)) continue;

      // The words together in one field beat the same words scattered.
      if (exact && tokens.length > 1 && haystacks.some((h) => h.text.includes(tokens.join(" ")))) {
        score += 12;
      }
      hits.push({ item, group: group.title, score, exact });
    }
  }

  return hits.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      b.score - a.score ||
      a.item.label.localeCompare(b.item.label),
  );
}
