"use client";

/* ═══════════════════════════════════════════════════════════════════
   The sign-in landing.

   Login itself lives in the accounts app — this page is only the place
   a signed-out reader lands when the session probe comes back empty.
   It offers the real hand-off when one is configured, and in
   development (where the accounts app isn't running) it says plainly
   what happened instead of looping.
   ═══════════════════════════════════════════════════════════════════ */

import { Button, PILL_BASE, PILL_FILL, cn } from "@/components/ig-ui";

export default function LoginPage() {
  const base = process.env.NEXT_PUBLIC_ACCOUNTS_URL;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 text-center">
      <div className="w-full max-w-[380px]">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">
          Tirbeo <span className="text-muted">MyProfile</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {base
            ? "Sign in to see your profile. You'll come straight back here."
            : "You're signed out. Sign in through the accounts app to load your profile here."}
        </p>

        {base ? (
          <a
            href={`${base.replace(/\/+$/, "")}/login?redirect_to=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.origin : "",
            )}`}
            className={cn(PILL_BASE, PILL_FILL.primary, "mt-6 block py-3.5 text-[15.5px]")}
          >
            <span className="min-w-0">Sign in</span>
          </a>
        ) : (
          <div className="mt-6 rounded-2xl border border-divider bg-surface-2 p-4 text-left">
            <p className="text-[13px] leading-relaxed text-muted">
              Development mode: set{" "}
              <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">NEXT_PUBLIC_ACCOUNTS_URL</code>{" "}
              in <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">.env.local</code> to
              point at the accounts app, or sign in there first and open this site on the same
              origin (localhost) so the session cookie is sent.
            </p>
          </div>
        )}

        <Button variant="ghost" className="mt-3" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    </main>
  );
}
