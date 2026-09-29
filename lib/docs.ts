"use client";

/* ═══════════════════════════════════════════════════════════════════
   The documentation

   One article per thing you can do, per thing that can go wrong, written
   against what this build really does. That last part is the reason the text
   lives in a file rather than in a CMS: there is no server here, so an
   article that claimed a review happened, or an email was sent, or a device
   was signed out somewhere else, would be a lie with a screenshot attached.

   The core nine carry the pictures someone chose: each step has the page it
   belongs to and what on that page the number points at, and those two fields
   are also the manifest the captures were taken from, so a step and its figure
   can't drift apart. The long tail of narrower articles — one per error, per
   "what if", per button that isn't where you expected — lives in the two pack
   files, and every one of them gets a plain picture of the page it is about,
   added below rather than written into forty files by hand.
   ═══════════════════════════════════════════════════════════════════ */

import { PACK_A } from "@/lib/docs-pack-a";
import { PACK_B } from "@/lib/docs-pack-b";

export type DocFigure = {
  /** The page the picture is taken from. */
  route: string;
  /** What the number points at, as a selector on that page. Left out for a
      plain picture, which photographs the top of the page with nothing pointed
      at — its whole job is to show what the screen looks like. */
  target?: string;
  /** Which match to take when the selector isn't unique. Defaults to the first. */
  index?: number;
  /** Which side of the target has room for the badge. Defaults to the right. */
  side?: "left" | "right";
  /** A state the page has to be put in before the target exists, named for
      the capture script's own list. Two steps can need opposite states. */
  prep?: string;
  /** What the caption says under the picture, and what the narrator reads. */
  caption?: string;
};

export type DocStep = {
  title: string;
  body: string;
  /** Where it happens. A step with no page is a step that explains something. */
  href?: string;
  hrefLabel?: string;
  figure?: DocFigure;
};

export type DocNote = { q: string; a: string };

export type DocCategory = "Signing in" | "Your data" | "Privacy and safety" | "Getting around";

export type DocArticle = {
  slug: string;
  title: string;
  /** The line the list shows. */
  sub: string;
  category: DocCategory;
  /** Extra words the search should answer to. */
  keywords: string;
  /** When this text was last checked against the app. */
  updated: number;
  intro: string[];
  steps: DocStep[];
  notes: DocNote[];
  related: { label: string; href: string }[];
};

/** The day this text was last read against the app, not a rolling "today". */
const REVIEWED = Date.UTC(2026, 8, 27);

export const DOC_CATEGORIES: { id: DocCategory; sub: string }[] = [
  { id: "Signing in", sub: "Passwords, second steps, and the devices that hold your account." },
  { id: "Your data", sub: "What this app keeps, how to take a copy, and how to get rid of it." },
  { id: "Privacy and safety", sub: "Who sees what, and what happens when something is restricted." },
  { id: "Getting around", sub: "The small things — language, dates, the theme, and asking support." },
];

