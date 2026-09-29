"use client";

/* ═══════════════════════════════════════════════════════════════════
   The one layout for "here is something that happened to your account"

   A record page used to print its facts as a form — label on the left, value
   on the right, six rows deep. That reads fast and explains nothing, and on a
   page whose whole job is to tell you what happened, the reading is the point.
   So these pages are built the way the account-status screens are: the face
   and the headline up the middle, then the sentences underneath, one section
   per question, each behind a hairline.

   Nothing here is a card. The dividers do the grouping, which is what lets
   the paragraphs sit at the size they'd be printed in a book rather than
   inside a box with padding.
   ═══════════════════════════════════════════════════════════════════ */

import { cn } from "@/components/ig-ui";
import { ProfilePicture } from "@/components/profile-picture";
import { useT } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";

/** The square a record leads with, where the page is about a thing rather
    than about you — a machine, a sign-in, a change. Same footprint as the
    face it replaces, so the headline lands at the same height either way.
    The glyph inside is drawn by the caller at list size and scaled up here,
    which is what keeps one icon map per kind instead of two.
    It is the page's own black with a hairline round it, never a coloured
    slab: a record being the machine you're reading it on is already said by
    the sentence under the headline. Only a bad record tints, and then only
    the glyph. */
export function StatementMark({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[92px] shrink-0 place-items-center rounded-[28px] bg-bg shadow-[0_0_0_1px_var(--border)] [&>svg]:size-11",
        danger ? "text-danger-text" : "text-fg",
      )}
    >
      {children}
    </span>
  );
}

/** The face, the headline, the one-line explanation and the date. Centred,
    because this part is a statement rather than a form to fill in. */
export function StatementHead({
  title,
  sub,
  meta,
  avatar = true,
  mark,
  hero,
  className,
}: {
  title: string;
  sub?: React.ReactNode;
  /** The dated line under it — "Suspended on 19 January 2025". */
  meta?: React.ReactNode;
  /** Off where the page already has a picture of its own to put up top. */
  avatar?: boolean;
  /** Something other than the face up top — the ringed tick a screen carries
      when the thing it's announcing happened to the account itself. */
  mark?: React.ReactNode;
  hero?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const profile = useProfile();
  return (
    <header className={cn("flex flex-col items-center px-1 pt-4 pb-5 text-center", className)}>
      {mark ??
        (avatar && profile ? (
          <ProfilePicture
            photo={profile.photo}
            seed={profile.username}
            name={profile.name}
            size={92}
            className="shadow-[0_0_0_1px_var(--border)]"
          />
        ) : null)}

      <h1 className="mt-5 max-w-[18ch] text-[27px] leading-[1.15] font-bold tracking-[-0.03em] text-balance sm:mt-6 sm:text-[31px]">
        {t(title)}
      </h1>

      {sub ? <p className="mt-2.5 max-w-[46ch] text-[15px] leading-[1.5] text-fg/85">{sub}</p> : null}
      {meta ? <p className="mt-2 max-w-[46ch] text-[13.5px] text-muted">{meta}</p> : null}

      {hero ? <div className="mt-5 w-full max-w-[420px]">{hero}</div> : null}
    </header>
  );
}

/** One question, answered. The label is the question the reader is actually
    asking at that point — why, what it means, what to do — and the answer is
    ordinary paragraphs under it. */
export function StatementSection({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <section className={cn("border-t border-divider pt-4", className)}>
      <h2 className="text-[16.5px] font-bold tracking-[-0.02em]">{t(label)}</h2>
      <div className="mt-2 flex flex-col gap-3 text-[15px] leading-[1.65] text-muted">
        {children}
      </div>
    </section>
  );
}

/** A paragraph of the statement, kept to a measure you can actually follow to
    the end. Values go inside the sentence rather than beside a label, so the
    one thing a reader came for — what this means for them — is in the first
    clause rather than the right-hand column. */
export function Prose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("max-w-[58ch] break-words", className)}>{children}</p>;
}

/** A value inside a sentence, set just far enough apart from the prose to be
    found without being shouted. `bdi` so an address or an email in another
    script can't drag the direction of the whole line with it. */
export function Value({ children }: { children: React.ReactNode }) {
  return <bdi className="font-medium text-fg/90">{children}</bdi>;
}

/** The sections, spaced. A page writes its answers; this carries the gaps —
    one line of air above each hairline, and the section itself decides how
    much sits under it. Anything more turns a page of answers into a page of
    headings floating in the dark. */
export function StatementBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}
