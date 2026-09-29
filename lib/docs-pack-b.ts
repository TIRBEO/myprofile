import type { DocArticle } from "@/lib/docs";

/* ═══════════════════════════════════════════════════════════════════
   docs-pack-b — Your data, Privacy, Profile, Getting around.

   Written against what this build really does. There is no server, no
   database, no email: every store is localStorage in this browser, and a
   password is never written anywhere. Where that limit matters it is
   stated once, plainly, and never dressed up.

   Sign-ins, passwords, two-factor, passkeys, backup codes, devices and
   sessions live in docs-pack-a and are deliberately absent here.
   ═══════════════════════════════════════════════════════════════════ */

const REVIEWED = Date.UTC(2026, 8, 27);

export const PACK_B: DocArticle[] = [
  {
    slug: "archive-request",
    title: "Asking for a copy of your data",
    sub: "How to build an archive of what this browser holds, and how to read one that's still coming together.",
    category: "Your data",
    keywords: "archive export download my data copy gdpr request json html progress building file",
    updated: REVIEWED,
    intro: [
      "An archive is everything this browser keeps about you: your details, the choices you've saved, and the dated records the settings pages write. You ask for it, it is assembled here, and a file is handed to you. Nothing is emailed and nothing is uploaded, because there is no server to email from.",
      "The one you file gets its own page, which counts the build up, names the file and lists what went into it. The steps below are all on those two pages.",
    ],
    steps: [
      {
        title: "Choose a format first",
        body: "At the top of Download your data, set File format. JSON is structured data, best for handing to something else; HTML is readable pages you open in a browser. They hold the same records, so pick by what you'll do next. The choice is remembered, so a later request starts on the format you last picked.",
        href: "/settings/download-data",
        hrefLabel: "Download your data",
      },
      {
        title: "Press the request button",
        body: "Choose Download all my data. That files one request — always the whole account — and carries you straight to that request's page. There is nothing to tick over first; the archive is the whole record.",
      },
      {
        title: "Watch it assemble",
        body: "The request page shows a percentage and a line that says Building, with roughly twelve seconds left. It turns itself to Ready on its own; you don't reload or wait for a message. Underneath, the seconds tick down so you can see it is genuinely working.",
      },
      {
        title: "Save the file when it's ready",
        body: "Once it reads Ready, press Download archive. The file is written from this device through your browser's normal save. The page tells you the file name and its size, and the section list says how many records went into each part.",
      },
    ],
    notes: [
      {
        q: "Does the archive hold my password?",
        a: "No. A password is never stored here, so there is nothing to put in the file. The same goes for the codes your authenticator produces.",
      },
      {
        q: "Is a copy kept somewhere I can ask for later?",
        a: "No. It is built on the spot from this browser's storage and handed to you. If you didn't save the file, you request another one.",
      },
      {
        q: "Should I pick JSON or HTML?",
        a: "JSON if you'll feed the file into another tool; HTML if you want to open it and read it. Both carry the same sections. A JSON copy downloads as tirbeo-...-data.json and an HTML one as tirbeo-...-pages.html, so you can tell them apart without opening either.",
      },
    ],
    related: [
      { label: "Download your data", href: "/settings/download-data" },
      { label: "Your activity", href: "/settings/your-activity" },
    ],
  },
  {
    slug: "archive-limit",
    title: "Why there's a limit on archive requests",
    sub: "You can file three copies a day, and the wait until the next one is counted down rather than hidden.",
    category: "Your data",
    keywords: "limit daily requests cooldown wait rate three a day download data blocked timer",
    updated: REVIEWED,
    intro: [
      "Building an archive means reading every store this app writes to, on your device, in one pass. It's real work even when the file is never saved, so the page caps it at three requests in a rolling day and keeps the six most recent on the list.",
      "The limit is not a punishment and not a queue. When you've filed three, the button says so and counts down the wait; when the oldest request falls out of the day, you can file again.",
    ],
    steps: [
      {
        title: "Read what the button is telling you",
        body: "Once you've hit three, Download all my data greys out and its line changes to Try again in ... with the time left. The request still works the moment the window opens; nothing about your data has changed.",
        href: "/settings/download-data",
        hrefLabel: "Download your data",
      },
      {
        title: "Know it also applies from the request page",
        body: "A finished request's own page carries the same clock on its second button, labelled Another in ... and disabled until the wait is over. So you can't sneak an extra build through the detail page either.",
      },
      {
        title: "Use the requests you already have",
        body: "The last six requests stay listed, each with its format and date, and each can be downloaded again without filing a new one. If your aim is just to get a file you already built, open it rather than requesting.",
      },
    ],
    notes: [
      {
        q: "Can I raise the limit?",
        a: "No. The cap is three archives a day and there is no way to lift it in this build — nothing here trades for a setting, because there's no server that could honour the trade.",
      },
      {
        q: "Does clearing my browser reset the counter?",
        a: "Yes, because the count lives in this browser's storage like everything else. That's also why a fresh browser can start you at three again, and why the limit is about not thrashing one device, not about fairness across an account.",
      },
    ],
    related: [
      { label: "Download your data", href: "/settings/download-data" },
    ],
  },
  {
    slug: "restore-deleted",
    title: "Getting something back from Recently deleted",
    sub: "Restoring puts a thing back where it came from; deleting for good skips the countdown. Here's the difference.",
    category: "Your data",
    keywords: "restore undelete recently deleted trash put back delete for good permanent undo thirty days window",
    updated: REVIEWED,
    intro: [
      "Nothing disappears the instant you delete it. It lands in Recently deleted and waits there for thirty days, still whole. Open an item and you get exactly two decisions: put it back, or end the wait and remove it now.",
      "The right-hand number on each row is how many days that item has left. When it reaches zero the item is gone whether you act or not, and support cannot bring it back — that tray is the only undo this build has.",
    ],
    steps: [
      {
        title: "Find the item by the day it went",
        body: "Recently deleted groups everything by the day it was deleted, newest first. The line at the top says how many items can still be restored and how soon the first of them leaves for good.",
        href: "/settings/recently-deleted",
        hrefLabel: "Recently deleted",
      },
      {
        title: "Open one item to act on it",
        body: "A row opens its own page: the type, when it was deleted, the date it becomes gone for good, and the days left. The two buttons are the only things on the screen, so there's nothing to press by accident.",
      },
      {
        title: "Restore it",
        body: "Press Restore it and the item goes back where it came from with its history intact, and leaves the tray. A short confirmation says what kind was restored.",
      },
      {
        title: "Or delete it for good",
        body: "Press Delete for good and the item is removed immediately, skipping the rest of the thirty days. This is the one you cannot undo — once it's off the tray there is no second tray behind it.",
      },
    ],
    notes: [
      {
        q: "What's the difference between restoring and deleting for good?",
        a: "Restore reverses the delete and puts the thing back. Delete for good accepts the delete early and takes the item off the tray now, before its clock runs out. Leaving it in the tray does neither; it keeps counting down.",
      },
      {
        q: "How long is the window?",
        a: "Thirty days from the day you deleted it, per item. That number is the same for every kind of item in the tray.",
      },
      {
        q: "If I delete my whole account, does this tray save my data?",
        a: "No. This tray is for individual items on a live account. Closing the account is a separate, larger action with its own thirty-day window and its own countdown.",
      },
    ],
    related: [
      { label: "Recently deleted", href: "/settings/recently-deleted" },
      { label: "Your activity", href: "/settings/your-activity" },
      { label: "Download your data", href: "/settings/download-data" },
    ],
  },
  {
    slug: "change-name",
    title: "Changing the name on your profile",
    sub: "The display name people see is edited in the profile sheet, and it saves straight to this browser.",
    category: "Your data",
    keywords: "change display name full name profile rename edit name field save personal details",
    updated: REVIEWED,
    intro: [
      "Your display name is the large line at the top of your profile, separate from the @handle underneath it. You change it in the Edit profile sheet on the account settings, and it writes straight to this browser's storage.",
      "The name is free text up to forty characters and it can hold spaces and capitals. It isn't the thing that makes your link, so renaming doesn't move your address.",
    ],
    steps: [
      {
        title: "Open the edit sheet",
        body: "On Edit profile, press the Edit profile button under your name. The sheet lists every field at once, with the current name in the Full name box at the top.",
        href: "/settings/edit-profile",
        hrefLabel: "Edit profile",
      },
      {
        title: "Type the new name",
        body: "Replace the text in Full name. A name can't be empty — leave it blank and Save won't let the sheet close, and it tells you which field is still needed.",
      },
      {
        title: "Save it",
        body: "Press Save. The preview on the page updates to the new name and the change is written to this browser's storage. A toast reads Profile saved; nothing is sent anywhere.",
      },
    ],
    notes: [
      {
        q: "Does this change my @handle?",
        a: "No. The name and the username are two different boxes. Renaming leaves your link and your handle exactly as they were.",
      },
      {
        q: "Will the change show in another browser?",
        a: "No. The record lives in this browser's storage, so a different device opens on whatever it holds, not on what you just typed here.",
      },
    ],
    related: [
      { label: "Edit profile", href: "/settings/edit-profile" },
      { label: "Personal details", href: "/settings/personal-details" },
      { label: "Change your handle", href: "/settings/edit-profile" },
    ],
  },
  {
    slug: "photo-rejected",
    title: "When your profile photo is rejected",
    sub: "Two reasons a picture won't take: it's larger than five megabytes, or the file isn't an image at all.",
    category: "Your data",
    keywords: "photo rejected upload failed too large not image type error avatar profile picture five mb size limit",
    updated: REVIEWED,
    intro: [
      "The file pickers here only accept a picture, and only one up to five megabytes. Every rejection is one of those two rules, and the message tells you which. The photo is read into the browser and kept as the image itself; nothing is uploaded, because there's nowhere to upload to.",
      "Both pictures are chosen inside the Edit profile sheet — the face and the banner each have their own tile there — and the same two rules apply to both.",
    ],
    steps: [
      {
        title: "Check the size first",
        body: "A picture over five megabytes is turned away with That image is larger than 5 MB. The fix is a smaller file — take the photo again, or shrink it before choosing it.",
        href: "/settings/edit-profile",
        hrefLabel: "Edit profile",
      },
      {
        title: "Check it really is a picture",
        body: "Choosing something that isn't an image is refused with That file isn't a photo. A document, an audio file or a mislabelled upload all fail here. The file dialog is set to images, so pick from the photo section rather than typing a path.",
      },
      {
        title: "Reposition instead of re-shooting",
        body: "If the picture is accepted but framed wrong, the sheet opens an adjust step where you drag to move, slide to zoom and turn to straighten, then Apply. It crops to a fixed size for you, so a large file becomes an acceptable one.",
      },
    ],
    notes: [
      {
        q: "Why five megabytes?",
        a: "The photo is stored whole inside this browser, as text, alongside the rest of your profile. A very large image would bloat that record for no benefit, so the cap keeps a stored photo reasonable.",
      },
      {
        q: "Can I remove the photo instead?",
        a: "Yes. Clear it in the sheet and save, and your avatar falls back to a generated placeholder keyed to your handle.",
      },
    ],
    related: [
      { label: "Edit profile", href: "/settings/edit-profile" },
      { label: "Your data", href: "/settings/download-data" },
    ],
  },
  {
    slug: "data-permissions",
    title: "Cookies, analytics and sharing with partners",
    sub: "What each row on Data and permissions means, why essential cookies are fixed, and what partners get.",
    category: "Privacy and safety",
    keywords: "cookies analytics marketing personalised partners tracking essential switch off data permissions rows share anonymous",
    updated: REVIEWED,
    intro: [
      "Data and permissions is one page of rows about what may be collected about you. Two of them cover how you're shown things, and three cover cookies. They read on their own, but they depend on each other, so it's worth knowing which row actually controls which.",
      "One thing to state up front: this build loads no analytics and no advertising code. Moving these rows is you recording what you'd allow a fuller version to do — which is still worth doing now, so the choice is already yours before there's something to consent to.",
    ],
    steps: [
      {
        title: "Personalised experience",
        body: "On, what you do here shapes what you're shown. Off, you see the same thing as everyone else in the same order. It's independent of the cookie rows, so you can keep personalisation while turning analytics off.",
        href: "/settings/data-permissions",
        hrefLabel: "Data and permissions",
      },
      {
        title: "Essential cookies, which are always on",
        body: "This row is on for everyone and won't move. Press it and it says why: essential cookies are what keep you signed in and the app working. A switch that turned them off would only break the thing they exist to do, so the page explains instead of offering a lie.",
      },
      {
        title: "Analytics and marketing cookies",
        body: "Analytics cookies tell the team which features get used and where people get stuck. Marketing cookies measure campaigns, and they run on analytics data — so turning analytics off takes marketing off with it and locks that row until analytics is back on.",
      },
      {
        title: "Share anonymous usage data with partners",
        body: "A separate row, because agreeing to analytics is not agreeing to hand the same numbers to someone else. It holds counts of how the app is used with no name or content attached, and it stays off until you turn it on.",
      },
    ],
    notes: [
      {
        q: "Why can't I switch off essential cookies?",
        a: "Because without them the app can't hold a session. A toggle that turned them off would sign you out and break the page, so it's presented as a fixed row with an explanation, not a switch.",
      },
      {
        q: "If I turn marketing on but analytics is off, what happens?",
        a: "You can't. The marketing row is disabled while analytics is off, and pressing it tells you marketing needs analytics first, since it counts results from that data.",
      },
      {
        q: "Where does any of it go?",
        a: "Nowhere. Each row is a choice written to this browser's storage. Clearing the site's data deletes the choices, and no one can retrieve them afterwards, including you.",
      },
      {
        q: "Is sharing with partners the same as turning analytics on?",
        a: "No, and it's its own row for that reason. Analytics lets Tirbeo measure usage; Share anonymous usage data with partners would let someone else see those counts too — with no name, profile or content attached. It's off by default and stays off until you switch it, and nothing is sent to any partner in this build.",
      },
    ],
    related: [
      { label: "Data and permissions", href: "/settings/data-permissions" },
      { label: "Connected apps", href: "/settings/connected-apps" },
      { label: "Privacy policy", href: "/settings/help/policy/privacy" },
    ],
  },
  {
    slug: "disconnect-app",
    title: "Disconnecting a connected app",
    sub: "Revoke an outside service that can act as you, and know exactly what still works afterwards.",
    category: "Privacy and safety",
    keywords: "disconnect revoke connected app oauth google github discord remove access sign in with third party",
    updated: REVIEWED,
    intro: [
      "Connected apps lists the outside services you once allowed to sign you in or read a line of your profile. Each row says what that app can see and when it last came calling, which makes the list its own audit — anything you no longer use should be cut while you're on the page.",
      "Disconnecting is a decision on the app's own page, not a switch, and it asks once before acting. Revoking only ever stops that app; it never touches your Tirbeo account or the data on it.",
    ],
    steps: [
      {
        title: "Open the app, don't act from the list",
        body: "The list is read-only. Tap a row to reach its page, which shows the exact permissions it was granted, the account it's tied to, when it was connected and when it was last used.",
        href: "/settings/connected-apps",
        hrefLabel: "Connected apps",
      },
      {
        title: "Press Disconnect",
        body: "On that page, the Disconnect row leads to a confirmation sheet that names what you'll lose — for example, that signing in with that app stops and any profile lines it supplied come off. Read the line before confirming.",
      },
      {
        title: "Confirm, and check it moved to history",
        body: "Choose Yes, disconnect. The app leaves the connected list and appears under Disconnected recently, dated, so you can tell it was you who removed it. Reconnecting later starts the grant over from the beginning.",
      },
    ],
    notes: [
      {
        q: "Does disconnecting delete my Tirbeo account?",
        a: "No. It stops that one app from reaching you. Your account, your profile and everything saved to them stay exactly as they were.",
      },
      {
        q: "What keeps working after I revoke Google, GitHub or Discord?",
        a: "Everything about your Tirbeo account. What stops is the app's own part: signing in through it ends, and anything it filled in for you drops off — pinned repositories for GitHub, the linked account for Discord, reading your profile from Google. If another sign-in method is set up, that one keeps working.",
      },
      {
        q: "Does the app notice I disconnected?",
        a: "Not on its own. This build has no server to carry the revocation, so the honest move, if an app genuinely shouldn't reach you, is also to remove the connection on that app's side.",
      },
    ],
    related: [
      { label: "Connected apps", href: "/settings/connected-apps" },
      { label: "Data and permissions", href: "/settings/data-permissions" },
    ],
  },
  {
    slug: "pause-emails",
    title: "Pausing emails, and choosing your digest",
    sub: "The one switch that stops everything non-essential, and the cadence that decides how often the rest arrives.",
    category: "Getting around",
    keywords: "email pause digest weekly summary monthly recap frequency notifications stop unsubscribe bundle cadence",
    updated: REVIEWED,
    intro: [
      "Email preferences split by what a message is for, not by how often it goes. Two controls carry most of the weight: a master switch that pauses everything non-essential at once, and a cadence that bundles the rest. Account and security mail ignores both and keeps arriving.",
      "As with everything here, nothing is actually sent: this build has no mail server, so what you're saving is your preference, kept until something can act on it.",
    ],
    steps: [
      {
        title: "Reach for the one switch first",
        body: "Pause all non-essential emails sits on its own at the top. Turn it on and a sheet asks how long — a day, a week, a month, a year, or until you turn it back on. While it's on, the rows below it dim rather than pretending to change.",
        href: "/settings/notifications",
        hrefLabel: "Email preferences",
      },
      {
        title: "Know it resumes on its own",
        body: "A timed pause lifts itself when the clock runs out; the row says how long is left. Resume it early by switching it off again, which brings back the individual choices exactly as they were underneath.",
      },
      {
        title: "Then pick the digest you'll actually read",
        body: "Under Summaries and digests, Weekly summary rolls your highlights into one email a week, and Monthly recap is a once-a-month look back. They cover similar ground at different speeds, so choose the one you'd open rather than both.",
      },
      {
        title: "Set the pace for the rest",
        body: "How often you receive them offers Instant, Once a day and Up to once a week. Everything except account and security mail is held to that pace, whether that's one email the moment it happens or one bundle a week.",
      },
    ],
    notes: [
      {
        q: "Can I stop account and security emails too?",
        a: "No, and pausing doesn't touch them. Those tell you when a sign-in or a change you didn't make happens, so the row is fixed on and the page says so even while everything above is paused.",
      },
      {
        q: "Will I get any of these?",
        a: "Not from this build — there's nothing to send from. What's stored is your choice, waiting, and nothing here asks you to confirm by clicking a link in an inbox.",
      },
    ],
    related: [
      { label: "Email preferences", href: "/settings/notifications" },
      { label: "Data and permissions", href: "/settings/data-permissions" },
    ],
  },
  {
    slug: "language-dates",
    title: "The interface language and why dates change with it",
    sub: "One setting drives how dates, times and numbers are written everywhere in the app.",
    category: "Getting around",
    keywords: "language locale region date time format numbers 24 hour month names weekday translate choose list",
    updated: REVIEWED,
    intro: [
      "The language setting is not only about words. The names of months and weekdays, the order the parts of a date go in, whether a time uses a 12 or 24-hour clock and which digits you see all follow it, on every page that shows a stamp.",
      "Times themselves come from your device's clock and time zone, so you don't set those. A sign-in at a given instant reads the same moment everywhere; only how it's written changes.",
    ],
    steps: [
      {
        title: "Find your language",
        body: "The Language page lists each one written in its own script — Español, हिन्दी, 中文 — with the English name beside it when it differs. Type in the search box to narrow the list if you know the name.",
        href: "/settings/language",
        hrefLabel: "Language",
      },
      {
        title: "Pick it; it applies at once",
        body: "Choose a language and the app repaints immediately, including the tab title and the page's own language attribute, which is what lets a screen reader and a translation tool read the page correctly. There's no save button because there's nothing to confirm twice.",
      },
      {
        title: "Check it landed on a real date",
        body: "The helper at the top of the page shows a sample stamp in the language you just chose, so you can see the format applied without hunting for a dated row. Anywhere the app writes a time follows the same setting.",
      },
    ],
    notes: [
      {
        q: "Is the whole interface translated?",
        a: "No, and it's better said than implied. Dates, times and numbers follow your language; the words in the interface itself stay English in this build.",
      },
      {
        q: "Can I set the time zone by hand?",
        a: "There's no control for it, deliberately. The device already knows, and a setting that disagreed with the clock would just make every stamp in the app wrong in a different way.",
      },
    ],
    related: [
      { label: "Language", href: "/settings/language" },
      { label: "Appearance", href: "/settings/appearance" },
    ],
  },
  {
    slug: "theme-choice",
    title: "Dark, light and system theme",
    sub: "Three palettes on Appearance, and why System follows your device instead of picking one.",
    category: "Getting around",
    keywords: "theme dark light system appearance mode night colors palette follow device contrast",
    updated: REVIEWED,
    intro: [
      "Appearance offers three choices, each shown as a small preview of how it looks. System isn't a fourth colour: it means match whatever your device is set to, and flip with it when the device does.",
      "The choice is kept in this browser, so a different device or browser starts back on System until you set it. It's a display preference and touches nothing about your data.",
    ],
    steps: [
      {
        title: "Read the three options",
        body: "System says match your device's appearance; Dark is a deep charcoal built for night; Light is clean white with soft grey edges. Each row carries a miniature of its palette, so you can see the contrast before choosing.",
        href: "/settings/appearance",
        hrefLabel: "Appearance",
      },
      {
        title: "Choose, and it applies instantly",
        body: "Press a row and the palette changes across the app right away, with no reload. If you pick System, the page keeps listening to the device, so a scheduled light/dark change on your machine moves the app with it.",
      },
      {
        title: "Stop following the device if you want a fixed look",
        body: "Pin Dark or Light to keep the same palette no matter what your device does. Switch back to System to hand the decision back to the operating system.",
      },
    ],
    notes: [
      {
        q: "Does my theme carry to another browser?",
        a: "No. It's stored in this browser's own record, like the rest of these settings, so each place you open starts on System until you choose again.",
      },
      {
        q: "Which is the right one?",
        a: "Whichever you can read. System is the sensible default because it matches the rest of your device, but nothing here judges a fixed choice.",
      },
    ],
    related: [
      { label: "Appearance", href: "/settings/appearance" },
      { label: "Language", href: "/settings/language" },
    ],
  },
  {
    slug: "time-spent",
    title: "Time on the app and what it counts",
    sub: "The minutes Your activity draws are this device's own record — nothing is measured on a server.",
    category: "Your data",
    keywords: "time spent activity minutes per day weekly trend chart how long usage today screen dashboard",
    updated: REVIEWED,
    intro: [
      "Your activity answers how much time this account has spent here: a total for this week, a bar for each of the last seven days, and a curve over the last thirty. A dashed line marks your average day, and the busiest day is named in the summary under the big number.",
      "The honest part is where the numbers come from. They're drawn from this browser's own stored record of the account — no measurement is sent to or aggregated on a server, and there's no dashboard anyone else reads.",
    ],
    steps: [
      {
        title: "Read the week at the top",
        body: "The large figure is your total for this week, with an approximate daily average beside it and your busiest weekday named. Each bar is one day in minutes; tap a bar, or slide a finger along the row, to read that exact day.",
        href: "/settings/your-activity",
        hrefLabel: "Your activity",
      },
      {
        title: "Look at the longer trend",
        body: "The chart over the last thirty days answers whether time is trending up rather than how today went. Pick a filter chip to draw one activity in its own colour, or Everything to see all of them stacked.",
      },
      {
        title: "Go from the charts to the records",
        body: "Under Your records, two links leave this page: Recently deleted for things still recoverable, and Account history for every change you've made. Time spent is a summary; those are the itemised versions.",
      },
    ],
    notes: [
      {
        q: "Does this tell my real screen time?",
        a: "It reflects the time this app recorded for the account on this device. It's not a system-wide screen-time report and it can't see what you do in other apps.",
      },
      {
        q: "Can I export these figures?",
        a: "As part of the whole record, yes. Request an archive from Download your data; the activity numbers ride along with the rest of what this browser holds.",
      },
      {
        q: "Why are they different on another machine?",
        a: "Because they belong to this browser's storage, not to an account on a server. Nothing carries them across.",
      },
    ],
    related: [
      { label: "Your activity", href: "/settings/your-activity" },
      { label: "Recently deleted", href: "/settings/recently-deleted" },
      { label: "Download your data", href: "/settings/download-data" },
    ],
  },
  {
    slug: "deactivate-return",
    title: "Deactivating instead of deleting, and coming back",
    sub: "Hide the account and keep everything, then bring it straight back by signing in again.",
    category: "Your data",
    keywords: "deactivate pause hide profile reactivate come back sign in again restore not delete break",
    updated: REVIEWED,
    intro: [
      "Deactivating is the middle door: your profile leaves public view and your sessions end, but nothing is written away. It isn't deletion — there's no clock running and nothing to lose. Signing back in brings the whole thing back with no explanation needed afterwards.",
      "The page tells you what stops and what's kept, asks why you're going, and acts once you confirm. Coming back to the page while the profile is hidden shows the record and a single way to reverse it.",
    ],
    steps: [
      {
        title: "Pick a reason",
        body: "On Deactivate, choose from the list of reasons. The button stays locked until you do; if nothing fits, Something else opens a short box so you can say it in your own words.",
        href: "/settings/deactivate",
        hrefLabel: "Deactivate",
      },
      {
        title: "Confirm the deactivation",
        body: "Press Deactivate account, then read the sheet before confirming: it repeats that the profile stops loading for everyone and every device is signed out, including this one, while your handle stays reserved and nothing is deleted.",
      },
      {
        title: "Come back when you're ready",
        body: "While the profile is hidden, this page shows the record with a Reactivate now button. That signs you back in here. Every other device was ended when the profile went away, so each one has to sign in again on its own.",
        href: "/settings/deactivated",
        hrefLabel: "Deactivated",
      },
    ],
    notes: [
      {
        q: "How is this different from deleting?",
        a: "Deactivation hides and reverses; deletion removes and, after its window, cannot. If you might come back, deactivating is the one that lets you do so with everything intact.",
      },
      {
        q: "Does the deletion clock start while I'm deactivated?",
        a: "No. Nothing about deactivation begins a countdown — that only happens if you file a deletion from the Delete account page.",
      },
      {
        q: "Is a deactivation real in this build?",
        a: "It's local, like everything here. The record of going and coming back is written to this browser because there's no server holding an account to hide.",
      },
    ],
    related: [
      { label: "Deactivate", href: "/settings/deactivate" },
      { label: "Delete account", href: "/settings/delete-account" },
      { label: "Edit profile", href: "/settings/edit-profile" },
    ],
  },
  {
    slug: "cancel-deletion",
    title: "Cancelling a deletion inside the window",
    sub: "A deletion opens a thirty-day countdown you can call off; here's where that happens.",
    category: "Your data",
    keywords: "cancel delete stop deletion undo window thirty days countdown keep account change mind reactivate schedule",
    updated: REVIEWED,
    intro: [
      "Filing a deletion doesn't erase the account on the spot. It schedules a close thirty days out, and inside that window the one true action is to call it off. The Delete account page becomes the way back the moment a plan exists.",
      "While a deletion is pending the app is locked to that one decision: you either let the date pass or press cancel. Nothing else on the account opens until you've answered it.",
    ],
    steps: [
      {
        title: "Know the date you're working to",
        body: "With a deletion scheduled, the page names the day the account becomes final and shows a countdown ticking on its own, so you can see exactly how long is left to change your mind.",
        href: "/settings/delete-account",
        hrefLabel: "Delete account",
      },
      {
        title: "Press cancel while it's still counting",
        body: "Choose Cancel deletion and keep my account. That stops the whole thing, the countdown disappears, and the account returns to normal use. A short note confirms the deletion was cancelled.",
      },
      {
        title: "Understand what happens after the window",
        body: "If the date passes without a cancel, the account is set to close and there is nothing left on that page to undo it — the message then points to signing in again or talking to support. This build is local, so it's the point where the file, if you wanted one, should already be saved elsewhere.",
        href: "/settings/deletion-pending",
        hrefLabel: "Deletion pending",
      },
    ],
    notes: [
      {
        q: "Does signing in itself stop a deletion?",
        a: "On this build, use the cancel button rather than assuming. Reaching the Delete account page while the plan is pending gives you the countdown and the cancel in one place.",
      },
      {
        q: "Is there a shorter window?",
        a: "The window the page applies is thirty days. A reward is described as widening it, but until a server honours a redemption the window the delete page counts is still thirty.",
      },
      {
        q: "Will my data still be there if I cancel?",
        a: "Yes. Nothing is removed until the window closes, so cancelling inside it means the account simply carries on exactly as it was.",
      },
    ],
    related: [
      { label: "Delete account", href: "/settings/delete-account" },
      { label: "Deactivate", href: "/settings/deactivate" },
      { label: "Download your data", href: "/settings/download-data" },
    ],
  },
  {
    slug: "contact-support",
    title: "Writing to support, and what happens to the message",
    sub: "Where to describe a problem and the honest answer to where your message goes in this build.",
    category: "Getting around",
    keywords: "support contact message help request broken report reply inbox save device ticket ask",
    updated: REVIEWED,
    intro: [
      "Write to support is a full page rather than a popup, because a message you actually mean is worth the whole screen. You choose what it's about, describe what happened, and save it.",
      "Where it goes is the honest part: this build has no message server, so saving writes the request to this browser, into the same list the documentation index reads back. Nothing is sent to anyone, and no one replies — which is stated on the page instead of pretending a person will answer.",
    ],
    steps: [
      {
        title: "Say what it's about",
        body: "Use the topic selector to choose between something broken, your account, privacy and data, or something else. It groups the request so the record you save is legible later.",
        href: "/settings/help/support",
        hrefLabel: "Write to support",
      },
      {
        title: "Describe it, with a little room",
        body: "Write in the message box what happened and what you expected instead. It needs at least twenty characters before Save unlocks — a floor set so the thing worth reading back is a sentence, not one word.",
      },
      {
        title: "Save it and read it back",
        body: "Press Save request. The page confirms Saved on this device and shows what you filed, with options to write another or go back. Your full list of requests sits at the bottom of the documentation index.",
        href: "/settings/help",
        hrefLabel: "Documentation",
      },
    ],
    notes: [
      {
        q: "Will anyone read this?",
        a: "Not from this build. The request is stored in your browser and listed back to you, but there's no support queue on the other end — it's the right place to describe a problem, and not a way to reach a person.",
      },
      {
        q: "Does saving the message send it anywhere?",
        a: "No. Nothing leaves the device. If you need the message to reach someone, copy its text out and send it yourself; the record here is a draft you keep, not a ticket filed.",
      },
    ],
    related: [
      { label: "Write to support", href: "/settings/help/support" },
      { label: "Documentation", href: "/settings/help" },
      { label: "Account status", href: "/settings/account-status" },
    ],
  },
];