/** The articles with pictures, listed first inside each category. */
const CORE: DocArticle[] = [
  {
    slug: "sign-in",
    title: "Keeping your sign-in yours",
    sub: "The password you use, the second step on top of it, and the codes for when the phone is gone.",
    category: "Signing in",
    keywords: "password passcode two factor 2fa authenticator otp backup codes recovery email sign in login",
    updated: REVIEWED,
    intro: [
      "There are three ways to make signing in harder to steal, and they stack: a password you don't reuse, a second step that lives on a phone you hold, and a set of one-time codes you saved when you turned the second step on.",
      "This build keeps the settings for all three. It cannot send you an email or text, so nothing here can be the only way back into an account — treat the backup codes as the thing you must not lose.",
    ],
    steps: [
      {
        title: "Change the password you sign in with",
        body: "Open Password and security and choose Change password. You type the current one, then the new one twice. A new password has to clear a minimum length, and the page tells you which rule it failed if it doesn't.",
        href: "/settings/security",
        hrefLabel: "Password and security",
        figure: {
          route: "/settings/security",
          target: 'main button:has-text("Change password")',
          caption: "The password lives on this page, together with everything else that guards the account.",
        },
      },
      {
        title: "Add the second step",
        body: "Turn on Authenticator app on the two-factor page. The setup sheet shows a key you type into an app like Google Authenticator, and the six-digit code it produces is what the page asks for next. Once it's on, signing in needs the password and the code.",
        href: "/settings/two-factor",
        hrefLabel: "Two-factor authentication",
        figure: {
          route: "/settings/two-factor",
          target: 'main button[aria-label="Authenticator app"]',
          caption: "One switch turns the second step on. Turning it off asks you to confirm first.",
        },
      },
      {
        title: "Save the backup codes before you put the phone away",
        body: "Generate backup codes on their own page. They are shown once, in a list, and the page will not show them again — copy them, or write them down somewhere that isn't the phone you already use for the codes.",
        href: "/settings/backup-codes",
        hrefLabel: "Backup codes",
        figure: {
          route: "/settings/backup-codes",
          target: 'main button:has-text("Generate")',
          side: "left",
          caption: "Each code works once. The list of which ones remain is kept here; the codes themselves are not.",
        },
      },
      {
        title: "Set a recovery email while you can still sign in",
        body: "The same page holds Recovery email. It's the address a future reset would go to, so make it one you control as well as the password. Nothing is sent to it in this build — it is only stored as the address you'd want used.",
        figure: {
          route: "/settings/security",
          target: 'main button:has-text("Recovery email")',
          caption: "Set it now. Choosing it after you're locked out is the part that can't be done here.",
        },
      },
    ],
    notes: [
      {
        q: "Is my password stored anywhere?",
        a: "No. Nothing in this app writes a password, a code or a key to storage — the pages that ask for one only check what you typed while you're on the page.",
      },
      {
        q: "What if I lose the phone with the authenticator on it?",
        a: "Use a backup code, then turn the authenticator off and set it up again on the new phone. This is the case the codes exist for, which is why generating them is a separate step.",
      },
      {
        q: "Can I sign in without a password at all?",
        a: "A passkey does that, and it's set up on its own page. Add one while you can still sign in the normal way, and keep the password as the fallback until you've used the passkey on the device you actually carry.",
      },
    ],
    related: [
      { label: "Passkeys", href: "/settings/passkeys" },
      { label: "Login activity", href: "/settings/login-activity" },
      { label: "Devices and sessions", href: "/settings/devices" },
    ],
  },
  {
    slug: "sessions",
    title: "The devices holding your account",
    sub: "See every machine that's signed in, end one of them, and check the sign-ins behind the list.",
    category: "Signing in",
    keywords: "device session sign out logout remote phone laptop stranger known places login history activity",
    updated: REVIEWED,
    intro: [
      "Every browser that has signed in holds a session, and this page is the list of them. The one you're using is marked as such, so it's never the thing you sign out of by accident.",
      "Signing a device out ends that session here. There is no server in this build, so nothing reaches the other machine — treat it as the record being corrected, and change the password too if a device is genuinely not yours.",
    ],
    steps: [
      {
        title: "Read the list before you act on it",
        body: "Each row is one device: its name, roughly where it was, how long ago it was active and what it's running. Open a row for the full picture, including the sign-ins that built it.",
        href: "/settings/devices",
        hrefLabel: "Devices and sessions",
        figure: {
          route: "/settings/devices",
          target: 'main a[href^="/settings/devices/"]',
          caption: "The current device sits at the top and is labelled, so it can't be signed out by mistake.",
        },
      },
      {
        title: "End several at once",
        body: "\"Select devices to log out\" turns the list into checkboxes. Pick the ones you no longer recognise or use, confirm, and they're gone from the list with their sessions ended.",
        figure: {
          route: "/settings/devices",
          target: 'main a:has-text("Select devices to log out")',
          caption: "One pass over the whole list is faster than opening each device and ending it alone.",
        },
      },
      {
        title: "Check the sign-ins that produced it",
        body: "Login activity is the history behind the list — every sign-in with its time, place and device. Anything you don't recognise gets answered there, and saying it wasn't you is what offers the two things that actually help: signing out everywhere and changing the password.",
        href: "/settings/login-activity",
        hrefLabel: "Login activity",
        figure: {
          route: "/settings/login-activity",
          target: 'main a[href^="/settings/login-activity/"]',
          caption: "Each sign-in opens its own page, where you say whether it was you.",
        },
      },
    ],
    notes: [
      {
        q: "Why does a device I don't recognise say it's active today?",
        a: "Because the entry was written when that browser last used the app on this device's clock. Locations come from the network address, which identifies a general area rather than a building — so read the pair together, not either one alone.",
      },
      {
        q: "Does signing out here stop a device that isn't mine?",
        a: "Not by itself. This build has no server to carry the instruction, so the honest move is to change your password as well, which stops the next sign-in even if it can't stop the one already running.",
      },
    ],
    related: [
      { label: "Devices and sessions", href: "/settings/devices" },
      { label: "Login activity", href: "/settings/login-activity" },
      { label: "Your activity", href: "/settings/your-activity" },
    ],
  },
  {
    slug: "data-copy",
    title: "Taking a copy of your data, and taking it back",
    sub: "Build an archive of what this browser holds, and undo something you deleted before the clock runs out.",
    category: "Your data",
    keywords: "export download archive copy json html restore undelete trash deleted gdpr backup",
    updated: REVIEWED,
    intro: [
      "An archive is everything this browser holds about you: your details, the choices you've saved, the sign-ins, the devices and the changes you've made. It is built on the spot and handed to you as a file — nothing is emailed, and no copy is kept anywhere.",
      "Deleted things are the other half of this. Nothing disappears the moment you delete it; it waits in Recently deleted for thirty days, and you can put it back from there.",
    ],
    steps: [
      {
        title: "Pick a format",
        body: "JSON if you want to feed the file to something else. HTML if you want to open it in a browser and read it. The choice is remembered, so a second request doesn't need it again.",
        href: "/settings/download-data",
        hrefLabel: "Download your data",
        figure: {
          route: "/settings/download-data",
          target: 'main [role="radiogroup"][aria-label="File format"]',
          caption: "Two formats, one choice. The archive itself is the same either way.",
        },
      },
      {
        title: "Ask for it, then watch that one request",
        body: "Filing the request carries you to its own page, which counts the build up and tells you what went in. Each request keeps that page, so you can come back later and see what the archive held at the time it was made.",
        figure: {
          route: "/settings/download-data",
          target: 'main button:has-text("Download all my data")',
          caption: "Three requests a day is the limit, and the wait until the next one is counted for you.",
        },
      },
      {
        title: "Get something back before its clock runs out",
        body: "Recently deleted groups what's waiting by the day it leaves. Open an item and restore puts it back exactly where it was; delete it for good instead and it leaves the tray immediately.",
        href: "/settings/recently-deleted",
        hrefLabel: "Recently deleted",
        figure: {
          route: "/settings/recently-deleted",
          target: 'main a[href^="/settings/recently-deleted/"]',
          caption: "The number on the right is how many days are left before it goes for good.",
        },
      },
    ],
    notes: [
      {
        q: "Why is there a limit on requests?",
        a: "Because each one is built by reading every store this app writes to, on your device. Six requests stay listed and three can be filed in a day, which is more than anyone has a reason to need.",
      },
      {
        q: "Does the archive contain my password?",
        a: "No. A password is never stored, so there is nothing to export. The same is true of the codes from your authenticator.",
      },
    ],
    related: [
      { label: "Download your data", href: "/settings/download-data" },
      { label: "Data and permissions", href: "/settings/data-permissions" },
    ],
  },
  {
    slug: "emails",
    title: "The emails Tirbeo sends",
    sub: "Pause everything non-essential at once, or choose the few kinds that are worth arriving.",
    category: "Getting around",
    keywords: "email newsletter pause digest summary offers promotions tips updates notifications unsubscribe",
    updated: REVIEWED,
    intro: [
      "Email settings are split by what the message is for, not by how often it goes out. Account and security emails are the exception: they stay on, because they tell you when a sign-in or a change you didn't make happens.",
      "Pause all non-essential emails is the switch to reach for first. It leaves the individual choices exactly as they were underneath, so turning it off again brings back what you had.",
    ],
    steps: [
      {
        title: "Start with the one switch",
        body: "Pause all non-essential emails covers everything except the security messages. While it's on, the rows below it are dimmed and say so rather than pretending to change anything.",
        href: "/settings/notifications",
        hrefLabel: "Email preferences",
        figure: {
          route: "/settings/notifications",
          target: 'main button[aria-label="Pause all non-essential emails"]',
          caption: "One switch, and the rows it covers stay visible so you can see what you'd come back to.",
        },
      },
      {
        title: "Then choose the cadence you'll actually read",
        body: "A weekly summary and a monthly recap cover the same ground at different speeds. Pick the one you'd open, not both — an email you skip trains you to skip the ones that matter.",
        figure: {
          route: "/settings/notifications",
          target: 'main button[aria-label="Weekly summary"]',
          caption: "The cadence rows are ordinary switches; nothing here needs a page of its own.",
        },
      },
    ],
    notes: [
      {
        q: "Will I get these emails?",
        a: "Not from this build — it has no server to send from, so what's stored here is your choice, waiting for the day something can act on it. That's also why nothing here asks you to confirm by clicking a link in your inbox.",
      },
    ],
    related: [
      { label: "Email preferences", href: "/settings/notifications" },
      { label: "Data and permissions", href: "/settings/data-permissions" },
    ],
  },
  {
    slug: "privacy",
    title: "What's collected, and who can act as you",
    sub: "Cookies and analytics on one page, and the list of outside apps allowed in on another.",
    category: "Privacy and safety",
    keywords: "privacy cookies analytics tracking personalisation partners connected apps oauth data permission",
    updated: REVIEWED,
    intro: [
      "Two questions live here, on different pages. What may be collected about you is set under Data and permissions. Which outside services are allowed to act as you is set under Connected apps.",
      "Both are stored as choices on this device. This build loads no analytics and no advertising code, so moving those rows is you telling a future version what you're willing to allow — which is still worth doing before there's something to allow.",
    ],
    steps: [
      {
        title: "Read which cookie is which",
        body: "Essential cookies are on and can't be turned off — without them the app can't remember that you're signed in. Everything else is a row you can move.",
        href: "/settings/data-permissions",
        hrefLabel: "Data and permissions",
        figure: {
          route: "/settings/data-permissions",
          target: 'main button[aria-label="Personalised experience"]',
          caption: "The first optional row. Everything under it is off until you say otherwise.",
        },
      },
      {
        title: "Decide about partners separately",
        body: "\"Share anonymous usage data with partners\" is its own row, because agreeing to analytics isn't agreeing to hand the same numbers to someone else. It stays off unless you turn it on, and it's off when analytics is off.",
        figure: {
          route: "/settings/data-permissions",
          target: 'main button[aria-label="Share anonymous usage data with partners"]',
          caption: "A row that depends on another says so on the row, rather than failing silently.",
        },
      },
      {
        title: "Look at what's connected",
        body: "Connected apps lists every service you once allowed to act as you, with what it was granted and when it last came calling. Anything you no longer use should be disconnected while you're on the page — an old connection is the hole nobody thinks to check.",
        href: "/settings/connected-apps",
        hrefLabel: "Connected apps",
        figure: {
          route: "/settings/connected-apps",
          target: 'main a[href^="/settings/connected-apps/"]',
          caption: "Each row says what that app can see, so the list is already the audit.",
        },
      },
    ],
    notes: [
      {
        q: "Where does any of it go?",
        a: "Nowhere. Every choice on these pages is written to this browser's storage. Clearing the site's data deletes it, and no one can retrieve it afterwards — including you.",
      },
      {
        q: "Why can't I turn off essential cookies?",
        a: "Because the row would be a lie: with them off, the app stops being able to hold a session, which is the thing they exist for. The page explains what they do instead of offering a switch that breaks it.",
      },
    ],
    related: [
      { label: "Data and permissions", href: "/settings/data-permissions" },
      { label: "Connected apps", href: "/settings/connected-apps" },
      { label: "Privacy policy", href: "/settings/help/policy/privacy" },
    ],
  },
  {
    slug: "status",
    title: "When something on your account is restricted",
    sub: "What the status page means, and how to ask for a decision to be looked at again.",
    category: "Privacy and safety",
    keywords: "account status violation restricted limited ban appeal review decision warning strike ineligible",
    updated: REVIEWED,
    intro: [
      "Account status is a list of decisions, each about one specific sign-in, check or feature — not a mark against the account as a whole. \"Good standing\" means the list is empty, not that nothing was ever looked at.",
      "Anything on it can be asked about. A review request is written down with your own words attached, and the answer appears on the same page it was filed from.",
    ],
    steps: [
      {
        title: "Open the check, not the summary",
        body: "The status page groups decisions into sign-ins, limits, checks and discovery. Each one opens its own list, and a section with nothing in it says so plainly instead of showing an empty box.",
        href: "/settings/account-status",
        hrefLabel: "Account status",
        figure: {
          route: "/settings/account-status",
          target: 'main a[href="/settings/account-status/sign-ins"]',
          caption: "The word on the right is the whole answer for that section — a count only appears when something needs you.",
        },
      },
      {
        title: "Read what was applied and when",
        body: "A decision's own page names the rule it was taken under, the day it was made and what is currently limited because of it. That's the text to quote back in a review request, because it's what the review would be about.",
        figure: {
          route: "/settings/account-status/sign-ins/blocked-lagos",
          target: 'main button:has-text("Request a review")',
          caption: "The button only appears on a decision that can be reviewed. Some can't, and that page says why.",
        },
      },
      {
        title: "Write the explanation, then leave it",
        body: "Say what happened in your own words: who was using the device, what you were doing, what you think was misread. Short and specific beats long and general. Once it's filed, the page shows the request as under review and lists what happens next.",
        figure: {
          route: "/settings/account-status/sign-ins/blocked-lagos",
          target: 'main h2:has-text("What happens next")',
          side: "left",
          prep: "appeal",
          caption: "After filing, the same page carries the request and the steps it will go through.",
        },
      },
    ],
    notes: [
      {
        q: "How long does a review take?",
        a: "This build can't say, because there's no reviewer in it. Filing a request writes it to this browser and marks the page as waiting — useful for knowing what you asked and when, not a queue anyone is working through.",
      },
      {
        q: "Does asking for a review lift the limit while it waits?",
        a: "No. The restriction stays exactly as it was until a decision is changed, which is why the page keeps showing it rather than hiding it during the review.",
      },
      {
        q: "What if the decision is about something I didn't do?",
        a: "Say so in the request, and change the password at the same time if the sign-in wasn't yours. A review that reads \"it wasn't me\" and a password change that makes it true are the two halves of the same fix.",
      },
    ],
    related: [
      { label: "Account status", href: "/settings/account-status" },
      { label: "Login activity", href: "/settings/login-activity" },
      { label: "Community guidelines", href: "/settings/help/policy/community" },
    ],
  },
  {
    slug: "language",
    title: "Language, dates and times",
    sub: "One setting changes how dates, times and numbers are written everywhere in the app.",
    category: "Getting around",
    keywords: "language translate locale region date time timezone format numbers 24 hour units metric",
    updated: REVIEWED,
    intro: [
      "The language setting is not only about words. Month names, the order the parts of a date go in, whether a time is written on a 12 or 24-hour clock and which digits you see all follow it, on every page that shows a date.",
      "Times themselves come from your device's clock and time zone, so nothing needs setting. A sign-in at 21:14 in Kathmandu is the same instant everywhere; only the way it's written changes.",
    ],
    steps: [
      {
        title: "Choose the language",
        body: "Pick it on the Language page. The app repaints straight away — the browser tab's title and the page's own language attribute change with it, which is what lets a screen reader and a translation tool read the page correctly.",
        href: "/settings/language",
        hrefLabel: "Language",
        figure: {
          route: "/settings/language",
          /* The list itself is taller than any screen, so the picture rings
             one row instead: the crop then shows the row above and below it,
             which is what makes it obvious this is a list to pick from. */
          target: 'main [role="radiogroup"][aria-label="Language"] [role="radio"]',
          index: 1,
          caption: "One list, applied the moment you choose from it. No save button, because there's nothing to save twice.",
        },
      },
      {
        title: "Check it worked where dates are written",
        body: "Login activity is the quickest place to see it: the day headings, the stamps beside each sign-in and the \"how long ago\" lines all come from the same setting.",
        figure: {
          route: "/settings/login-activity",
          target: "main h3",
          index: 0,
          caption: "Today, yesterday and the weekday names are all read from the language you picked.",
        },
      },
    ],
    notes: [
      {
        q: "Is every label translated?",
        a: "No, and it's better to say so than to imply it. Dates, times and numbers follow the language you choose; the words in the interface itself are still English in this build.",
      },
      {
        q: "Can I set the time zone by hand?",
        a: "There's no control for it, deliberately. The device already knows, and a setting that disagreed with the clock would only make every stamp in the app wrong in a different way.",
      },
    ],
    related: [
      { label: "Language", href: "/settings/language" },
      { label: "Appearance", href: "/settings/appearance" },
    ],
  },
  {
    slug: "closing",
    title: "Deactivating instead of deleting",
    sub: "The difference between stepping away and erasing the account, and how long either takes.",
    category: "Your data",
    keywords: "deactivate delete account close remove erase grace period cancel undo final permanent",
    updated: REVIEWED,
    intro: [
      "Deactivating hides the account and keeps everything as it was. Signing back in brings it back, and nothing needs explaining afterwards. Deleting is the other thing: it takes a while, and then it is final.",
      "The two live on separate pages on purpose, and the delete page offers deactivation before it asks you to confirm anything else.",
    ],
    steps: [
      {
        title: "Take the pause",
        body: "Deactivate says what stops and what's kept, asks for the reason you're going, and gives it back the moment you sign in again.",
        href: "/settings/deactivate",
        hrefLabel: "Deactivate",
        figure: {
          route: "/settings/deactivate",
          target: 'main button:has-text("Deactivate account")',
          caption: "One confirmation, and the reason you gave is kept with it so the page can show the same answer back.",
        },
      },
      {
        title: "Know the window you're in",
        body: "A deletion request opens a thirty-day window. The page counts it down, and signing in or cancelling inside it stops the whole thing. What's on the line during that time is listed there, in the same words the confirmation uses.",
        href: "/settings/delete-account",
        hrefLabel: "Delete account",
        figure: {
          route: "/settings/delete-account",
          target: 'main a:has-text("Deactivate for a while")',
          caption: "The softer option is offered on the delete page itself, before anything is confirmed.",
        },
      },
      {
        title: "Take the copy first",
        body: "Once the window closes there's nothing left to export, so the page that schedules the deletion also carries the link to Download your data. An archive filed before you go is the only copy that survives.",
        figure: {
          route: "/settings/delete-account",
          target: 'main a:has-text("Download your data")',
          caption: "The two pages are the same decision taken in order: keep what you need, then let go of the rest.",
        },
      },
    ],
    notes: [
      {
        q: "Is a deletion in this build real?",
        a: "It's local. The plan, the countdown and the reason are written to this browser because there's no server holding an account to delete. Clearing the site's data does the same job today.",
      },
      {
        q: "Can I bring back something I deleted for good?",
        a: "Not from Recently deleted — that tray is the thirty-day window for individual items, and an item you removed from it early is gone from the list. This is the difference between deleting one thing and closing the account.",
      },
    ],
    related: [
      { label: "Deactivate", href: "/settings/deactivate" },
      { label: "Delete account", href: "/settings/delete-account" },
      { label: "Download your data", href: "/settings/download-data" },
    ],
  },
];

