"use client";

/* The sign-in card. See `page.tsx` for why the origin arrives as a prop.
   The frame is the accounts AuthShell: black canvas, em-scaled centred
   column, and at PC widths the story-fan and comments-post decorations.
   It is dark for everyone (see `.login-page` in globals.css). */

import { AuthShell, BrandMark, LegalBar, PostComments, StoryFan } from "@/components/auth-shell";
import { useT } from "@/lib/i18n";

export default function LoginShell({ origin }: { origin: string }) {
  const t = useT();
  const raw = process.env.NEXT_PUBLIC_ACCOUNTS_URL;
  const isLoopback = !!raw && /localhost|127\.0\.0\.1/.test(raw);
  // A dirty .env.local baked into a prod build must not put a localhost link
  // on the sign-in page.
  const base = isLoopback && process.env.NODE_ENV === "production"
    ? "https://accounts.tirbeo.com"
    : raw;
  const back = base
    ? `${base.replace(/\/+$/, "")}/login${origin ? `?redirect_to=${encodeURIComponent(origin)}` : ""}`
    : "";

  return (
    <div className="login-page">
      <BrandMark className="page-brand" />
      <StoryFan />
      <PostComments />

      <AuthShell
        title={t("Welcome to Tirbeo")}
        subtitle={t(
          base
            ? "Sign in to see your profile. You'll come straight back here."
            : "You're signed out. Sign in through the accounts app to load your profile here.",
        )}
        footer={
          <button type="button" onClick={() => window.history.back()}>
            {t("Go back")}
          </button>
        }
      >
        {base ? (
          <a href={back} className="login-cta">
            {t("Sign in")}
          </a>
        ) : (
          <p className="form-notice" style={{ textAlign: "left", marginTop: 0 }}>
            Development mode: set{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">NEXT_PUBLIC_ACCOUNTS_URL</code>{" "}
            in <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">.env.local</code> to point at
            the accounts app, or sign in there first and open this site on the same origin (localhost) so
            the session cookie is sent.
          </p>
        )}
      </AuthShell>

      <LegalBar
        links={[
          { label: "About", href: "https://tirbeo.com" },
          { label: "Help", href: "https://tirbeo.com/help" },
        ]}
      />
    </div>
  );
}
