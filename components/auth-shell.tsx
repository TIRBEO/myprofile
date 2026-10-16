"use client";

import type { ReactNode } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/components/ig-ui";
import { useT } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════
   The auth shell — the accounts app's sign-in frame, ported.

   A bare em-scaled column (.login-card) on the charcoal canvas, the
   wordmark pinned top-left, and at PC widths the login mode carries
   two decorations: a fan of story previews on the left and a post
   with a live comments feed on the right. All purely illustrative —
   aria-hidden, no links, nothing clickable. Styling lives in
   globals.css under `.login-page`; nothing here works outside it.
   ═══════════════════════════════════════════════════════════════════ */

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo-white.webp"
      alt="Tirbeo"
      width={600}
      height={200}
      decoding="async"
      className={cn("h-[30px] w-auto object-contain", className)}
    />
  );
}

/** The login card: heading, sub-line, the form column, and whatever
    footer row the page brings. `mode` marks the card for the wide-screen
    decoration queries (`:has(.mode-login)`). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
  mode = "login",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  mode?: "login";
}) {
  return (
    <div className={cn("login-card animate-fade-in", `mode-${mode}`)} data-wide={wide || undefined}>
      <header className="login-head">
        {title ? <h1 className="tb-heading mt-0">{title}</h1> : null}
        {subtitle ? <p className="tb-sub mt-[0.7em]">{subtitle}</p> : null}
      </header>
      <div className="login-form">
        {children}
        {footer ? <p className="login-terms">{footer}</p> : null}
      </div>
    </div>
  );
}

/* Login (wide screens only): an Instagram-style fan of three story
   previews on the left, and a post with a continuously scrolling
   comments feed on the right. */
export function StoryFan() {
  return (
    <div className="story-fan" aria-hidden="true">
      <figure className="fan-card fan-card--left">
        <img src="/girlinlake.jpg" alt="" loading="lazy" />
        <span className="fan-bars"><i className="on" /><i /><i /></span>
      </figure>
      <figure className="fan-card fan-card--right">
        <img src="/waterfall1.jpg" alt="" loading="lazy" />
        <span className="fan-bars"><i className="on" /><i /><i /></span>
      </figure>
      <figure className="fan-card fan-card--center">
        <img src="/maninfog.jpg" alt="" loading="lazy" />
        <span className="fan-bars"><i className="on" /><i /><i /></span>
        <span className="fan-foot">
          <span className="fan-reply" />
          <Heart size={19} strokeWidth={2} />
        </span>
      </figure>
      <span className="fan-love"><Heart size={30} fill="currentColor" strokeWidth={0} /></span>
    </div>
  );
}

const PC_COMMENTS: [string, string][] = [
  ["madhav.k", "This lake at sunrise is unreal."],
  ["priya.t", "Adding boating here to my list right now."],
  ["nikesh_", "Taken last week — the water is even deeper."],
  ["anisha.travels", "Nepal never misses."],
  ["budha.s", "Which trail do you recommend first?"],
  ["muna.vlogs", "Saved for my next Pokhara trip."],
];

export function PostComments() {
  return (
    <div className="pc-side" aria-hidden="true">
      <figure className="rail-card rail-post">
        <figcaption className="rail-head">
          <span className="rail-ring"><img src="/lake1.jpg" alt="" loading="lazy" /></span>
          <span className="rail-head-txt">
            <span className="rail-user">
              sagar.ko
              <img src="/bluetick.png" alt="" className="rail-tick" loading="lazy" />
            </span>
            <span className="rail-sub">Phewa Lake · 4 shared trails</span>
          </span>
          <span className="rail-time">1h</span>
        </figcaption>
        <img className="rail-photo" src="/lake1.jpg" alt="" loading="lazy" />
        <div className="pc-comments">
          <div className="pc-track">
            {[...PC_COMMENTS, ...PC_COMMENTS].map(([u, c], i) => (
              <p key={i}><b>{u}</b> {c}</p>
            ))}
          </div>
        </div>
      </figure>
    </div>
  );
}

/** The muted footer row: links over a language/copyright line. */
export function LegalBar({ links }: { links: { label: string; href: string }[] }) {
  const t = useT();
  return (
    <footer className="legal-bar">
      <nav className="legal-links" aria-label="Footer">
        {links.map((link) => (
          <a key={link.href} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {t(link.label)}
          </a>
        ))}
      </nav>
      <p className="legal-meta">
        <span>{t("English")}</span>
        <span aria-hidden="true">·</span>
        <span>© 2026 Tirbeo</span>
      </p>
    </footer>
  );
}