/** Every step that names a page gets a picture of it.
    The hand-written articles already chose what their own number points at, so
    this only fills the gaps: any step that says where it happens is
    photographed on that page. The first thing a step puts in quotes is the
    label it wants you to press, which is exactly what a picture should point
    at, so the callout is read out of the sentence rather than written twice. */
const QUOTED = /[“"]([^“”"]{3,42})[”"]/;

function withPictures(articles: DocArticle[]): DocArticle[] {
  return articles.map((article) => {
    /* A step's own quotes are the label it wants you to press, so the callout
       is read out of the sentence rather than written twice. Steps that name no
       page at all — "fill in the three boxes", "press the red button" — happen
       one tap after the step that did, so they borrow that page and open
       whatever it opened, and the picture is of the sheet you're actually in. */
    let screen: string | null = null;
    let opened: string | null = null;
    const steps = article.steps.map((step) => {
      const quote = step.body.match(QUOTED)?.[1] ?? null;
      /* A sentence quotes what it points at, and a placeholder inside the
         quote — "Remove <name>?" — names nothing on the page, so it can only
         point at the words before it. */
      const label = quote ? quote.replace(/<[^\s].*$/, "").replace(/[?.!]+$/, "").trim() : "";
      const pointed = label.length >= 3 ? label : null;
      if (step.href) {
        screen = step.href;
        opened = pointed;
        if (step.figure) return step;
        return {
          ...step,
          figure: {
            route: step.href as string,
            target: pointed ? `main :text("${pointed}")` : undefined,
          },
        };
      }
      if (step.figure || !screen) return step;
      return {
        ...step,
        figure: {
          route: screen,
          prep: opened ? `sheet:${opened}` : undefined,
          target: pointed
            ? `main :text("${pointed}")`
            : opened
              ? '[role="dialog"]'
              : undefined,
        },
      };
    });
    return { ...article, steps };
  });
}

/** Everything the index and the search know about. */
export const ARTICLES: DocArticle[] = withPictures([...CORE, ...PACK_A, ...PACK_B]);

/** Slugs people type, or links written before a narrow article existed. The
    article page answers with the real article and puts the address right, so
    this is the one place a wrong slug is allowed to mean something. */
const ALIASES: Record<string, string> = {
  passwords: "change-password",
  password: "change-password",
  "two-factor": "turn-on-two-factor",
  "2fa": "turn-on-two-factor",
  totp: "turn-on-two-factor",
  devices: "sign-out-other-devices",
  sessions: "signing-out",
  "login-activity": "sign-in-not-me",
  export: "data-copy",
  download: "data-copy",
  gdpr: "data-copy",
  trash: "restore-deleted",
  undelete: "restore-deleted",
  cookies: "privacy",
  analytics: "data-permissions",
  connected: "disconnect-app",
  oauth: "disconnect-app",
  restricted: "account-held",
  appeal: "account-held",
  avatar: "photo-rejected",
  photo: "photo-rejected",
  theme: "theme-choice",
  dark: "theme-choice",
};

export function findArticle(slug: string | undefined): DocArticle | null {
  if (!slug) return null;
  const direct = ARTICLES.find((row) => row.slug === slug);
  if (direct) return direct;
  const target = ALIASES[slug];
  return target ? (ARTICLES.find((row) => row.slug === target) ?? null) : null;
}

export function articleHref(slug: string): string {
  return `/settings/help/${slug}`;
}

/** Articles that are done with the same pages, or that sit in the same
    category — which is how "the two-factor article" finds "the devices
    article" without anyone maintaining a list of friendships. */
export function moreLikeThis(article: DocArticle, count = 3): DocArticle[] {
  const ownPages = new Set(article.steps.flatMap((step) => (step.href ? [step.href] : [])));
  const scored = ARTICLES.filter((row) => row.slug !== article.slug)
    .map((row) => ({
      row,
      score:
        (row.category === article.category ? 1 : 0) +
        row.steps.filter((step) => step.href && ownPages.has(step.href)).length * 2 +
        row.related.filter((rel) => ownPages.has(rel.href)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.row.title.localeCompare(b.row.title));
  return scored.slice(0, count).map((entry) => entry.row);
}

/** The two theme variants of a step's picture, derived from where it sits so
    the page and the camera can never disagree about a file name. */
export function figurePaths(slug: string, step: number) {
  const base = `/docs/${slug}-${step}`;
  return { light: `${base}-light.png`, dark: `${base}-dark.png` };
}

export type DocHit = { article: DocArticle; where: "title" | "body" | "step" | "note"; text: string };

/** A word match on the title outranks a match buried in a step, so a search
    for "password" leads with the password article rather than whichever one
    happens to mention it most. */
export function searchDocs(query: string): DocHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const rank = { title: 0, body: 1, step: 2, note: 3 } as const;
  const hits: DocHit[] = [];

  for (const article of ARTICLES) {
    const haystacks: DocHit[] = [
      { article, where: "title", text: article.title },
      { article, where: "body", text: `${article.sub} ${article.keywords} ${article.intro.join(" ")}` },
      ...article.steps.map((step) => ({
        article,
        where: "step" as const,
        text: `${step.title} ${step.body}`,
      })),
      ...article.notes.map((note) => ({
        article,
        where: "note" as const,
        text: `${note.q} ${note.a}`,
      })),
    ];
    for (const hit of haystacks) {
      if (hit.text.toLowerCase().includes(needle)) hits.push(hit);
    }
  }

  const seen = new Set<string>();
  return hits
    .sort((a, b) => rank[a.where] - rank[b.where])
    .filter((hit) => {
      if (seen.has(hit.article.slug)) return false;
      seen.add(hit.article.slug);
      return true;
    });
}

/** Everything the narrator reads out, in the order it appears on the page. */
export function narrationOf(article: DocArticle): { id: string; text: string }[] {
  const blocks = article.intro.map((text, i) => ({ id: `intro-${i}`, text }));
  article.steps.forEach((step, i) => {
    blocks.push({ id: `step-${i}`, text: `${step.title}. ${step.body}` });
    /* A picture with nothing to say adds nothing to the reading — the step's
       own text was just read out, and "here is a screenshot" is not a line. */
    if (step.figure?.caption) blocks.push({ id: `fig-${i}`, text: step.figure.caption });
  });
  article.notes.forEach((note, i) => {
    blocks.push({ id: `note-${i}`, text: `${note.q} ${note.a}` });
  });
  return blocks;
}
