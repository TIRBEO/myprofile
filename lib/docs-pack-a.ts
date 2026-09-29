import type { DocArticle } from "@/lib/docs";

/* ═══════════════════════════════════════════════════════════════════
   Pack A — signing in, devices, sessions and security

   Twenty articles, each one against what these pages actually do. The
   same rule as the rest of the documentation: this build has no server,
   so a password is never stored, nothing is emailed, a sign-out can't
   reach another machine and a review request has nobody reading it. Where
   that limit is the answer to the question, the article says so once and
   moves on rather than dressing it up.
   ═══════════════════════════════════════════════════════════════════ */

/** The day this text was last read against the app, not a rolling "today". */
const REVIEWED = Date.UTC(2026, 8, 27);

export const PACK_A: DocArticle[] = [
  {
    slug: "change-password",
    title: "Changing the password you sign in with",
    sub: "Where the password lives, what the sheet actually checks, and what the strength bar is scoring.",
    category: "Signing in",
    keywords: "change password update new strength meter minimum length re enter confirm",
    updated: REVIEWED,
    intro: [
      "The password sits on the Password and security page, in the first row under Sign-in. Tapping Change password opens a sheet with three boxes: the one you use now, the one you want, and the one you want again.",
      "While you type, the sheet keeps three rules: the current box isn't empty, the new password is at least 8 characters, and the last two boxes agree. It cannot keep a fourth rule, because nothing here stores a password to compare the first box against.",
    ],
    steps: [
      {
        title: "Open the row",
        body: "Change password is the top row on Password and security, above the Saved login info switch. The whole row is the target — there's no separate button waiting on the right.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Fill in the three boxes",
        body: "The third one asks for the new password again so a typo can't lock you out of something you can't read back. Each box has an eye on its right edge that shows what you typed in that box only.",
      },
      {
        title: "Read the bar under the new password",
        body: "Four segments, named on the right of the label: Too short, Weak, Fair, Good, Strong. It only reaches Strong at twelve or more characters with upper and lower case together and a digit alongside a symbol. Length on its own gets you Fair, which is a fair description of a long password you use everywhere.",
      },
      {
        title: "Press Update password",
        body: "The button stays shut while any of the three rules fails, and the failure is written under the box that caused it — “Use at least 8 characters” or “Passwords don't match”. When it goes through, the sheet closes and the page says Password updated.",
      },
      {
        title: "Then deal with the machines that had the old one",
        body: "A new password stops the next sign-in, not the one already running. Devices and sessions is the list of what's running, and the last row on it ends several at once.",
        href: "/settings/devices",
        hrefLabel: "Devices and sessions",
      },
    ],
    notes: [
      {
        q: "Is the password I just typed stored?",
        a: "No. The sheet holds the three boxes in memory while it's open and forgets them when it closes, and the archive of your data has no password field to export because there was never a value kept.",
      },
      {
        q: "Why score a password nothing checks?",
        a: "Because the strength bar is about the new password you're writing, which is the half you can still get right. The rule it's defending against is the one that matters on any service that does check: a password reused somewhere else is only as good as the weakest place it was sent.",
      },
      {
        q: "Is there one password or one per device?",
        a: "One for the account, and this is the only page that changes it. What you save here is saved in this browser, so a second machine doesn't see the change — which is why the device list, not this row, is where you look to see who's in.",
      },
    ],
    related: [
      { label: "Password and security", href: "/settings/security" },
      { label: "When the current password is wrong", href: "/settings/help/wrong-current-password" },
      { label: "Two-factor authentication", href: "/settings/two-factor" },
    ],
  },
  {
    slug: "wrong-current-password",
    title: "When the current password is wrong",
    sub: "Why this app never says so, the only two errors the sheet can give, and what a forgotten password means.",
    category: "Signing in",
    keywords: "wrong current password forgotten can't remember update disabled greyed out reset",
    updated: REVIEWED,
    intro: [
      "“Your current password is incorrect” is not a message this app can produce. It has nowhere to look one up: nothing in this build stores a password, so the Current password box is only checked for having something in it.",
      "That makes the failures you can get quite specific, and it makes a forgotten password a different problem from the one it looks like. Telling the two apart is most of this page.",
    ],
    steps: [
      {
        title: "Check what the button is waiting for",
        body: "Update password stays disabled until three things are true: the current box has something in it, the new password is at least 8 characters, and the third box matches the second. If it won't move, it's one of those three.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Know the only two errors",
        body: "“Use at least 8 characters” and “Passwords don't match” are the whole set of complaints this sheet makes, written under the box that failed. There is no third message, and the missing one isn't being hidden from you.",
      },
      {
        title: "Understand why it can't be checked",
        body: "A password kept anywhere is a password that can be read, so this build keeps none at all. The trade is even: the form can't stop someone who already has this browser, and it also can't be the thing that turns you away.",
      },
      {
        title: "If you've forgotten it",
        body: "The sign-in screen opens the settings on whatever you type, so being locked out of this demo isn't something that happens here. The Forgot password button on that screen does nothing in this build — there's no mail server to send from and no stored password to replace.",
        href: "/login",
        hrefLabel: "Sign in",
      },
      {
        title: "Where a password does leave a trace",
        body: "The activity log keeps a record that a password changed, with the device and the network address it came in on. That record can say nothing about either password, and its own page says so in those words.",
        href: "/settings/activity-log",
        hrefLabel: "Activity log",
      },
    ],
    notes: [
      {
        q: "So is my password safe here?",
        a: "It isn't stored, which is the strongest thing that can be said of it. It also means the pages asking for one aren't checking it — don't carry the habit across and expect the same behaviour somewhere that does.",
      },
      {
        q: "Can I find out what my password was?",
        a: "No, and not from an archive either. Download your data has no password field, because there's no value anywhere to put in it.",
      },
      {
        q: "Does the recovery email rescue a forgotten password?",
        a: "On a real service, that's what it's for. Here it's only a stored line — setting it doesn't unlock anything, and no link arrives to click. See the recovery email article for what the sheet does and doesn't do.",
      },
    ],
    related: [
      { label: "Changing the password", href: "/settings/help/change-password" },
      { label: "Setting a recovery email", href: "/settings/help/recovery-email" },
      { label: "Password and security", href: "/settings/security" },
    ],
  },
  {
    slug: "turn-on-two-factor",
    title: "Turning two-factor on",
    sub: "The setup sheet, the key you type instead of scanning, and the codes that arrive at the end.",
    category: "Signing in",
    keywords: "two factor 2fa authenticator app setup scan qr type key second step",
    updated: REVIEWED,
    intro: [
      "Two-factor is the row called Authenticator app at the top of its own page, under Methods. It starts switched on in this build, so if you're turning it on you either had it off or you're setting it up again — the sheet is the same either way.",
      "The setup is one secret shown two ways: a QR to scan and a key to type. What you hand back is the six digits your app is producing at that moment, and the page checks them against that secret before the switch flips.",
    ],
    steps: [
      {
        title: "Open the row",
        body: "Tapping anywhere on the row opens the setup sheet — the switch drawn on it is a picture, not the thing you press. If the row already reads on, tapping it asks whether you want to turn it off instead.",
        href: "/settings/two-factor",
        hrefLabel: "Two-factor authentication",
      },
      {
        title: "Get the key into your app",
        body: "Scan the QR, or choose the option in your app to enter a key by hand and use the Setup key printed under the picture. Both carry the same secret; the key is grouped in fours so it survives being read off a screen, and Copy puts it on the clipboard if typing thirty-two characters isn't your evening.",
      },
      {
        title: "Enter the six digits",
        body: "Next leads to six boxes. Type the code your app is showing now and press Confirm — the line under the boxes exists because codes rotate every 30 seconds. A code that doesn't match clears the boxes, says so in red and leaves the sheet open, so you can try the next one.",
      },
      {
        title: "Take the codes before you close anything",
        body: "A correct code switches two-factor on and issues eight backup codes in the same motion, shown once with Copy all and Download PDF on the bottom of the sheet. Save them there and then: closing the sheet files them away and the page will not print them again.",
      },
      {
        title: "Decide the two extra rows",
        body: "Under Extra security, Require 2FA for sensitive actions covers changing the password, the email and payouts, and Alert on suspicious sign-in is the notice you'd want about a stranger. Both are stored as settings beside the switch; nothing in this build prompts for the code they describe.",
      },
    ],
    notes: [
      {
        q: "Will the sign-in screen start asking for a code?",
        a: "Not in this build — the login page takes whatever is in the password box. What you're doing is putting the app and the codes in place, and recording the rule you want enforced, before there's a second step that can stop you at the door.",
      },
      {
        q: "Where does the secret live?",
        a: "In this browser, and nowhere else. Your phone gets its copy when you scan or type the key, which is why the two halves have to be set up in one sitting — nothing sends the secret to you afterwards.",
      },
      {
        q: "Why won't the Email codes row move?",
        a: "It's deliberately stuck. The Methods description says codes go to your recovery email and can't be turned off, and tapping the row answers with that rather than pretending to change it.",
      },
    ],
    related: [
      { label: "Two-factor authentication", href: "/settings/two-factor" },
      { label: "Backup codes", href: "/settings/backup-codes" },
      { label: "Turning two-factor off", href: "/settings/help/turn-off-two-factor" },
    ],
  },
  {
    slug: "turn-off-two-factor",
    title: "Turning two-factor off",
    sub: "What the confirmation means when it says your backup codes stop working, and how coming back on differs.",
    category: "Signing in",
    keywords: "turn off two factor disable 2fa authenticator app backup codes stop working",
    updated: REVIEWED,
    intro: [
      "The row that's on asks before it switches. Tapping Authenticator app while it reads on opens “Turn off the authenticator app?” with three lines, and the second of them is the one people miss.",
      "Turning the app off retires the codes issued under it — they were proof of a second step that no longer exists. It also throws away the secret, so switching it back on later is a new setup rather than a resumption.",
    ],
    steps: [
      {
        title: "Read what the sheet says",
        body: "Sign-ins stop asking for a code from your app. Your current backup codes stop working. Email codes stay on. That's the entire effect, and Keep it on is the way out if you only wanted a look.",
        href: "/settings/two-factor",
        hrefLabel: "Two-factor authentication",
      },
      {
        title: "Press Turn off when you mean it",
        body: "The confirmation is red. It clears the secret and every set of codes from this browser, and the Backup codes row on the same page stops opening, reading “Generated automatically when the authenticator app is on”.",
      },
      {
        title: "Check the state you're left in",
        body: "Open Backup codes and the page says Two-factor is off, and that a set of codes will be created for you when the app goes back on. Nothing is left in a half state, which is the point of retiring the codes rather than parking them.",
        href: "/settings/backup-codes",
        hrefLabel: "Backup codes",
      },
      {
        title: "Coming back on is a new setup",
        body: "Tap the row again and the sheet shows a QR and a Setup key that no longer match the entry sitting in your app. Delete the old Tirbeo entry on the phone and add the new key, or the codes will never agree. A fresh set of eight codes arrives with the switch, and it replaces every set before it.",
      },
    ],
    notes: [
      {
        q: "I turned it off by accident. Are my codes gone?",
        a: "The working ones, yes, and the page won't show them again even if you switch it straight back on. Turning it on issues a new set, so anyone holding a printout of the old one is holding paper that opens nothing.",
      },
      {
        q: "Does turning it off sign anyone out?",
        a: "No. It changes how a future sign-in would be checked, not who is signed in right now. Devices and sessions is the list of who's in, and that's where a stranger gets dealt with.",
      },
      {
        q: "Can I turn the email codes off too?",
        a: "There's no switch for them and nothing to hide: they're the fallback that stays on while the app comes off, which is the arrangement you want when the phone is the thing that's missing.",
      },
    ],
    related: [
      { label: "Two-factor authentication", href: "/settings/two-factor" },
      { label: "Backup codes", href: "/settings/backup-codes" },
      { label: "When the code doesn't match", href: "/settings/help/authenticator-code-wrong" },
    ],
  },
  {
    slug: "authenticator-code-wrong",
    title: "When the code doesn't match",
    sub: "The ninety-second window, the stale entry left in your app, and the clock nothing here can see.",
    category: "Signing in",
    keywords: "code doesn't match authenticator wrong otp invalid clock time drift rejected",
    updated: REVIEWED,
    intro: [
      "The red line under the six boxes says “That code didn't match. Codes change every 30 seconds — try the one showing now.” That's the whole diagnosis this app offers, so it's worth knowing the three things it can mean.",
      "Codes come out of a shared secret and the current time, in 30-second steps. The check accepts the code for this step, the step before and the step after — roughly a minute and a half of tolerance. Outside that window, a correct setup still fails, and it fails every time.",
    ],
    steps: [
      {
        title: "Send the code that's on screen now",
        body: "Not the one you saw thirty seconds ago. The boxes were cleared when the attempt failed, which is the sheet's way of stopping you sending the same dead code twice.",
        href: "/settings/two-factor",
        hrefLabel: "Two-factor authentication",
      },
      {
        title: "Suspect the entry, not the arithmetic",
        body: "The Setup key on the sheet is the current one for this browser. If two-factor has been switched off and on since you scanned, your app is holding a retired secret and no code from it will ever match. Delete the Tirbeo entry in the app and add the key that's on screen now.",
      },
      {
        title: "Check the phone's clock",
        body: "A phone more than about a minute out of true produces codes for the wrong step. Nothing in this app can see your clock or correct it — there's deliberately no time setting anywhere in these pages — so the fix lives on the phone: let it set its time automatically, or use the time correction inside your authenticator app if it has one.",
      },
      {
        title: "Rule out the key itself",
        body: "Spaces, dashes and case don't matter — the key is read the same however your app wrote it down. A wrong character does. If you typed the key rather than scanning it, compare it against the screen four characters at a time, and remember that a key only ever uses the letters A to V and the digits 2 to 7: a 0, 1, 8 or 9 you're sure you saw is a misread rather than a mistake.",
      },
      {
        title: "If nothing matches, start over",
        body: "Turn the authenticator off and on again. That retires the codes, issues a new secret and puts a QR you can trust back on the screen — which is a faster route to a working second step than an hour of comparison.",
      },
    ],
    notes: [
      {
        q: "Do failed attempts count against me?",
        a: "No. There's no counter, no lockout and no record of the tries. Six wrong codes and then a right one look exactly like one right code, which is a weakness and a convenience at the same time in a build with no server watching.",
      },
      {
        q: "Why 30 seconds and six digits?",
        a: "Because that's the standard every authenticator app implements: six digits, a new step twice a minute. Anything narrower would work on this screen and fail on the next phone you set up.",
      },
      {
        q: "My clock is right and it still fails.",
        a: "Then the two of you are reading different secrets, which is step two. A code can only ever match the key it was generated from, and turning two-factor off replaces that key.",
      },
    ],
    related: [
      { label: "Two-factor authentication", href: "/settings/two-factor" },
      { label: "You lost the phone with the authenticator", href: "/settings/help/lost-phone" },
      { label: "Backup codes", href: "/settings/backup-codes" },
    ],
  },
  {
    slug: "lost-phone",
    title: "You lost the phone with the authenticator on it",
    sub: "What's on that phone, what you can do from a browser that still works, and in which order.",
    category: "Signing in",
    keywords: "lost phone stolen authenticator backup code new phone move locked out",
    updated: REVIEWED,
    intro: [
      "A phone in this setup holds two things: the copy of the secret your authenticator app turns into codes, and possibly a passkey. Neither one is the account. The other half of the secret is in the browser you're reading this in, which is why losing the handset isn't losing the account.",
      "What to do depends on whether the phone is gone for the night or gone for good. Both routes start on a device that still opens the settings, and neither of them can reach the phone itself.",
    ],
    steps: [
      {
        title: "Work from a browser that still has the account",
        body: "The sign-in screen here opens the settings on whatever you type, because there's nothing stored to check against. On a service that does check, this is the moment a backup code is for — which is the argument for having generated a set while things were calm.",
        href: "/login",
        hrefLabel: "Sign in",
      },
      {
        title: "Move the authenticator to the new phone",
        body: "The setup key lives in this browser, and the page only shows it through the setup sheet, which won't open while the switch reads on. Turn Authenticator app off — the confirmation warns that your current backup codes stop working — then turn it on again and enter the new key on the new phone.",
        href: "/settings/two-factor",
        hrefLabel: "Two-factor authentication",
      },
      {
        title: "Confirm, then take the new codes",
        body: "Six digits from the new phone, and eight backup codes appear once with Copy all and Download PDF. Save them before you close the sheet: they replace every set before them, including any you printed for the phone that's gone.",
      },
      {
        title: "Retire the old phone's passkey",
        body: "Passkeys lists each one by the name you gave it and the date. Tap the row and Remove it — signing in with that passkey stops working here, while the other passkeys and the password carry on. What it can't do is take the key off a handset you no longer have.",
        href: "/settings/passkeys",
        hrefLabel: "Passkeys",
      },
      {
        title: "If the phone was taken, change the password as well",
        body: "Nothing on these pages can stop someone holding a device that's already signed in. Changing the password stops the next sign-in, and Select devices to log out ends the sessions on the list — then go back through the list tomorrow, because a stolen phone that still works will come back.",
        href: "/settings/devices/sign-out",
        hrefLabel: "Select devices to log out",
      },
    ],
    notes: [
      {
        q: "Can I just re-use an old screenshot of the QR?",
        a: "Only while the secret behind it is still current. Turning two-factor off clears it, and the next setup replaces it — so from that day the old picture generates codes for an account that no longer listens to them.",
      },
      {
        q: "Is there any way to revoke the phone itself?",
        a: "No. There's no server here to carry a revocation to anything; every action on these pages edits this browser's record of the account. That's the honest limit of this whole section, and it's why the password matters more than the list.",
      },
      {
        q: "Do I have to redo this in every browser?",
        a: "Worse and better: each browser holds its own copy of these settings, including its own secret, so a second machine signed in to this account has its own switch and generates different codes. Fixing one device doesn't fix the other, and the two-factor page on each is where you'd see it.",
      },
    ],
    related: [
      { label: "Two-factor authentication", href: "/settings/two-factor" },
      { label: "Backup codes", href: "/settings/backup-codes" },
      { label: "Passkeys", href: "/settings/passkeys" },
    ],
  },
  {
    slug: "backup-codes",
    title: "Backup codes: getting them, and getting them saved",
    sub: "Eight codes shown once, a new set that kills everything before it, and three sets an hour at most.",
    category: "Signing in",
    keywords: "backup codes recovery one time generate download pdf copy print save",
    updated: REVIEWED,
    intro: [
      "Backup codes live behind Two-factor authentication, on a page of their own. They're the way in when the app isn't: eight of them at a time, each good for one sign-in and then nothing.",
      "The page will never print a code again once you've dismissed it. What it does keep is the record — when each set was made and how many codes it held — so you can always tell which piece of paper is the current one.",
    ],
    steps: [
      {
        title: "Get to the page",
        body: "It's reached from the two-factor page rather than the sidebar. While two-factor is off the row there won't open, and the page itself says Two-factor is off and stops.",
        href: "/settings/backup-codes",
        hrefLabel: "Backup codes",
      },
      {
        title: "Press Generate",
        body: "The row reads “Generate codes” the first time and “Generate new codes” after that, and it goes red once a working set exists — because that's the case where the press throws something away. The confirmation is blunt about it: your 8 current codes stop working, including any you've saved or printed.",
      },
      {
        title: "Save them before you close the sheet",
        body: "Eight codes in two columns, with Copy all and Download PDF along the bottom. The line above them isn't a warning about a possibility: once you close this, they can't be shown again. Navigating away counts as closing.",
      },
      {
        title: "Keep them somewhere that isn't the phone",
        body: "The PDF is one page, each code in its own box, and it's called tirbeo-backup-codes.pdf. A printed copy in a drawer or a note in a password manager is the point. Stored on the same handset as the authenticator, they're both gone in the same taxi.",
      },
      {
        title: "Know the limit before you need it",
        body: "Three sets an hour. Past that the row goes dim and reads Try again in 12 min, and the count runs down on the page without a reload. The reason sits on the row above: generating is also how you invalidate a set that leaked.",
      },
    ],
    notes: [
      {
        q: "How many sets does the page remember?",
        a: "The six most recent, newest first, each with its date and how long ago it was made. The line at the top names the newest, and that's the only set that can currently be worth anything.",
      },
      {
        q: "Are the codes really gone after the sheet closes?",
        a: "Gone from the screen. A set is written to this browser's storage when it's issued and stays there until newer sets push it out of the history or the site's data is cleared — which is worth knowing on a machine you don't own. The page refusing to print them again is a rule about the interface, not about where the bytes are.",
      },
      {
        q: "What does a code look like?",
        a: "Five characters, a dash, five more, drawn from an alphabet with no I, O, 0 or 1 in it so that a code read aloud over the phone is the same code when it's typed.",
      },
      {
        q: "Do they expire?",
        a: "Not with age. A code ends when it's spent, when you generate a newer set, or when two-factor is turned off. Nothing in between touches it.",
      },
    ],
    related: [
      { label: "Backup codes", href: "/settings/backup-codes" },
      { label: "Two-factor authentication", href: "/settings/two-factor" },
      { label: "A backup code that says already used", href: "/settings/help/backup-code-already-used" },
    ],
  },
  {
    slug: "backup-code-already-used",
    title: "A backup code that says already used",
    sub: "Why a code you never spent won't work, and which of four things actually stopped it.",
    category: "Signing in",
    keywords: "backup code already used invalid expired doesn't work rejected typo recovery",
    updated: REVIEWED,
    intro: [
      "“This code has already been used” has four causes behind it, and only one of them is that you typed it twice. The other three are all about which set the code came out of.",
      "Start from the fact that explains most of them: generating a new set stops every code before it, including any you saved or printed. So a code that never worked for you may have worked perfectly for whoever caused the next set to exist.",
    ],
    steps: [
      {
        title: "Find out which set is current",
        body: "The line at the top of the page names the newest set and how old it is. The History under it lists up to six, newest first. A code from an older printout than the top line is not a live code, however carefully you've kept it.",
        href: "/settings/backup-codes",
        hrefLabel: "Backup codes",
      },
      {
        title: "Check whether two-factor is on at all",
        body: "Turning the authenticator off retires every set issued under it. If two-factor is off, the codes page says so in one line and no code from anywhere will do anything — the message you got would be a lie in that situation, which is how you'd know you were on the wrong account.",
        href: "/settings/two-factor",
        hrefLabel: "Two-factor authentication",
      },
      {
        title: "Read back what you typed",
        body: "Five characters, a dash, five more, from an alphabet that excludes I, O, 0 and 1. If your copy contains any of those four characters, you're looking at a transcription error, not a spent code.",
      },
      {
        title: "Look for a set you didn't make",
        body: "This is the one to act on. A History entry dated a day you weren't generating codes means somebody else pressed Generate, which invalidated the set you were holding — almost certainly so they could use their own. End the sessions and change the password before you print anything new.",
        href: "/settings/devices",
        hrefLabel: "Devices and sessions",
      },
      {
        title: "Issue a fresh set and save it",
        body: "Generate on the page. The eight that appear are the only codes that mean anything from now on, and they leave the screen the moment you close the sheet — so the saving has to happen while they're visible.",
      },
    ],
    notes: [
      {
        q: "Does anything in this build check a code?",
        a: "No. There's no screen here that asks for a backup code, so “already used” is a message you'd get from a real service. The four causes above are the same on either build, which is why they're on this page.",
      },
      {
        q: "Can I get an old set back?",
        a: "Not onto the screen, and it doesn't work either way: the codes stopped the moment a newer set was issued. The copy you kept is the only version of them that survives, and it's now decoration.",
      },
      {
        q: "How many sign-ins does a set cover?",
        a: "Eight, one per code. A set is eight ways in without your app, not eight attempts at the same one — so if you've spent six of them, generate again rather than rationing what's left.",
      },
    ],
    related: [
      { label: "Backup codes", href: "/settings/backup-codes" },
      { label: "You lost the phone with the authenticator", href: "/settings/help/lost-phone" },
      { label: "An unfamiliar device in the list", href: "/settings/help/unknown-device" },
    ],
  },
  {
    slug: "set-up-passkey",
    title: "Setting up a passkey",
    sub: "One name is all that's stored, five is the cap, and the list can't tell you whether it works.",
    category: "Signing in",
    keywords: "passkey setup add face id touch pin passwordless name limit remove",
    updated: REVIEWED,
    intro: [
      "A passkey is made on the device or the password manager you choose and never leaves it. Tirbeo keeps the name you gave it and the date it was added, and nothing else — the page says exactly that above the list.",
      "That makes the name the only thing you control here, and it's the thing worth twelve seconds of thought: in a year, a row called “passkey” tells you nothing about whose phone it is.",
    ],
    steps: [
      {
        title: "Add one while the password still works",
        body: "A passkey is a second door, not a bricked-up first one. The password row stays where it is, and until you've signed in with the passkey on the device you actually carry, you'd be trading something you know for something you haven't tested.",
        href: "/settings/passkeys",
        hrefLabel: "Passkeys",
      },
      {
        title: "Press Add passkey and name the machine",
        body: "One field, nothing else. The placeholder is the browser's guess at what you're holding; overwriting it with something like “phone in my pocket” is the useful move. Names are capped at forty characters, and the name is what the row, the removal question and the confirmation all repeat back.",
      },
      {
        title: "Confirm the row appeared",
        body: "The new passkey sits at the top of the list with today's date and the device it thinks it was made on, and the count on the Passkeys row under Second steps goes up by one. That's the whole signal this page gives you.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Test it before you rely on it",
        body: "The list can't say a key is present on a device — nothing here asks the device to prove anything — so the test is a sign-out and a sign-in on the machine you'd be using it on. Two rows that both claim to work is a better position than one that quietly doesn't.",
      },
      {
        title: "Know the cap, and clear what you can't place",
        body: "Five passkeys per account; at five the Add pill goes dim and says Limit reached — remove one to add another. Tap any row to ask about it: “Remove <name>?” explains that signing in with that passkey stops working right away while other passkeys and the password carry on. Remove anything you can't account for.",
      },
    ],
    notes: [
      {
        q: "Isn't one passkey enough?",
        a: "It can be. A key stored in a password manager or a system keychain can sync to everything signed in to it, so one row may already cover a phone, a tablet and a laptop. A key kept in one handset's secure area covers that handset. Both are normal, and the list can't tell them apart — which is why the name is the whole record.",
      },
      {
        q: "Does removing a row revoke the key?",
        a: "It edits this list. The key lives on a device or in a manager this build can't reach, so removal is how you stop trusting the entry here, not how you take it off the handset. If the machine is gone, change the password as well.",
      },
      {
        q: "Do hardware keys count?",
        a: "Yes. A key on a fob is a passkey you carry rather than one your phone holds, and it counts against the same five.",
      },
    ],
    related: [
      { label: "Passkeys", href: "/settings/passkeys" },
      { label: "A passkey that won't finish on a new device", href: "/settings/help/passkey-not-working" },
      { label: "Keeping your sign-in yours", href: "/settings/help/sign-in" },
    ],
  },
  {
    slug: "passkey-not-working",
    title: "A passkey that won't finish on a new device",
    sub: "Why the key doesn't come with the phone, what to sign in with instead, and when to add a second row.",
    category: "Signing in",
    keywords: "passkey not working new phone no prompt won't finish fall back password",
    updated: REVIEWED,
    intro: [
      "A passkey doesn't move by itself. It lives wherever it was made — in the phone's own secure area, in a password manager, on a hardware key — and a new device has to be given that same store before it can offer the key to anything.",
      "So a prompt that never arrives usually isn't a broken account. It's a device that was never holding that key in the first place.",
    ],
    steps: [
      {
        title: "Sign in the other way first",
        body: "Password, plus a code if two-factor is on. The sign-in screen here opens the settings on whatever you type, so this step is about the habit rather than the demo: wherever a passkey can fail, the fallback has to be something you still know.",
        href: "/login",
        hrefLabel: "Sign in",
      },
      {
        title: "Find out which store the key was made in",
        body: "Password managers and system keychains sync keys between devices; a key kept inside one handset doesn't. If your passkeys live in a manager, signing in to that manager on the new device is the whole fix — the key is already there, it just wasn't on this machine yet.",
      },
      {
        title: "If it never syncs, add a key here",
        body: "Don't remove the old row. Up to five passkeys can sit on the account, and a second row is what lets two phones open it without either one waiting for the other. Name it for the device, so the list still reads as a list of machines.",
        href: "/settings/passkeys",
        hrefLabel: "Passkeys",
      },
      {
        title: "Work around the cap",
        body: "At five, Add passkey is shut and says Limit reached — remove one to add another. The right move is dropping a row for a device you no longer own, not adding one you can't test. Remove, then add, then sign out and back in on the new machine before you call it done.",
      },
      {
        title: "Know what this build's Add actually did",
        body: "It wrote a row: the name, the device guessed from your browser, today's date. There's no challenge for the device to sign, so a passkey that “won't finish” on this demo isn't failing — nothing asked it to. Treat the list as a record of intentions until you've used a passkey somewhere that checks one.",
      },
    ],
    notes: [
      {
        q: "I removed the row by mistake. Is the key gone?",
        a: "Gone from the list, not from the device. Adding it again makes a new record with a new date; whatever the device was holding is still sitting there. That's worth knowing about the five-key cap before you clear rows to make room.",
      },
      {
        q: "Could someone else add a passkey to my account?",
        a: "They'd have to be signed in first, which is why the device list matters more than this page. A row you didn't name is a reason to read Login activity from around its date, and to end the sessions you can't place.",
      },
      {
        q: "Should I keep the password once passkeys work?",
        a: "Yes. A passkey that depends on a phone is a passkey that depends on a phone being charged, findable and not in for repair. The password is the door that never needs a battery.",
      },
    ],
    related: [
      { label: "Passkeys", href: "/settings/passkeys" },
      { label: "Setting up a passkey", href: "/settings/help/set-up-passkey" },
      { label: "Login activity", href: "/settings/login-activity" },
    ],
  },
  {
    slug: "recovery-email",
    title: "Setting a recovery email",
    sub: "The address a reset would go to, the six boxes that confirm it, and what this build cannot send.",
    category: "Signing in",
    keywords: "recovery email verify address confirmation code six digit not receiving resend",
    updated: REVIEWED,
    intro: [
      "The Recovery section on Password and security holds one address, and it isn't the one the account was made with. That address under Personal details is fixed — its own page says it can't be changed there — so this is the one you can move.",
      "It's worth moving while you can still sign in. A recovery address chosen after you're locked out is a decision somebody else is making for you.",
    ],
    steps: [
      {
        title: "Read what's stored now",
        body: "The row shows the whole address, unmasked, under the words Recovery email. The line above the section is the reason it exists: it's the only way back if you lose the password and your codes together.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Type the new address",
        body: "The sheet checks only the shape of it — something, an at sign, a domain with a dot in it. Anything that fits lets Verify through, and the second step repeats the address back, so read it there before you go on.",
      },
      {
        title: "Enter the six digits",
        body: "Step two is a code sent to that address, in six boxes, with Didn't get it? Resend code underneath. Nothing arrives in this build and no code is checked: filling the six boxes and pressing Confirm is what writes the address, and the page says Recovery email verified afterwards.",
      },
      {
        title: "Check the row afterwards",
        body: "It shows the new address in full. The old one is gone and there's no list of previous recovery addresses on this page — the address is the only thing kept about it.",
      },
      {
        title: "Choose an address you can still receive at",
        body: "One on a different provider from your main address is the practical answer, because the failure that needs recovery is usually the kind that takes both the mailbox and the password.",
      },
    ],
    notes: [
      {
        q: "Why have a step that can't check anything?",
        a: "Because it's the shape of the real thing: address, then a code to that address, then a stored confirmation. On a build that could send, the same sheet would stop you at the second step. The muscle memory transfers even if the code doesn't.",
      },
      {
        q: "Does it have to be different from my login email?",
        a: "There's no rule either way, and the sheet won't argue. In practice the useful one is the address that isn't on the account, since the account's own address is the thing that's usually in dispute.",
      },
      {
        q: "Can I clear it and leave the field empty?",
        a: "No — the sheet won't accept an address that isn't an address, so the line always holds something. If you've never touched it, what's showing is the address this demo started with rather than one you chose. Put yours in.",
      },
    ],
    related: [
      { label: "Password and security", href: "/settings/security" },
      { label: "Personal details", href: "/settings/personal-details" },
      { label: "Recovery details need re-confirming", href: "/settings/help/phone-not-checked" },
    ],
  },
  {
    slug: "sign-in-blocked",
    title: "A sign-in was blocked, and what the notice means",
    sub: "The difference between an attempt turned away and your account being limited, and what to do about each.",
    category: "Signing in",
    keywords: "sign in blocked attempt notice restricted why wrong password three times appeal",
    updated: REVIEWED,
    intro: [
      "“Blocked” in these pages means one attempt was turned away before it got in. It doesn't mean the account is limited, and it doesn't mean your password stopped working — the thing that failed was somebody else's guess at it.",
      "The notice shows up in two places that answer different questions. Login activity is the record of the attempt; Account status is the decision taken about it. Only the second one can be argued with.",
    ],
    steps: [
      {
        title: "Read the record first",
        body: "A blocked attempt sits in the log in red as “Blocked sign-in”. Open it and the page says what the machine did and how it was stopped — for the one in the log here, an unknown browser in Lagos trying the same password three times and being turned away for it.",
        href: "/settings/login-activity",
        hrefLabel: "Login activity",
      },
      {
        title: "Then read the decision",
        body: "Account status groups these under “Sign-ins we stopped” — the row carries a count, and the list under it holds one entry per decision. Each one names the rule it was taken under and what it's asking you to do about it.",
        href: "/settings/account-status",
        hrefLabel: "Account status",
      },
      {
        title: "Work out whether it was you",
        body: "A VPN, a mobile network or a work proxy can put your own sign-in in another city, so a town you don't recognise isn't evidence on its own. Answer the question on the record instead: “This was me” settles it, “That wasn't me” marks it and offers the two things that help.",
        href: "/settings/login-activity",
        hrefLabel: "Login activity",
        figure: {
          route: "/settings/login-activity",
          target: 'main a[href^="/settings/login-activity/"]',
        },
      },
      {
        title: "If it was you, ask for the review",
        body: "The decision's own page has the button, and the line above it says what a review could change — in this case, that the network gets stopped being held back. Write a couple of sentences about who was using the device and where from, and send it.",
        href: "/settings/account-status/sign-ins",
        hrefLabel: "Sign-ins we stopped",
      },
      {
        title: "If it wasn't you, change the password",
        body: "Three wrong guesses is an attempt to get in, and a review would only explain that away. The fix is the password and the sessions, in that order — and remember that a blocked attempt can be the last thing you see before a successful one.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
    ],
    notes: [
      {
        q: "Does a blocked sign-in limit anything on my account?",
        a: "No. The account keeps working; the attempt didn't get in. What can limit the account is a separate kind of row — “What's limited right now” under Account status — and that page says which parts are on hold and until when.",
      },
      {
        q: "There's a second entry that says a new device was held for a code. Is that the same thing?",
        a: "It isn't. Held means the password was right and the sign-in waited for a two-factor code before it got in — a second step doing its job, not a block. That one has no review left on it either, because there's nothing in it to dispute.",
      },
      {
        q: "Will anyone look at my review?",
        a: "Not in this build. Filing one writes your note and the date to this browser and marks the decision as under review, and the answer is supposed to appear on the same page. There's no reviewer, and nothing is emailed about it.",
      },
    ],
    related: [
      { label: "Account status", href: "/settings/account-status" },
      { label: "Login activity", href: "/settings/login-activity" },
      { label: "Saying that wasn't me about a sign-in", href: "/settings/help/sign-in-not-me" },
    ],
  },
  {
    slug: "unknown-device",
    title: "An unfamiliar device in the list",
    sub: "How to read a machine you don't recognise, what ending its session really does, and what to do after.",
    category: "Signing in",
    keywords: "unknown device unfamiliar session log out stranger other country vpn address",
    updated: REVIEWED,
    intro: [
      "The devices page is a list of machines that hold a session on your account. The one you're reading it on leads, labelled as such so it's never the thing you end by accident, and everyone else sits under “Logins on other devices”.",
      "Most unfamiliar rows are your own kit seen from outside. Some aren't. The difference is in what you read before you press anything.",
    ],
    steps: [
      {
        title: "Read the whole row, not the name",
        body: "Each line carries the machine's name, the town, how long ago it was active, the browser and the network address. The name is the least reliable part of that: it's read from the browser's own description of itself, and “Unknown browser” is what a hardened or an old one looks like.",
        href: "/settings/devices",
        hrefLabel: "Devices and sessions",
        figure: {
          route: "/settings/devices",
          target: 'main a[href^="/settings/devices/"]',
        },
      },
      {
        title: "Open the row before you judge it",
        body: "A device has a page of its own: what it was running, when the session started, the last moment it asked for anything, the sign-ins made from that machine and where its address traces to. The address is the fact to check against your memory — a phone on a carrier network is drawn to wherever the carrier's gateway is, not where the phone is.",
      },
      {
        title: "Rule out your own things first",
        body: "A VPN moves the town. A work laptop behind a corporate proxy comes in on someone else's address. A tablet in a drawer has a session that looks active because something in it woke up. The sign-in list on the device's own page is what settles most of these: your machine signing in every few days reads nothing like a stranger.",
      },
      {
        title: "End the one you're sure about",
        body: "On the device's page, Log out of this device is the red pill. The sheet asks once — that device will need your password, and a fresh two-factor code, to sign back in — and on confirmation the row leaves the list and reappears under Recent activity as a dated record of being ended.",
      },
      {
        title: "Then close the door it used",
        body: "Changing the password is the half that stops the next sign-in, and Select devices to log out is how you end the rest in one pass rather than one page at a time. Do both before you close the tab, or the machine you just removed will be back.",
        href: "/settings/devices/sign-out",
        hrefLabel: "Select devices to log out",
      },
    ],
    notes: [
      {
        q: "Does signing a device out reach that device?",
        a: "No, and this is the honest limit of the page. Nothing here has a server to carry an instruction, so ending a session corrects this account's record of it. If a machine genuinely isn't yours, the password change is the part that bites.",
      },
      {
        q: "Why does something I've never seen say it was active forty minutes ago?",
        a: "Because the entry says when that session last asked for anything, read against this device's clock. Times and locations on this page come from the record, not from a live look at the machine, so read the pair together with the sign-ins rather than trusting either alone.",
      },
      {
        q: "Is there a machine here I've never seen at all?",
        a: "Possibly — the list is the account's own record of sessions, kept in this browser, and there's no server behind it that has met any of them. That cuts both ways: it's still the right place to practise reading a stranger, and it's not evidence about anyone's hardware.",
      },
    ],
    related: [
      { label: "Devices and sessions", href: "/settings/devices" },
      { label: "The devices holding your account", href: "/settings/help/sessions" },
      { label: "Login activity", href: "/settings/login-activity" },
    ],
  },
  {
    slug: "sign-in-not-me",
    title: "Saying “that wasn't me” about a sign-in",
    sub: "What the answer does, what the log-out button actually ends, and the second half of the fix.",
    category: "Signing in",
    keywords: "that wasn't me i didn't do this report suspicious log out everywhere",
    updated: REVIEWED,
    intro: [
      "Every sign-in in the log asks one question on its own page: was this you. The two answers aren't symmetric. “This was me” marks the record checked and changes nothing else. “That wasn't me” turns the entry red and puts two actions on the page beside it.",
      "Both answers are written onto the record in this browser. Nothing is sent, no one is alerted and there's no report to follow up — which is worth knowing before you treat the button as the end of the job.",
    ],
    steps: [
      {
        title: "Open the sign-in rather than answering from the list",
        body: "The list gives you a line; the record behind it gives you the device, the town, the network address, the time and the map, and says plainly that the town was traced from the address rather than from the device. Read that before you decide.",
        href: "/settings/login-activity",
        hrefLabel: "Login activity",
      },
      {
        title: "Press That wasn't me, and answer the sheet",
        body: "The sheet repeats the record inside the question so you're answering something you can see: Yes, that's me marks it checked and leaves the session alone; No, that wasn't me marks it in red and puts the log-out on the page; Let me look again closes the sheet without answering either way.",
      },
      {
        title: "Press Log out of all sessions",
        body: "It ends every session on the account except the one you're reading from, and the button then reads Logged out everywhere and won't fire twice. The line under it says what happened: each of those machines now needs your password to get back in.",
        href: "/settings/devices",
        hrefLabel: "Devices and sessions",
      },
      {
        title: "Take the password pill that appears",
        body: "Once the sessions are closed, a second button shows up on the same page — Change your password. That order isn't decoration: closing sessions does nothing while the password that opened them is still valid, because the next sign-in is one keystroke away.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Change your answer if you were wrong about it",
        body: "The tick or the mark on a log row isn't final. On an answered record, Change my answer puts it back to asking, which is the way to undo a flag you gave a sign-in that turned out to be your own tablet.",
      },
    ],
    notes: [
      {
        q: "Is anyone told when I say it wasn't me?",
        a: "No. The answer sits on the record in this browser and lifts the banner at the top of the log — useful for keeping track of what you've already disputed, not a report anyone receives. If you need a person to look, that's Account status or writing to support.",
      },
      {
        q: "Does the red banner on the log mean I'm still exposed?",
        a: "It means at least one record is flagged and un-settled. It stops nagging when you've answered everything; it doesn't re-check anything, so treat the number of rows under the banner as a to-do count rather than an alarm level.",
      },
      {
        q: "Should I flag a sign-in from a city I've never been to?",
        a: "Check the address first. A mobile carrier routes a phone through its home city however far it has travelled, and a VPN replaces the address with one belonging to whoever runs it, so an unfamiliar town can be a boring explanation. Flag it if the address is one you've never used either.",
      },
    ],
    related: [
      { label: "Login activity", href: "/settings/login-activity" },
      { label: "Select devices to log out", href: "/settings/devices/sign-out" },
      { label: "An unfamiliar device in the list", href: "/settings/help/unknown-device" },
    ],
  },
  {
    slug: "sign-out-other-devices",
    title: "Signing out of several devices at once",
    sub: "The multi-select page, why the count is in the button, and what the machines need to come back.",
    category: "Signing in",
    keywords: "log out several devices all sessions bulk select deselect end multiple machines",
    updated: REVIEWED,
    intro: [
      "Ending machines one at a time is fine for one and miserable for five. The last row on the devices page opens a page of its own where every machine becomes a tick box and the only thing at the bottom is the decision.",
      "It's a separate page rather than a mode so that the count is never a surprise: the number of devices you've picked appears in the header line, in the button and again in the confirmation.",
    ],
    steps: [
      {
        title: "Open the picker",
        body: "“Select devices to log out” is the red row at the bottom of the list, and it only appears while there is a list to pick from. On a single-device account there's nothing to end but your own session, so the row isn't there.",
        href: "/settings/devices",
        hrefLabel: "Devices and sessions",
      },
      {
        title: "Tick the machines",
        body: "Each row is one device with its town, how long ago it was active and its network address, and tapping the row toggles it. The header counts as you go — 3 of 5 selected — and Select all is on the same line for the case where everything is going.",
        href: "/settings/devices/sign-out",
        hrefLabel: "Select devices to log out",
      },
      {
        title: "Press the red button",
        body: "It reads Log out of 3 devices, and it stays shut until at least one is ticked so you can't fire an empty selection by muscle memory. The sheet that follows asks “End 3 sessions now?” and says what is and isn't affected: people using those machines are signed out immediately, nothing is deleted.",
      },
      {
        title: "Confirm, and read where they went",
        body: "Confirmed, the devices leave the list and turn up under Recent activity as dated entries — one per machine ended, or one line for the batch. That's the record that explains a gap in the list later, including to you.",
      },
      {
        title: "Follow it with the password",
        body: "A signed-out machine needs your password to come back, which is exactly why the password has to change if any of them wasn't yours. End the sessions, then Update the password on Password and security while the list is fresh in your mind.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
    ],
    notes: [
      {
        q: "Can I end the device I'm using by mistake?",
        a: "No. This machine isn't offered to the picker at all — it's filtered out before the list is drawn. Signing yourself out is the Log out of Tirbeo row on Password and security, which asks separately.",
      },
      {
        q: "Does ending a session delete anything?",
        a: "Nothing but the session. Whatever those machines had saved is still saved; they just have to sign in again to reach it.",
      },
      {
        q: "Will they really be signed out?",
        a: "Not by this. There's no server to carry the instruction, so what changes is this account's list of live sessions and the record of ending them. Treat the password change as the part that actually stops a stranger, and this as tidying the list they came off.",
      },
    ],
    related: [
      { label: "Devices and sessions", href: "/settings/devices" },
      { label: "What signing out here does", href: "/settings/help/signing-out" },
      { label: "The devices holding your account", href: "/settings/help/sessions" },
    ],
  },
  {
    slug: "signing-out",
    title: "What signing out here does and doesn't do",
    sub: "One row closes one session. This is the map of what stays put and what moves when you come back.",
    category: "Signing in",
    keywords: "log out sign out difference session cookie inactivity timer stay signed in",
    updated: REVIEWED,
    intro: [
      "“Log out of Tirbeo” is the red row at the bottom of Password and security, and the heading above it already says the important part: logging out closes this session only. Other devices keep working until you end them on their own row.",
      "It's the smallest of the three exits. It doesn't hide your profile, doesn't remove anything saved, and doesn't stop a second machine that's already in.",
    ],
    steps: [
      {
        title: "Press the row and answer the sheet",
        body: "The sheet asks “Log out of Tirbeo?” and says you can log back in any time with your email and password. Stay signed in closes it without doing anything; Log out drops the session and puts you on the sign-in screen.",
        href: "/settings/security",
        hrefLabel: "Password and security",
        figure: {
          route: "/settings/security",
          target: 'main button:has-text("Log out of Tirbeo")',
        },
      },
      {
        title: "Know the other way to reach it",
        body: "On a wide screen the rail has its own Log out at the bottom left, and it opens the same sheet. There is one logout in this app, and both entrances are this browser's.",
      },
      {
        title: "Set how long a session should last",
        body: "The Saved login info switch under the password row decides it. On, the session survives closing the browser. Off, the switch's own line says the deal: sign out automatically after 1 hour of inactivity, and a cookie that dies when the browser closes.",
      },
      {
        title: "Recognise the inactivity sign-out when it happens",
        body: "With the switch off, an hour with no tap, keypress or scroll ends the session and lands you on the login screen with one line under the title: You were signed out after an hour of inactivity. Nothing was deleted to cause it — the session stopped being held, which is the whole of it.",
        href: "/login",
        hrefLabel: "Sign in",
      },
      {
        title: "Reach for the bigger exits when you mean them",
        body: "Deactivating hides the account and keeps everything, and signing back in reverses it. Deleting schedules an end with a window to call it off. Both have their own pages, and neither is what a log out does.",
        href: "/settings/deactivate",
        hrefLabel: "Deactivate",
      },
    ],
    notes: [
      {
        q: "Does logging out clear what I've saved here?",
        a: "No. Everything you've set in these pages — the two-factor switch, the recovery address, your choices, the logs — lives in this browser, not in the session. Sign back in and it's all exactly as you left it.",
      },
      {
        q: "Someone used my laptop and I logged out. Am I safe?",
        a: "You've stopped the next person opening the app without a password, which is worth doing. You haven't touched anything they may already have taken, and you haven't reached any other machine. Change the password and end the other sessions from wherever you are now.",
      },
      {
        q: "What actually removes all of this?",
        a: "Clearing the site's data in your browser. It takes the settings, the logs and the archive of your own requests with it, and there's no copy anywhere to come back from — which is the same fact as “nothing leaves this device”, seen from the other side.",
      },
    ],
    related: [
      { label: "Password and security", href: "/settings/security" },
      { label: "Select devices to log out", href: "/settings/devices/sign-out" },
      { label: "Deactivating instead of deleting", href: "/settings/help/closing" },
    ],
  },
  {
    slug: "account-held",
    title: "The account is held at one page",
    sub: "A decision has to be read before anything else opens, and there are two ways past it.",
    category: "Privacy and safety",
    keywords: "account held only page can't reach settings read this carry on stuck",
    updated: REVIEWED,
    intro: [
      "Some states shut the whole settings area down to a single card. There's no rail behind it, no search, no back chevron — and if you try another address, a bookmark or the browser's back button, you come back to the card. That's deliberate: a page that explains a stop while letting you browse past it would just be a banner.",
      "Three things can do this, in order of how final they are: a deletion you've scheduled, a pause you've taken, and a decision about the account that hasn't been read yet. Only the last one lets you carry on.",
    ],
    steps: [
      {
        title: "Read the card before you press anything",
        body: "It names the check the decision came from, the decision itself, the date, the rule applied and — where there is one — what the decision is asking for. Everything else on the account waits, so this is the page worth reading properly once.",
      },
      {
        title: "Choose between appealing and carrying on",
        body: "Two pills: Appeal this decision, or I've read this — carry on. Either one opens the account again. Neither lifts the decision; what the first one does is put a written request against it, and what the second does is record that you saw it.",
      },
      {
        title: "If you appeal, write an answer",
        body: "The box wants at least 40 characters before Send appeal will move, and it counts up to 900 as you type. Say who was using the device, what you were doing and what you think was misread. The card quotes what it needs from you above the box — that's the sentence to answer.",
      },
      {
        title: "Expect another one if there's another one",
        body: "The stop is the first decision you haven't answered or acknowledged, so clearing one can land you on the next. That's not the app repeating itself; it's a queue of decisions each asking to be seen once. The list of all of them is under Account status.",
        href: "/settings/account-status",
        hrefLabel: "Account status",
      },
      {
        title: "Know the two that can't be set aside",
        body: "A scheduled deletion holds the account at its own page with one button, Keep my account, and a deactivation holds it at one with Reactivate now. Neither offers “I've read this”, because neither is asking to be read — they're waiting for a decision.",
        href: "/settings/delete-account",
        hrefLabel: "Delete account",
        figure: {
          route: "/settings/delete-account",
          target: 'main a:has-text("Deactivate for a while")',
        },
      },
    ],
    notes: [
      {
        q: "I closed the tab. Am I still held?",
        a: "Yes. The stop is read from this browser every time the account shell loads, so reloading, another tab and a typed-in address all land on the same card. It clears when the decision has been answered or acknowledged, not when the tab has.",
      },
      {
        q: "Does setting a decision aside make it go away?",
        a: "No, and the card says so in its own small print. It stops blocking the account and stays on file under Account status, still appealable, still with the same effect on whatever part of the account it touches.",
      },
      {
        q: "Is anyone reading what I appeal?",
        a: "Not in this build. The request is written to this browser with your words and the date, the decision's page changes to Under review and lists what happens next, and there is no reviewer behind it. It's a record of what you asked, which is still the useful part.",
      },
    ],
    related: [
      { label: "Account status", href: "/settings/account-status" },
      { label: "Requests and history", href: "/settings/account-status/history" },
      { label: "When something on your account is restricted", href: "/settings/help/status" },
    ],
  },
  {
    slug: "changes-on-hold",
    title: "Account changes are on hold until an email is confirmed",
    sub: "What the hold says, which address it means, and why the edit pages still work.",
    category: "Privacy and safety",
    keywords: "account changes on hold confirm email unconfirmed can't edit verification pending",
    updated: REVIEWED,
    intro: [
      "This one sits under “What's limited right now” on the account status page, and it reads: details can't be edited until the new email address is confirmed, everything else works as normal.",
      "It's the trickiest kind of decision to act on, because it names a confirmation you can't send yourself and points at an address you can't change from these pages. Both are worth being clear about before you start.",
    ],
    steps: [
      {
        title: "Open the decision and read what it covers",
        body: "The detail page gives you the rule it was taken under — verification, unconfirmed email address — the date it was made and the one thing a review could change. Note whether it says “details” or names a specific field, because that's the difference between a hold on your profile and a hold on your sign-in.",
        href: "/settings/account-status/limits",
        hrefLabel: "What's limited right now",
      },
      {
        title: "Work out which address it means",
        body: "There are two, and only one of them is settable here. The account's own address sits under Personal details, read-only, marked Confirmed, and that page states plainly that it can't be changed there. The one you can move is the recovery email on Password and security.",
        href: "/settings/personal-details",
        hrefLabel: "Personal details",
      },
      {
        title: "Try the confirmation this build can offer",
        body: "Setting the recovery email runs the two-step sheet — address, then six digits — and stores the address as verified. Nothing arrives at either address in this build, so this is the closest thing here to confirming something, and it's worth doing so that a later service has a live address to send to.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Ask for a review of the hold",
        body: "The decision is appealable, and its own text says what a review would do: explain why the confirmation isn't reaching you and the address gets checked by hand. Write the address in question into the request, since “the email” is ambiguous and the reviewer will have two to choose between.",
      },
      {
        title: "Know that the hold isn't enforced here",
        body: "The edit pages still save in this build — profile, details and password all go through while the decision reads as needing action. Say that once and no further: the hold is a listed decision, and nothing on these pages is the thing that would stop you using it.",
        href: "/settings/edit-profile",
        hrefLabel: "Edit profile",
      },
    ],
    notes: [
      {
        q: "Will confirming the email lift the hold?",
        a: "On a real service, that's the intent. Not here: the app has no way to send or check anything, so the decision would stay listed whichever boxes you filled. The action that fits this build is the review request, filed with your words in it.",
      },
      {
        q: "Is my account limited right now?",
        a: "The page groups this with one other row under limits, and the count beside the section is what's still open. Only the appealable rows ask anything of you; the other kind on that page is final and can't be moved from here at all.",
      },
      {
        q: "Does asking for a review lift it while it waits?",
        a: "No, and the page keeps showing the limit rather than hiding it during the review. That's the honest arrangement: the restriction stays until someone changes it, and the review is how you get to be changed.",
      },
    ],
    related: [
      { label: "Account status", href: "/settings/account-status" },
      { label: "Setting a recovery email", href: "/settings/help/recovery-email" },
      { label: "The account is held at one page", href: "/settings/help/account-held" },
    ],
  },
  {
    slug: "phone-not-checked",
    title: "A phone number that hasn't been checked in two years",
    sub: "The final row under limits, what it doesn't block, and the two things you can actually do about it.",
    category: "Privacy and safety",
    keywords: "phone number not checked two years recovery re-confirm stale final no review",
    updated: REVIEWED,
    intro: [
      "Under “What's limited right now” there's a row that says recovery details need re-confirming, with a line about the phone number on the account not having been checked in two years. It's the least alarming kind of decision on the page and the most frustrating, because it's the kind with no button on it.",
      "Decisions come in two shapes here. Some can be reviewed; this one is marked final, which means the detail page has no request button at all and says “This one has no review left on it — the decision is final” in its place.",
    ],
    steps: [
      {
        title: "Open it and confirm which shape it is",
        body: "The detail page's record block gives the rule and the date; underneath, the wording tells you whether there's an action left. A final row also won't hold the account open at a single page — only decisions you can still answer do that.",
        href: "/settings/account-status/limits",
        hrefLabel: "What's limited right now",
      },
      {
        title: "Put a current number where the number lives",
        body: "Personal details has a Phone row that opens one field, with the hint that it's used for login alerts and account recovery. Saving writes it to this browser. No code is sent and nothing is checked, so it doesn't produce a “confirmed today” date — but it is the field the decision is about.",
        href: "/settings/personal-details",
        hrefLabel: "Personal details",
        figure: {
          route: "/settings/personal-details",
          target: 'main button:has-text("Edit contact details")',
        },
      },
      {
        title: "Make the half you can complete strong",
        body: "The recovery email is the address that can actually be verified from these pages, through the two-step sheet on Password and security. If the phone is stale and can't be re-checked here, the email is where your recovery should point.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
      {
        title: "Write it down if you need it changed",
        body: "The route for a decision with no review left is support, quoting the row's title and date so the two can be read together. The page saves what you file on this device and says so rather than promising a reply.",
        href: "/settings/help/support",
        hrefLabel: "Write to support",
      },
    ],
    notes: [
      {
        q: "Does this stop me signing in?",
        a: "No. It isn't one of the rows that hold the account at a single page, and nothing on the sign-in path consults it. It's a note on the account's recovery details, and it stays listed under Account status until it's changed somewhere else.",
      },
      {
        q: "Why can't I appeal a stale number?",
        a: "Because there'd be nothing for a reviewer to re-judge: the fact is a date, not a decision about your conduct. Appeals are for things that were interpreted; this row is for something that needs doing, which is why the page's answer is the phone field rather than a button.",
      },
      {
        q: "If I update the number, does the row clear?",
        a: "Not in this build. The decision list isn't read against what you've saved since — there's no server comparing the two. What you get is a current number in the field and the dated record of you having set it.",
      },
    ],
    related: [
      { label: "Account status", href: "/settings/account-status" },
      { label: "Personal details", href: "/settings/personal-details" },
      { label: "Setting a recovery email", href: "/settings/help/recovery-email" },
    ],
  },
  {
    slug: "change-not-mine",
    title: "A change you didn't make is in the activity log",
    sub: "Reading one record properly, answering it, and why the log-out there is smaller than it sounds.",
    category: "Signing in",
    keywords: "activity log change didn't make username email changed who did this address",
    updated: REVIEWED,
    intro: [
      "The activity log is the account's record of edits to itself: the field, what it was, what it became, the device and network address it came in on, and when. It's a separate thing from the sign-in log — one is what changed, the other is who arrived.",
      "An entry you don't recognise is worse news than a stranger signing in, because a change means someone got in far enough to press Save. Answer it in the order that closes the door rather than the order that feels best.",
    ],
    steps: [
      {
        title: "Open the entry instead of answering from the list",
        body: "The list shows one line: the change, the field and the new value. The record behind it says what the field was before, which is often the thing that tells you whether it was you — a username you renamed months ago has a before and an after you can remember.",
        href: "/settings/activity-log",
        hrefLabel: "Activity log",
      },
      {
        title: "Read the device and the address together",
        body: "Each record names the machine and the network address the change arrived on, with the town it resolves to and a map. The address is the harder fact: the town is what a lookup says, and a carrier or a VPN can move that without moving the person.",
      },
      {
        title: "Say it wasn't you",
        body: "Two buttons on the record: This was me, and That wasn't me. The second asks once more in a sheet with the entry inside it, then marks the record red and files the answer on it. The list shows the same mark afterwards, so you can see from the top which rows you've already disputed.",
      },
      {
        title: "Then end the sessions that aren't yours",
        body: "The red pill on that page is Log out of Tirbeo, and be clear about its size before you press it: that sheet ends this browser's session, which is the one you're standing in. The machines on the other side of a stolen password are ended on the devices page, one at a time or all together in the picker.",
        href: "/settings/devices/sign-out",
        hrefLabel: "Select devices to log out",
      },
      {
        title: "Change the password, and re-read the list after",
        body: "Set a new password on Password and security, then look at the log and the sign-in records again for anything you answered too quickly. Anything that still doesn't read as yours gets flagged while it's fresh, and the review of the whole account is a page of its own.",
        href: "/settings/security",
        hrefLabel: "Password and security",
      },
    ],
    notes: [
      {
        q: "Is my report sent to anyone?",
        a: "No. Your answer is written onto the record in this browser, which is what lets the list mark the same row red everywhere. It's how you keep track of a dispute, not how a dispute gets investigated.",
      },
      {
        q: "Will the change I made afterwards appear here?",
        a: "Not in this build. Nothing on the edit pages adds a row to this log — what's listed is the record the account came with, and the only thing you write into it is your answer to whether each row was yours.",
      },
      {
        q: "Can I delete an entry?",
        a: "There's no delete on the log, and no need for one at the top of your list: only the thirty most recent changes are kept, so anything older ages out by itself. Clearing the site's data takes the whole log with it, along with everything else stored here.",
      },
    ],
    related: [
      { label: "Activity log", href: "/settings/activity-log" },
      { label: "Login activity", href: "/settings/login-activity" },
      { label: "Saying that wasn't me about a sign-in", href: "/settings/help/sign-in-not-me" },
    ],
  },
];
