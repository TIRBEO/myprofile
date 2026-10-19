"use client";

/* ═══════════════════════════════════════════════════════════════════
   An address that isn't a page

   Until now this was Next's built-in 404, which doesn't read globals.css at
   all: a white sheet with black text, dropped into an app whose palette is
   decided by the hour you last looked at it.

   No card, and no apology. It says the one true thing — this address isn't a
   screen — and gives the way back. Inside /settings it is rendered by the
   settings layout, so the account gate is still in front of it: an account
   that is closed gets its lock screen rather than a 404, which is the right
   answer to a wrong address in that state.
   ═══════════════════════════════════════════════════════════════════ */

import { Compass } from "lucide-react";
import { PillButton, PillStack, SettingsPage } from "@/components/settings-shell";
import { Prose, StatementHead, StatementMark } from "@/components/statement";

function Body() {
  return (
    <>
      <StatementHead
        title="There's no page at this address"
        sub="Nothing was deleted to make it empty — this path just isn't one of the screens on your account."
        avatar={false}
        mark={<StatementMark><Compass /></StatementMark>}
      />

      <Prose className="mx-auto mt-1 max-w-[50ch] text-center text-[15px] leading-[1.65] text-muted">
        Every screen is listed on the settings page, and the search in the rail finds one by what
        it's called. If a link in an email brought you here, that link is out of date — write to{" "}
        <a href="mailto:support@tirbeo.com" className="font-medium text-accent-text underline">
          support@tirbeo.com
        </a>{" "}
        and it gets fixed.
      </Prose>

      <PillStack>
        <PillButton label="Back to settings" href="/settings" />
      </PillStack>
    </>
  );
}

/** The one inside /settings: the layout carries the chrome and the gate. */
export function SettingsGone() {
  return (
    <SettingsPage>
      <Body />
    </SettingsPage>
  );
}

/** The one everywhere else in this app — /login, a path with no segment in
    it at all — where there is no layout to borrow a column from. */
export function RootGone() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto w-full max-w-[560px] px-5 pt-6 pb-12 sm:px-6 sm:pt-12">
        <Body />
      </div>
    </div>
  );
}
