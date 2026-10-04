"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AudioLines, ChevronRight, ImageIcon, Pause, Play, Rewind, Square, X } from "lucide-react";
import {
  Button,
  Chip,
  IconButton,
  cn,
  Disclosure,
  PILL_BASE,
  PILL_FILL,
  Sheet,
  SheetOption,
  useOverlay,
} from "@/components/ig-ui";
import {
  Breadcrumb,
  Helper,
  LinkRow,
  LIVE,
  Panel,
  PillButton,
  PillStack,
  ROW,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { useT } from "@/lib/i18n";
import {
  articleHref,
  figurePaths,
  findArticle,
  moreLikeThis,
  narrationOf,
  type DocArticle,
  type DocFigure,
  type DocStep,
} from "@/lib/docs";
import { formatDate } from "@/lib/dates";
import { RATES, useNarration } from "@/lib/narrate";
import { readVotes, setVote, type DocVote } from "@/lib/docs-feedback";
import { usePrefs } from "@/lib/prefs";
import { haptic } from "@/lib/haptics";
import { onSystemThemeChange, type ResolvedTheme } from "@/lib/theme";

/* ═══════════════════════════════════════════════════════════════════
   One article

   Set like something you read rather than something you fill in. The prose —
   the summary and the steps — sits bare on the black canvas at a measure you
   can follow to the end of the line; only the things that genuinely are
   containers get a panel, which is the questions, the pages this one points
   at, and the related articles at the bottom.

   Every way of consuming the page lives in one toolbar under the byline: hear
   it, choose the voice and the pace, have it scrolled for you, or take the
   pictures out. Four controls that used to be four different shapes — a
   filled pill, an outlined pill, a switch, a bare word — are now one set.

   The steps carry their own order: a numeral beside each one, the same accent
   it turns while the narration is reading it, so hearing "step three" and
   finding step three are the same act.
   ═══════════════════════════════════════════════════════════════════ */

const FIGURE_STORE = "tirbeo:docs";

type FigureChoice = { figures: string };

const FIGURE_DEFAULTS: FigureChoice = { figures: "shown" };

/** How a playback rate is written — 1× is the default, so it gets the word
    instead of the number. */
function rateLabel(rate: number) {
  return rate === 1 ? "Normal" : `${rate}×`;
}

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const t = useT();
  const article = findArticle(params.slug);
  const { values: prefs, set } = usePrefs<FigureChoice>(FIGURE_STORE, FIGURE_DEFAULTS);
  const [votes, setVotes] = useState<Record<string, DocVote> | null>(null);

  useEffect(() => {
    setVotes(readVotes());
  }, []);

  const blocks = useMemo(() => (article ? narrationOf(article) : []), [article]);
  const voice = useNarration(blocks);
  const [open, setOpen] = useState<number[]>([]);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [zoom, setZoom] = useState<{
    paths: { light: string; dark: string };
    alt: string;
    caption: string;
  } | null>(null);

  /* The palette, asked after mount — the server has no <html> to read it
     from, and a second guess would disagree with the one the boot script
     already painted. From here it is a MutationObserver on data-theme, so
     a switch in the settings page lands on the figures in the same frame. */
  const [scheme, setScheme] = useState<ResolvedTheme | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setScheme(root.dataset.theme === "light" ? "light" : "dark");
    read();
    const watch = new MutationObserver(read);
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    const offSystem = onSystemThemeChange(read);
    return () => {
      watch.disconnect();
      offSystem();
    };
  }, []);

  /* Motion preference, also asked after mount, for the same reason. */
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  /* The read-along drift. Off until it is asked for — and pressing play
     asks for it, because a voice reading a page you can't see is half a
     feature. Any real interaction ends it; it never ends itself mid-run
     except at the bottom of the article. */
  const [follow, setFollow] = useState(false);
  useEffect(() => {
    if (voice.playing) setFollow(true);
  }, [voice.playing]);

  useEffect(() => {
    if (!follow) return;
    const stop = () => setFollow(false);
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchmove", stop, opts);
    window.addEventListener("keydown", stop);
    window.addEventListener("pointerdown", stop);
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
    };
  }, [follow]);

  /* While nothing is being spoken, crawl down — about twenty-five pixels a
     second, one pixel at a time so it rides any refresh rate. While a block
     IS being spoken the voice sets the pace and this would only fight it. */
  useEffect(() => {
    if (!follow || reduced || voice.playing) return;
    const tick = () => {
      if (document.hidden) return;
      const y = window.scrollY;
      const bottom = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= bottom - 2) {
        setFollow(false);
        return;
      }
      /* "instant" beats the page's own smooth scroll-behavior — each tick
         starting a fresh smooth animation is exactly the jitter it looks
         like. */
      window.scrollTo({ top: y + 1, behavior: "instant" });
    };
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [follow, reduced, voice.playing]);

  /* A link written before the narrow articles existed can still land on the
     broad one. Answer it, then put the address right so a copy-paste of what
     you're reading is the page you're reading. */
  useEffect(() => {
    if (article && article.slug !== params.slug) router.replace(articleHref(article.slug));
  }, [article, params.slug, router]);

  /* Two things the narration moves the page for: the block being spoken
     comes to the middle of the screen, and a question the narrator reaches
     opens itself and shows its answer — the answer is being read out, so it
     might as well be the thing you're looking at. Both stop the moment the
     reader takes over. */
  useEffect(() => {
    if (!follow || !voice.playing || voice.at < 0) return;
    const id = blocks[voice.at]?.id;
    if (!id) return;
    document
      .querySelector(`[data-narr="${id}"]`)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [voice.at, voice.playing, follow, blocks, reduced]);

  if (!article) {
    return (
      <SettingsPage
        title="Article"
        crumb={<Breadcrumb items={[{ label: t("Documentation"), href: "/settings/help" }]} />}
      >
        <Helper lead tone="warn">
          That article isn&apos;t here. The documentation lists every article this build has.
        </Helper>
        <PillStack>
          <PillButton label={t("Back to documentation")} href="/settings/help" tone="primary" />
        </PillStack>
      </SettingsPage>
    );
  }

  const showFigures = !prefs || prefs.figures !== "hidden";
  const active = voice.at >= 0 ? blocks[voice.at]?.id : null;
  const minutes = readingMinutes(article);
  const hasFigures = article.steps.some((step) => !!step.figure);
  const related = moreLikeThis(article, 6);
  const vote = votes?.[article.slug];

  function ask(index: number) {
    haptic("light");
    setOpen((prev) => (prev.includes(index) ? prev.filter((n) => n !== index) : [...prev, index]));
  }

  return (
    <SettingsPage
      title={article.title}
      crumb={
        /* The section this article belongs to, printed the way the section is
           printed above a help-centre page — small and above the title. It is
           also the way back, so the article needs no second breadcrumb. */
        <Link
          href="/settings/help"
 className="-mt-3 -mb-[4px] inline-flex max-w-full truncate py-3 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase outline-none transition-colors hover:text-fg"
        >
          {article.category}
        </Link>
      }
    >
      {/* The head of the article, set like an article rather than like a form:
          a line of facts, one toolbar that holds every way of consuming the
          page, then the summary as a standfirst — bare prose, because the
          thing you read first shouldn't be the thing inside a box. */}
      <header>
        <p className="text-[12.5px] font-medium text-muted">
          {article.steps.length} {article.steps.length === 1 ? "step" : "steps"}
          {" · about "}
          {minutes} {minutes === 1 ? "minute" : "minutes"}
          {" · checked "}
          {/* Isolated so a right-to-left date keeps its own order inside a
              sentence that runs the other way. */}
          <bdi>{formatDate(article.updated)}</bdi>
        </p>

        {voice.supported || hasFigures || article.steps.length > 1 ? (
          <div className="mt-5 flex flex-wrap items-center gap-1 rounded-[16px] border border-border bg-surface p-1.5">
            {voice.supported ? (
              <>
                <Button
                  variant="primary"
                  className="shrink-0"
                  onClick={() => {
                    haptic("light");
                    if (voice.playing) voice.pause();
                    else voice.play();
                  }}
                  icon={
                    voice.playing ? (
                      <Pause className="size-[16px]" strokeWidth={2.2} />
                    ) : (
                      <Play className="size-[16px]" strokeWidth={2.2} />
                    )
                  }
                >
                  {voice.playing ? t("Pause") : voice.at >= 0 ? t("Continue") : t("Listen")}
                </Button>
                {/* Speed and voice, one tap away and named for what it changes.
                    It used to print the voice's own name here, which on most
                    machines is a string of another language — so the control
                    that only sets the reading read as a language switcher. */}
                <Chip
                  className="min-w-0 max-w-full"
                  onClick={() => {
                    haptic("light");
                    setVoiceSheet(true);
                  }}
                >
                  <AudioLines className="size-[15px] shrink-0 opacity-70" strokeWidth={2} />
                  <span className="truncate">
                    {t("Voice")}
                    <span aria-hidden className="mx-1.5 opacity-50">
                      ·
                    </span>
                    <span className="tabular-nums">{rateLabel(voice.rate)}</span>
                  </span>
                </Chip>
              </>
            ) : null}
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-divider" />
            {/* One idiom for both optional views: pressed or not pressed, the
                same shape. A full switch inside a toolbar made a two-state
                button look like a setting page. */}
            <Chip
              active={follow}
              onClick={() => {
                haptic("light");
                setFollow((prev) => !prev);
              }}
            >
              {t("Read along")}
            </Chip>
            {hasFigures ? (
              <Chip
                active={showFigures}
                onClick={() => {
                  haptic("light");
                  set({ figures: showFigures ? "hidden" : "shown" });
                }}
              >
                <ImageIcon className="size-[15px] shrink-0 opacity-70" strokeWidth={2} />
                {showFigures ? t("Hide pictures") : t("Show pictures")}
              </Chip>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3.5">
          {article.intro.map((line, i) => (
            <p
              key={line}
              data-narr={`intro-${i}`}
              className={cn(
                "max-w-[62ch] leading-[1.65] transition-colors",
                i ? "text-[15px] text-muted" : "text-[16.5px] text-fg/90",
                active === `intro-${i}` && "text-accent-text",
              )}
            >
              {line}
            </p>
          ))}
        </div>
      </header>

      {/* Related comes after the reading, not before it. A strip of chips
          under the summary asks you to leave before you've been told
          anything. */}

      <SectionTitle>{t("How it works")}</SectionTitle>

      {/* The steps as one procedure: hairlines instead of a timeline, and a
          small number that turns blue while it is the block being spoken —
          so hearing "step 03" and looking for it are the same instruction,
          without a disc, a rule, or a wash of colour behind the text. */}
      <ol className="list-none">
        {article.steps.map((step, i) => (
          <StepBlock
            key={step.title}
            n={i + 1}
            total={article.steps.length}
            step={step}
            slug={article.slug}
            scheme={scheme}
            showFigure={showFigures}
            active={active === `step-${i}` || active === `fig-${i}`}
            onZoom={(paths, alt, caption) => setZoom({ paths, alt, caption })}
          />
        ))}
      </ol>

      {article.notes.length ? (
        <Panel
          className="mt-10"
          title={t("Usually asked")}
          sub="The questions this page leaves open, answered here rather than left to a support form."
        >
          {article.notes.map((note, i) => {
            const isOpen = open.includes(i) || active === `note-${i}`;
            return (
              <div key={note.q} id={`q-${i}`} data-narr={`note-${i}`} className="scroll-mt-24">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => ask(i)}
                  className={cn(ROW, LIVE)}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[15px] leading-snug font-medium transition-colors",
                      active === `note-${i}` && "text-accent-text",
                    )}
                  >
                    {note.q}
                  </span>
                  <ChevronRight
                    className={cn(
                      "size-[17px] shrink-0 text-muted transition-transform duration-300",
                      isOpen && "rotate-90",
                    )}
                    strokeWidth={2.2}
                  />
                </button>
                <Disclosure open={isOpen}>
                  <p className="px-4 pb-4.5 text-[14.5px] leading-relaxed text-muted sm:px-5">
                    {note.a}
                  </p>
                </Disclosure>
              </div>
            );
          })}
        </Panel>
      ) : null}

      {/* One bordered strip: the question and the two answers in the same
          container, so it reads as one thing being asked rather than a
          sentence with two unrelated buttons after it. */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3.5 sm:px-5">
        <p className="text-[14.5px] font-medium">
          {vote
            ? vote === "yes"
              ? t("Noted — thank you.")
              : t("Noted. Sorry it didn't land.")
            : t("Was this helpful?")}
        </p>
        {vote ? (
          <Chip
            className="text-muted hover:text-fg"
            onClick={() => {
              haptic("light");
              setVotes(setVote(article.slug, vote));
            }}
          >
            {t("Change")}
          </Chip>
        ) : (
          <div className="flex items-center gap-2">
            {(["yes", "no"] as DocVote[]).map((answer) => (
              <Chip
                key={answer}
                onClick={() => {
                  haptic("light");
                  setVotes(setVote(article.slug, answer));
                }}
              >
                {answer === "yes" ? t("Yes") : t("No")}
              </Chip>
            ))}
          </div>
        )}
      </div>
      {vote === "no" ? (
        <Helper className="mt-2.5">
          Nothing is sent anywhere by this answer, so it changes nothing on its own. If a step here
          doesn&apos;t match your screen,{" "}
          <Link
            href={`/settings/help/support?from=article:${article.slug}`}
            className="font-semibold text-link underline-offset-2 hover:underline"
          >
            write it down
          </Link>
          .
        </Helper>
      ) : null}

      {article.related.length ? (
        <Panel className="mt-10" title={t("Where this is done")}>
          {article.related.map((row) => (
            <LinkRow key={row.href} href={row.href} title={t(row.label)} />
          ))}
        </Panel>
      ) : null}

      {related.length ? (
        <Panel
          className="mt-10"
          title={t("Related")}
          sub="Other articles that cover the part of this one the steps don't."
        >
          {related.map((row) => (
            <LinkRow
              key={row.slug}
              href={articleHref(row.slug)}
              title={row.title}
              sub={row.sub}
            />
          ))}
        </Panel>
      ) : null}

      <PillStack>
        <PillButton
          label={t("Write to support")}
          href={`/settings/help/support?from=article:${article.slug}`}
          tone="primary"
        />
        <PillButton label={t("Back to documentation")} href="/settings/help" tone="outline" />
      </PillStack>

      <Helper className="mt-8">
        This text describes this build, which has no server. If a step here doesn&apos;t match what
        you&apos;re seeing, that&apos;s a bug in the writing — say so under Write to support.
      </Helper>

      {/* While it is reading, the controls leave the text and float at the
          bottom of the screen: a page you scroll shouldn't lose its play
          button off the top. */}
      {voice.at >= 0 ? (
        <>
          <div aria-hidden className="h-24" />
          <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pb-5">
            <div className="mx-auto flex max-w-[520px] items-center gap-1.5 rounded-full border border-border bg-surface-3/95 py-1.5 pr-2 pl-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.35)] backdrop-blur-md">
              <IconButton
                label={t("Back a part")}
                onClick={() => {
                  haptic("light");
                  voice.rewind();
                }}
                icon={<Rewind className="size-[19px]" strokeWidth={2} />}
              />
              <IconButton
                label={voice.playing ? t("Pause") : t("Continue")}
                onClick={() => {
                  haptic("light");
                  if (voice.playing) voice.pause();
                  else voice.play();
                }}
                className="size-11 bg-accent text-white hover:brightness-110 active:brightness-95 hover:text-fg"
                icon={
                  voice.playing ? (
                    <Pause className="size-[19px]" strokeWidth={2.4} />
                  ) : (
                    <Play className="size-[19px] translate-x-[1px]" strokeWidth={2.4} />
                  )
                }
              />
              <span className="min-w-0 flex-1 px-1 text-center text-[12.5px] tabular-nums text-muted">
                {voice.at + 1} / {blocks.length}
              </span>
              <IconButton
                label={t("Voice and speed")}
                onClick={() => {
                  haptic("light");
                  setVoiceSheet(true);
                }}
                icon={<AudioLines className="size-[19px]" strokeWidth={2} />}
              />
              <IconButton
                label={t("Stop")}
                onClick={() => {
                  haptic("light");
                  voice.stop();
                }}
                className="text-muted hover:text-fg"
                icon={<Square className="size-[15px]" strokeWidth={2.2} fill="currentColor" />}
              />
            </div>
          </div>
        </>
      ) : null}

      {voiceSheet ? (
        <Sheet
          title="Voice and speed"
          description="The reading is English, so only this browser's English voices are listed, best one first. The choice is kept on this device."
          onClose={() => setVoiceSheet(false)}
        >
          <div className="px-4 pb-2 sm:px-5">
            <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
              {t("Voice")}
            </p>
          </div>
          <div role="radiogroup" aria-label={t("Voice")} className="grouped list-divide">
            {voice.voices.length ? (
              voice.voices.slice(0, 8).map((option) => (
                <SheetOption
                  key={option.name}
                  selected={option.name === voice.voiceName}
                  onClick={() => voice.chooseVoice(option.name)}
                >
                  {option.name}
                </SheetOption>
              ))
            ) : (
              <p className="px-4 py-4 text-[14px] text-muted sm:px-5">
                This browser hasn&apos;t given up any English voices yet — the reading still works
                with whatever English voice it has, which it may not have announced.
              </p>
            )}
          </div>
          <p className="mt-7 mb-1.5 px-4 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase sm:px-5">
            {t("Speed")}
          </p>
          <div role="radiogroup" aria-label={t("Speed")} className="grouped list-divide">
            {RATES.map((rate) => (
              <SheetOption
                key={rate}
                selected={rate === voice.rate}
                onClick={() => voice.chooseRate(rate)}
              >
                {rateLabel(rate)}
              </SheetOption>
            ))}
          </div>
        </Sheet>
      ) : null}

      {zoom ? (
        <FigureViewer
          paths={zoom.paths}
          alt={zoom.alt}
          caption={zoom.caption}
          scheme={scheme}
          onClose={() => setZoom(null)}
        />
      ) : null}
    </SettingsPage>
  );
}

/** One step of the procedure. The number is the thing that carries the order,
    so it gets a shape of its own rather than a line of small caps above the
    heading — and it turns accent-coloured while that step is the one being
    spoken, so hearing "step three" and finding it are the same act. */
function StepBlock({
  n,
  total,
  step,
  slug,
  scheme,
  showFigure,
  active,
  onZoom,
}: {
  n: number;
  total: number;
  step: DocStep;
  slug: string;
  scheme: ResolvedTheme | null;
  showFigure: boolean;
  active: boolean;
  onZoom: (paths: { light: string; dark: string }, alt: string, caption: string) => void;
}) {
  const paths = figurePaths(slug, n);
  return (
    <li
      data-narr={`step-${n - 1}`}
      className={cn(
        "flex gap-4 border-t border-divider py-7 first:border-t-0 first:pt-1",
        n === total && "last:pb-1",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-[13.5px] font-bold tabular-nums transition-colors",
          active ? "bg-accent text-accent-fg" : "bg-surface-3 text-fg",
        )}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[18.5px] leading-snug font-bold tracking-[-0.02em]">{step.title}</h3>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.65] text-muted">{step.body}</p>
        {step.href ? (
          <Link
            href={step.href}
            onClick={() => haptic("light")}
            className={cn(PILL_BASE, PILL_FILL.outline, "mt-4 sm:max-w-[320px]")}
          >
            Open {step.hrefLabel ?? "the page"}
          </Link>
        ) : null}
        {step.figure && showFigure ? (
          <Figure
            figure={step.figure}
            paths={paths}
            scheme={scheme}
            label={`${step.title} — step ${n}`}
            narr={`fig-${n - 1}`}
            onZoom={onZoom}
          />
        ) : null}
      </div>
    </li>
  );
}

function Figure({
  figure,
  paths,
  scheme,
  label,
  narr,
  onZoom,
}: {
  figure: DocFigure;
  paths: { light: string; dark: string };
  scheme: ResolvedTheme | null;
  label: string;
  narr: string;
  onZoom: (paths: { light: string; dark: string }, alt: string, caption: string) => void;
}) {
  /* The capture script can fail for the one file this palette uses; the
     other half has its own file and its own chance of landing. */
  const [gone, setGone] = useState(false);

  /* The attributes below are what the capture script reads: it walks the
     rendered articles, so a step's picture and the screen it describes can
     never drift apart. */
  return (
    <figure
      className="mt-4"
      data-doc-figure
      data-narr={narr}
      data-route={figure.route}
      data-target={figure.target ?? ""}
      data-index={figure.index ?? 0}
      data-side={figure.side ?? "right"}
      data-prep={figure.prep ?? ""}
      data-out={paths.light}
    >
      {/* The one place the article keeps a panel: a screenshot is a picture
          of a screen, and the surface behind it says so. ONE file — the one
          that matches the palette being read, picked from the real theme
          rather than two stacked and hidden by CSS. */}
      {gone || !scheme ? (
        gone ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[13px] text-muted">
            The picture for this step didn&apos;t come through — the words above are the whole
            instruction.
          </p>
        ) : null
      ) : (
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onZoom(paths, label, figure.caption ?? "");
          }}
          aria-label={`Open the picture for ${label} full size`}
          className="block w-full overflow-hidden rounded-2xl border border-border bg-surface text-left outline-none transition-colors hover:border-border/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="block max-h-[340px] overflow-hidden sm:max-h-[420px]">
            <img
              src={scheme === "light" ? paths.light : paths.dark}
              alt=""
              className="block max-h-[340px] w-full object-contain object-top sm:max-h-[420px]"
              onError={() => setGone(true)}
            />
          </span>
          {figure.caption ? (
            <span className="block border-t border-divider px-3.5 py-2.5 text-[13px] leading-relaxed text-muted">
              {figure.caption}
            </span>
          ) : null}
        </button>
      )}
    </figure>
  );
}

