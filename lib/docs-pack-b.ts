import type { DocArticle } from "@/lib/docs";

/* ═══════════════════════════════════════════════════════════════════
   docs-pack-b — Your data, Privacy, Profile, Getting around.

   Written against what this build really does. Behind these pages is
   the account service: your profile, your choices, your archive and your
   requests live on the account, mail is sent from it, and a signed-out
   browser can read them back. Where a limit still is the answer — a
   deleted item that cannot be un-deleted, a file Tirbeo does not keep a
   copy of — it is stated once, plainly, and never dressed up.

   Sign-ins, passwords, two-factor, passkeys, backup codes, devices and
   sessions live in docs-pack-a and are deliberately absent here.
   ═══════════════════════════════════════════════════════════════════ */

const REVIEWED = Date.UTC(2026, 8, 27);

export const PACK_B: DocArticle[] = [
  {
    slug: "archive-request",
    title: "Asking for a copy of your data",
    sub: "How the account builds an archive of everything it holds, and how to read the requests behind it.",
    category: "Your data",
    keywords: "archive export download my data copy gdpr request json html progress building file",
    updated: REVIEWED,
    intro: [
      "An archive is everything the account holds about you: your details, the choices you've saved, and the dated records the settings pages write. You ask for it, the account assembles it and your browser saves the file. Tirbeo keeps no copy of the file itself — only a ledger row saying what was requested, in which format, and how big it came out.",
      "The one you file gets its own page, which names the file, its size and what went into it. The steps below are all on those two pages.",
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
        body: "The account writes the file the moment you press the button, and your browser saves it. There's no progress bar to watch and no message to wait for: the button reports the file name and its size when the download lands, and the request's own page shows the same thing.",
      },
      {
        title: "Save the file when it's ready",
        body: "Once it reads Ready, press Download archive. The file is written by the account and handed to your browser's normal save. The page tells you the file name and its size, and the section list says how many records went into each part.",
      },
    ],
    notes: [
      {
        q: "Does the archive hold my password?",
        a: "No. A password is kept only as a hash, and there is nothing to put in the file. The same goes for your authenticator secret, your backup codes and your passkeys.",
      },
      {
        q: "Is a copy kept somewhere I can ask for later?",
        a: "No. The file is built when you ask for it and handed to you; Tirbeo keeps the ledger row, not the file. If you didn't save the file, you request another one.",
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
    title: "How many copies of your data you can ask for",
    sub: "There is no daily cap on archive requests — what the account does instead is write each one down.",
    category: "Your data",
    keywords: "limit daily requests cooldown wait rate three a day download data blocked timer",
    updated: REVIEWED,
    intro: [
      "There used to be a cap of three archives a day on this page, counted in the browser and lost with it. There isn't one now: the account writes the request down and builds the file, and every request in the app is subject to the same ordinary per-minute limit as any other call.",
      "What replaces the cap is the ledger. Each request is recorded with its format, its date and how the file came out, and the page reads that record back — so you can see what you have already asked for without building it again.",
    ],
    steps: [
      {
        title: "Read what the button is telling you",
        body: "Download all my data is pressed once per archive. If the account can't answer — because it's unreachable, or because the per-minute limit is being hit — the page says so and nothing is half-written: the request either exists in the ledger or it doesn't.",
        href: "/settings/download-data",
        hrefLabel: "Download your data",
      },
      {
        title: "Use the requests you already have",
        body: "The recent requests stay listed, each with its format and date, and each can be downloaded again without filing a new one. If your aim is just to get a file you already built, open it rather than requesting.",
      },
    ],
    notes: [
      {
        q: "Can I raise a limit that isn't there?",
        a: "There's nothing to raise: there is no cap on archive requests. The account's own rules about how many requests any one person may make in a minute apply here as they do everywhere else in the app.",
      },
      {
        q: "Does clearing my browser reset anything?",
        a: "It doesn't need to: the count that used to live in the browser's storage isn't there any more. The ledger of your requests lives on the account, so a fresh browser sees the same list you saw before.",
      },
    ],
    related: [
      { label: "Download your data", href: "/settings/download-data" },
    ],
  },
  {
    slug: "restore-deleted",
    title: "Getting something back, and what can actually be deleted",
    sub: "There is no Recently deleted tray, because Tirbeo holds no notes or files of yours. Here's what a delete does mean here.",
    category: "Your data",
    keywords:
      "restore undelete recently deleted trash put back delete for good permanent undo thirty days window cancel account deletion",
    updated: REVIEWED,
    intro: [
      "A tray of deleted things is a promise about the future: that a copy of what you removed is being kept somewhere and can be handed back. Tirbeo holds no notes, albums, files or bookmarks of yours, so there is no per-item delete to undo and nothing to put a tray on. Rather than show an empty screen and imply the shelf exists, this build says plainly that there isn't one.",
      "What the account does hold is a record of you — the profile, the sign-ins, the changes, the requests — and none of it is removable item by item either. Taking a copy before you go is what Download your data is for.",
    ],
    steps: [
      {
        title: "Take a copy before anything goes",
        body: "An archive of the whole record, requested from the app and written by the account. It's the only version of your data you can hold on to, because nothing inside Tirbeo keeps a second copy of an individual thing.",
        href: "/settings/download-data",
        hrefLabel: "Download your data",
      },
      {
        title: "Pause the account instead of deleting it",
        body: "Deactivating takes the account out of sight and stops it appearing to anyone else, and signing back in ends the pause. Nothing is removed, so there is nothing to restore afterwards.",
        href: "/settings/deactivate",
        hrefLabel: "Deactivate account",
      },
      {
        title: "Closing an account does have a countdown",
        body: "Filing a deletion sends a code to the address you sign in with, and the code schedules a thirty-day window. Cancel from the same screen that filed it and the account is untouched; let the window run out and the record is gone — support cannot recover it either.",
        href: "/settings/delete-account",
        hrefLabel: "Delete account",
      },
    ],
    notes: [
      {
        q: "Why isn't there a Recently deleted screen?",
        a: "There used to be one, and it listed six things that were never yours — they were examples the page wrote into this browser because it had nothing else to show. A screen whose only content is invented is worse than no screen, so the rows, the tray and its thirty-day clock went.",
      },
      {
        q: "Will there be one?",
        a: "When there is content to delete. A real tray needs a table behind it and a way for a delete to reach it; until both exist, an honest empty page is the most this screen could be, and this article is that page.",
      },
      {
        q: "If I delete my whole account, does anything save my data?",
        a: "No. The thirty-day window saves the account itself, not an export of it. Request the archive before filing the deletion if you want a copy — once the window closes there is nothing left to build one from.",
      },
    ],
    related: [
      { label: "Taking a copy of your data", href: "/settings/download-data" },
      { label: "Closing and deleting your account", href: "/settings/delete-account" },
      { label: "Your activity", href: "/settings/your-activity" },
    ],
  },
  {
    slug: "change-name",
    title: "Changing the name on your profile",
    sub: "The display name people see is edited in the profile sheet, and it saves straight to your account.",
    category: "Your data",
    keywords: "change display name full name profile rename edit name field save personal details",
    updated: REVIEWED,
    intro: [
      "Your display name is the large line at the top of your profile, separate from the @handle underneath it. You change it in the Edit profile sheet on the account settings, and it writes to your account.",
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
        body: "Press Save. The preview on the page updates to the new name and the change is written to the account. A toast reads Profile saved, and the change is recorded in the activity log with the device and address it came from.",
      },
    ],
    notes: [
      {
        q: "Does this change my @handle?",
        a: "No. The name and the username are two different boxes. Renaming leaves your link and your handle exactly as they were.",
      },
      {
        q: "Will the change show in another browser?",
        a: "Yes. The name belongs to the account, not to the browser you typed it on, so a second device signed in to the same account shows it too.",
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
      "The file pickers here only accept a picture, and only one up to five megabytes. Every rejection is one of those two rules, and the message tells you which. The photo is read into the browser, adjusted if you want it adjusted, and then sent to the account with the rest of your profile.",
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
        a: "Because the picture travels whole, as part of the profile record, and a very large image would bloat that record for no benefit. The cap keeps a stored photo reasonable.",
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
      "One thing to state up front: the choices are saved on your account, so they follow you to every device you sign in from. What the rows do to the app depends on the team behind it — and the one rule the account enforces itself is that marketing can't be on while analytics is off.",
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
        a: "The choices themselves go to the account, so they follow you between devices. What they allow is the other half: analytics cookies tell the team which features get used and where people get stuck, and marketing cookies measure campaigns against that data.",
      },
      {
        q: "Is sharing with partners the same as turning analytics on?",
        a: "No, and it's its own row for that reason. Analytics lets Tirbeo measure usage; Share anonymous usage data with partners would let someone else see those counts too — with no name, profile or content attached. It's off by default and stays off until you switch it, and the account won't let you turn marketing on while analytics is off, because marketing counts results from that data.",
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
        a: "Only when it tries. The grant is revoked on your account, so the next time that app asks to act as you the request comes back refused. If you'd rather it stopped asking at all, remove the connection on that app's own side as well — that's the one half the account can't reach.",
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
      "Every answer on this page is the account's: it is read from and written to the account service, so it follows you to every device you sign in from.",
    ],
    steps: [
      {
        title: "Reach for the one switch first",
        body: "Pause all non-essential emails sits on its own at the top. Turn it on and a sheet asks how long — a day, a week, a month, a year, or until you turn it back on. While it's on, the rows below it are held still: they keep the choices you already made, they say why when you tap them, and they are all still yours when the pause ends.",
        href: "/settings/notifications",
        hrefLabel: "Email preferences",
      },
      {
        title: "Know it resumes on its own",
        body: "A timed pause lifts itself when the clock runs out; the row says how long is left. Resume it early by switching it off again, which brings back the individual choices exactly as they were underneath.",
      },
      {
        title: "Then pick the digest you'll actually read",
        body: "Under Summaries and digests, Once a week rolls your highlights into one email a week, and Once a month is a once-a-month look back. They cover similar ground at different speeds, so choose the one you'd open rather than both.",
      },
      {
        title: "Set the pace for the rest",
        body: "The same row offers Once a day. Everything except account and security mail is held to that pace, whether that's one email the moment it happens or one bundle a day.",
      },
    ],
    notes: [
      {
        q: "Can I stop account and security emails too?",
        a: "No, and pausing doesn't touch them. Those tell you when a sign-in or a change you didn't make happens, so the row is fixed on and the page says so even while everything above is paused.",
      },
      {
        q: "Will I get any of these?",
        a: "Yes — the choices are the account's, and the account sends the mail. Turning a row off stops that kind of message reaching you; it doesn't unsubscribe you from the account or change anything else about it.",
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
        a: "The parts that repeat are: every page name, heading and control is written out for each language, and the body copy on the longer screens is translated on the fly and cached on the device. What isn't translated is anything a human being wrote for you to read — a message from the team, or a document you uploaded.",
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
    title: "The black palette",
    sub: "One palette across the account apps — a black canvas, plates lifted off it, blue for the things you can press.",
    category: "Getting around",
    keywords: "theme dark black appearance mode night colors palette contrast midnight",
    updated: REVIEWED,
    intro: [
      "Appearance shows a single theme, drawn as a small preview rather than described. Tirbeo sits on black: the canvas is #000 and everything on it is a slightly lighter plate, so a card, a field and a pressed row are all recognisable at a glance. Blue is kept for the actions.",
      "It's a display preference and touches nothing about your data, so nothing you save here changes what is stored or who can see it.",
    ],
    steps: [
      {
        title: "Read the preview",
        body: "The miniature on Appearance is painted with the exact colors the app uses, so what you approve there is what every other settings screen gives you — no surprises after the fact.",
        href: "/settings/appearance",
        hrefLabel: "Appearance",
      },
      {
        title: "Nothing to switch",
        body: "The app no longer follows your device's light/dark setting, so a scheduled change on your machine won't move it mid-task. Text stays light on a solid panel, and the blue you see marks what you can press.",
      },
    ],
    notes: [
      {
        q: "Is there a light mode?",
        a: "No. The account apps were rebuilt around one black palette so this app, accounts and the sign-in pages all match; the earlier light scheme was a second design that drifted from the first.",
      },
      {
        q: "Will my eyes thank me at noon?",
        a: "Probably. A dark app in a bright room is a matter of taste, not of correctness — if you'd rather have the light scheme back, say so from Help and support and the team can weigh it.",
      },
    ],
    related: [
      { label: "Language", href: "/settings/language" },
      { label: "Help and support", href: "/settings/help/support" },
    ],
  },
  {
    slug: "time-spent",
    title: "Time on the app and what it counts",
    sub: "The minutes Your activity draws are counted from the account's own records.",
    category: "Your data",
    keywords: "time spent activity minutes per day weekly trend chart how long usage today screen dashboard",
    updated: REVIEWED,
    intro: [
      "Your activity answers how much time this account has spent here: a total for this week, a bar for each of the last seven days, and a curve over the last thirty. A dashed line marks your average day, and the busiest day is named in the summary under the big number.",
      "The honest part is where the numbers come from. They're counted on the account from the rows it has written — the changes you made and the times someone got in — grouped by day in your own time zone. Nothing is estimated and nothing is extrapolated: a day with no rows is a day the account has no record of.",
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
        body: "Under Your records, one link leaves this page: Account history, every change you've made to the account. Time spent is a summary; that one is the itemised version.",
      },
    ],
    notes: [
      {
        q: "Does this tell my real screen time?",
        a: "It reflects what the account recorded for you. It's not a system-wide screen-time report and it can't see what you do in other apps.",
      },
      {
        q: "Can I export these figures?",
        a: "As part of the whole record, yes. Request an archive from Download your data; the activity numbers ride along with the rest of what the account holds.",
      },
      {
        q: "Why are they different on another machine?",
        a: "They shouldn't be: the numbers are counted on the account, so a second device signed in to the same account sees the same days. A day may still read differently if one device was in use and the other wasn't — the count is of the account's records, not of a clock running in a browser.",
      },
    ],
    related: [
      { label: "Your activity", href: "/settings/your-activity" },
      { label: "Account history", href: "/settings/activity-log" },
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
        body: "While the profile is hidden, signing in opens one screen with a Reactivate now button — nothing else on the account is reachable until you press it. Every other device was ended when the profile went away, so each one has to sign in again on its own.",
        href: "/settings",
        hrefLabel: "Settings",
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
        q: "Is a deactivation real?",
        a: "Yes. The account goes into its own deactivated state on the account service: the profile stops loading for everyone else, the other sessions are ended, and the record of going and coming back is written down where it can be read back.",
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
        body: "If the date passes without a cancel, the account is set to close and there is nothing left on that page to undo it — the message then points to signing in again or talking to support. That is the point at which the file, if you wanted one, should already be saved somewhere else.",
        href: "/settings/delete-account",
        hrefLabel: "Delete account",
      },
    ],
    notes: [
      {
        q: "Does signing in itself stop a deletion?",
        a: "Use the cancel button rather than assuming. Reaching the Delete account page while the plan is pending gives you the countdown and the cancel in one place.",
      },
      {
        q: "Is there a shorter window?",
        a: "The window the page applies is thirty days. A reward is described as widening it, but until the account honours a redemption the window the delete page counts is still thirty.",
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
    sub: "Where to describe a problem and the honest answer to where your message goes.",
    category: "Getting around",
    keywords: "support contact message help request broken report reply inbox save device ticket ask",
    updated: REVIEWED,
    intro: [
      "Write to support is a full page rather than a popup, because a message you actually mean is worth the whole screen. You choose what it's about, describe what happened, and save it.",
      "Where it goes is the honest part: saving files the request on the support desk, with your words and the date attached. The request is read back on the same page and on every device you sign in from, and it is a real ticket — one a person can answer.",
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
        body: "Press Save request. The page confirms that it was filed and shows what you sent, with options to write another or go back. Your full list of requests sits at the bottom of the documentation index.",
        href: "/settings/help",
        hrefLabel: "Documentation",
      },
    ],
    notes: [
      {
        q: "Will anyone read this?",
        a: "Yes. It's a ticket on the support desk, filed with your words and the date, and the account keeps the reference so you can quote it. What comes back depends on the people behind the desk, not on the app.",
      },
      {
        q: "Does saving the message send it anywhere?",
        a: "It files it. The request goes to the support desk with your account attached, so nobody has to guess which Tirbeo it came from, and it stays listed for you to come back to.",
      },
    ],
    related: [
      { label: "Write to support", href: "/settings/help/support" },
      { label: "Documentation", href: "/settings/help" },
      { label: "Account status", href: "/settings/account-status" },
    ],
  },
];