/** Full-size, on the reader's terms: the backdrop, Escape or the cross all
    close it, and the caption comes along so the picture means the same thing
    enlarged as it did in the step. */
function FigureViewer({
  paths,
  alt,
  caption,
  scheme,
  onClose,
}: {
  paths: { light: string; dark: string };
  alt: string;
  caption: string;
  scheme: ResolvedTheme | null;
  onClose: () => void;
}) {
  useOverlay(onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/80 p-4 sm:p-8"
    >
      <figure
        onClick={(event) => event.stopPropagation()}
        className="max-h-full w-full max-w-[860px] overflow-auto rounded-2xl border border-border bg-surface p-3"
      >
        {/* The same single rule as the step: the palette you're reading in. */}
        {scheme ? (
          <img
            src={scheme === "light" ? paths.light : paths.dark}
            alt={alt}
            className="block w-full rounded-lg"
          />
        ) : null}
        {caption ? (
          <figcaption className="mt-3 px-1 pb-1 text-[13px] leading-relaxed text-muted">
            {caption}
          </figcaption>
        ) : null}
      </figure>
      <IconButton
        label="Close the picture"
        onClick={onClose}
        className="absolute top-4 right-4 bg-surface-3 hover:bg-surface-3/80"
        icon={<X className="size-5" strokeWidth={2} />}
      />
    </div>
  );
}

/** Words over two hundred a minute — the rate the reading is meant to be done
    at, and the reason the narrator exists for anyone who'd rather not. */
function readingMinutes(article: DocArticle): number {
  const text = [
    ...article.intro,
    ...article.steps.map((step) => `${step.title} ${step.body} ${step.figure?.caption ?? ""}`),
    ...article.notes.map((note) => `${note.q} ${note.a}`),
  ].join(" ");
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}
