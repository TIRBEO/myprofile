"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  Command,
  Compass,
  Download,
  Fingerprint,
  Globe,
  Grid3X3,
  Heart,
  Home,
  KeyRound,
  Lock,
  MessageCircle,
  Monitor,
  Palette,
  Plug,
  PlusSquare,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Tirbeo landing — an Instagram-style surface:
   app bar with DM/heart, profile header with stats, story
   highlights, tabbed square-grid of posts, and a 5-icon tab bar.
   ═══════════════════════════════════════════════════════════════ */

/* ── Reveal on scroll ───────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ── App icon — IG-camera-style gradient glyph ──────────────── */
function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <span
      className="ig-gradient flex shrink-0 items-center justify-center rounded-[26%] text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="flex items-center justify-center rounded-[30%] border-[2.5px] border-white"
        style={{ width: "62%", height: "62%" }}
      >
        <span className="size-[38%] rounded-full border-[2.5px] border-white" />
        <span className="-mt-[70%] ml-[70%] size-[14%] rounded-full bg-white" />
      </span>
    </span>
  );
}

/* ── Story highlight bubble ─────────────────────────────────── */
function StoryBubble({
  label,
  icon: Icon,
  you = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  you?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
      aria-label={label}
    >
      <div className="story-ring size-[70px]">
        <div className="relative flex size-full items-center justify-center border-2 border-bg bg-card text-fg">
          <Icon className="size-[34%]" />
          {you ? (
            <span className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full border-2 border-bg bg-accent text-white">
              <PlusSquare className="size-3" strokeWidth={3} />
            </span>
          ) : null}
        </div>
      </div>
      <span className="w-full truncate text-center text-[11.5px]">{label}</span>
    </button>
  );
}

/* ── Landing data ───────────────────────────────────────────── */
const HIGHLIGHTS = [
  { label: "Your setup", icon: PlusSquare, you: true },
  { label: "Profile", icon: User },
  { label: "Security", icon: ShieldCheck },
  { label: "Passkeys", icon: Fingerprint },
  { label: "Privacy", icon: Lock },
  { label: "Devices", icon: Monitor },
  { label: "Data", icon: Download },
];

const POSTS = [
  {
    icon: User,
    title: "Profile, perfected",
    body: "Live preview, drag-to-zoom photo editor, validation on every field. Your profile is the first thing people see — make it count.",
    likes: "12,428",
    comments: 214,
    tint: "user",
  },
  {
    icon: Palette,
    title: "Themes that follow you",
    body: "Dark and light, or let System match your device. True black that's easy on the eyes and kind to your battery.",
    likes: "48,113",
    comments: 905,
    tint: "palette",
  },
  {
    icon: ShieldCheck,
    title: "Security checkup",
    body: "Change it, review it, keep it strong. A full pass on every sign-in signal.",
    likes: "31,207",
    comments: 412,
    tint: "shield",
  },
  {
    icon: KeyRound,
    title: "Two-factor & passkeys",
    body: "Codes via app or SMS — or drop the password entirely with fingerprint or face.",
    likes: "22,954",
    comments: 331,
    tint: "key",
  },
  {
    icon: Monitor,
    title: "Session clarity",
    body: "Every device and login, endable in one tap. Know exactly where you're signed in.",
    likes: "21,746",
    comments: 289,
    tint: "monitor",
  },
  {
    icon: Download,
    title: "Your data, exported",
    body: "Everything we know about you, in one archive you can download any time.",
    likes: "17,502",
    comments: 197,
    tint: "download",
  },
  {
    icon: Globe,
    title: "In your language",
    body: "Multilingual UI that respects device preferences and how you actually type.",
    likes: "6,203",
    comments: 84,
    tint: "globe",
  },
  {
    icon: Plug,
    title: "Connected apps",
    body: "See every third-party grant and revoke it instantly. No ghost permissions.",
    likes: "9,871",
    comments: 143,
    tint: "plug",
  },
  {
    icon: Zap,
    title: "Fast and quiet",
    body: "Instant interactions, reduced-motion friendly, zero spinner theatre.",
    likes: "15,908",
    comments: 266,
    tint: "zap",
  },
];

/* Per-post gradient skins so the grid reads like a real feed */
const TINTS: Record<string, string> = {
  user: "linear-gradient(135deg,#f09433,#dc2743)",
  palette: "linear-gradient(135deg,#bc1888,#7b2ff7)",
  shield: "linear-gradient(135deg,#0a84ff,#5e5ce6)",
  key: "linear-gradient(135deg,#30d158,#0a84ff)",
  monitor: "linear-gradient(135deg,#5e5ce6,#bf5af2)",
  download: "linear-gradient(135deg,#ff9f0a,#ff375f)",
  globe: "linear-gradient(135deg,#64d2ff,#0a84ff)",
  plug: "linear-gradient(135deg,#ff375f,#bc1888)",
  zap: "linear-gradient(135deg,#ffd60a,#ff9f0a)",
};

const SECURITY = [
  { icon: ShieldCheck, title: "Password and security", sub: "Change it, review it, keep it strong." },
  { icon: KeyRound, title: "Two-factor authentication", sub: "Codes via app or SMS — your call." },
  { icon: Fingerprint, title: "Passkeys", sub: "Fingerprint or face. No password to leak." },
  { icon: Monitor, title: "Login activity", sub: "Full history of every sign-in attempt." },
];

const CONTROL = [
  { icon: Download, title: "Download your data", sub: "Everything we know, in one archive." },
  { icon: Plug, title: "Connected apps", sub: "Revoke third-party access instantly." },
  { icon: Lock, title: "Data permissions", sub: "Precise control per feature." },
  { icon: Trash2, title: "Delete account", sub: "A real delete, with cooling-off." },
];

const FAQS = [
  {
    q: "Is Tirbeo free to use?",
    a: "Yes. Every settings and privacy feature on this page is included free — no tiers, no locked toggles.",
  },
  {
    q: "Where is my data stored?",
    a: "Your profile lives on your device first. Sync is opt-in, and you can export or delete everything at any time from Your data.",
  },
  {
    q: "Can I use a passkey instead of a password?",
    a: "Absolutely. Passkeys work alongside two-factor authentication, and you can enroll several devices.",
  },
  {
    q: "What happens if I delete my account?",
    a: "Your account enters a 30-day cooling-off period. Nothing is permanently removed until it ends.",
  },
];

/* ── A single IG-style post (used in the "feed" section) ────── */
function PostCard({
  post,
}: {
  post: (typeof POSTS)[number];
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const { icon: Icon } = post;

  return (
    <article className="overflow-hidden border-b border-divider pb-4 sm:rounded-xl sm:border sm:border-divider sm:bg-card sm:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: TINTS[post.tint] }}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] leading-tight font-semibold">tirbeo</p>
          <p className="truncate text-[11.5px] text-muted">Original · Settings</p>
        </div>
        <Command className="size-5 shrink-0 text-muted" aria-hidden />
      </div>

      {/* Visual */}
      <button
        type="button"
        onDoubleClick={() => setLiked(true)}
        aria-label={post.title}
        className="relative block aspect-[4/3] w-full overflow-hidden"
        style={{ background: TINTS[post.tint] }}
      >
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon className="size-16 text-white/90" strokeWidth={1.5} />
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 pt-10 pb-3 text-left">
          <span className="text-[16px] font-bold text-white">{post.title}</span>
        </span>
      </button>

      {/* Action row */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          type="button"
          onClick={() => setLiked(!liked)}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className="transition-transform active:scale-90"
        >
          <Heart
            className={`size-6 ${liked ? "scale-110 text-danger" : "text-fg"}`}
            fill={liked ? "currentColor" : "none"}
          />
        </button>
        <MessageCircle className="size-6 -scale-x-100 text-fg" aria-hidden />
        <Send className="size-6 text-fg" aria-hidden />
        <button
          type="button"
          onClick={() => setSaved(!saved)}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save"}
          className="ml-auto transition-transform active:scale-90"
        >
          <Bookmark className={`size-6 ${saved ? "text-fg" : "text-fg"}`} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pt-2">
        <p className="text-[13px] font-semibold tabular">
          {liked ? addLike(post.likes) : post.likes} likes
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed">
          <span className="font-semibold">tirbeo</span>{" "}
          <span className="text-muted">{post.body}</span>
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          View all {post.comments} comments
        </p>
      </div>
    </article>
  );
}

function addLike(likes: string) {
  const n = parseInt(likes.replace(/,/g, ""), 10) + 1;
  return n.toLocaleString("en-US");
}

/* ── Grid tile for the profile tabbed grid ──────────────────── */
function GridTile({ post }: { post: (typeof POSTS)[number] }) {
  const { icon: Icon } = post;
  return (
    <a
      href="#feed"
      className="group relative block aspect-square overflow-hidden"
      style={{ background: TINTS[post.tint] }}
      aria-label={post.title}
    >
      <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
        <Icon className="size-8 text-white/90" strokeWidth={1.6} />
      </span>
      <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Heart className="size-4 text-white" fill="currentColor" />
        <span className="text-[12px] font-bold text-white tabular">{post.likes}</span>
        <MessageCircle className="ml-2 size-4 -scale-x-100 text-white" fill="currentColor" />
        <span className="text-[12px] font-bold text-white tabular">{post.comments}</span>
      </span>
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [tab, setTab] = useState<"posts" | "tagged">("posts");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh">
      {/* ── Top app bar — IG style ─────────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
          scrolled ? "border-divider bg-bg/85 backdrop-blur" : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[60px] max-w-[935px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Tirbeo home">
            <AppIcon />
            <span className="text-[21px] font-bold tracking-tight max-sm:hidden">
              Tirbeo
            </span>
          </Link>

          {/* Search pill (desktop) */}
          <div className="mx-auto hidden w-56 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13.5px] text-muted md:flex">
            <Search className="size-4" />
            <span>Search</span>
          </div>

          <div className="ml-auto flex items-center gap-5 max-md:gap-4">
            <Link href="/" aria-label="Home" className="text-fg transition-opacity hover:opacity-60">
              <Home className="size-6" />
            </Link>
            <a href="#feed" aria-label="Notifications" className="text-fg transition-opacity hover:opacity-60">
              <Heart className="size-6" />
            </a>
            <a href="#feed" aria-label="Messages" className="text-fg transition-opacity hover:opacity-60 max-sm:hidden">
              <Send className="size-6" />
            </a>
            <a href="#feed" aria-label="Explore" className="text-fg transition-opacity hover:opacity-60 max-lg:hidden">
              <Compass className="size-6" />
            </a>
            <Link
              href="/settings"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Open app
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Profile header — IG account view ───────────────── */}
      <section className="pt-[84px] pb-2">
        <div className="mx-auto max-w-[935px] px-4 sm:px-6">
          <div className="flex items-start gap-8 max-sm:gap-5 sm:pt-6">
            {/* Avatar with story ring */}
            <div className="story-ring size-[86px] shrink-0 sm:size-[150px]">
              <div className="flex size-full items-center justify-center bg-card text-muted">
                <User className="size-10 sm:size-16" strokeWidth={1.4} />
              </div>
            </div>

            <div className="min-w-0 flex-1 pt-1">
              {/* Username row */}
              <div className="flex flex-wrap items-center gap-3 max-sm:justify-center">
                <h1 className="text-[22px] leading-tight font-normal sm:text-[24px]">
                  tirbeo
                </h1>
                <Link
                  href="/settings"
                  className="text-[13px] font-semibold text-accent transition-opacity hover:opacity-80 sm:hidden"
                >
                  Open app
                </Link>
                <Settings className="size-5 text-muted max-sm:hidden" aria-hidden />
              </div>

              {/* Stats row */}
              <ul className="mt-5 hidden gap-10 text-[15px] sm:flex">
                {[
                  ["25", "posts"],
                  ["12.8k", "followers"],
                  ["184", "following"],
                ].map(([n, l]) => (
                  <li key={l}>
                    <b className="font-semibold tabular">{n}</b>{" "}
                    <span className="text-fg">{l}</span>
                  </li>
                ))}
              </ul>

              {/* Bio */}
              <div className="mt-5 text-[14px] leading-relaxed max-sm:text-center">
                <p className="font-semibold">Your account, under your control</p>
                <p className="mt-0.5 text-muted">
                  Profile · Security · Privacy · Data — everything in one calm place.
                  No tiers, no dark patterns.
                </p>
                <a
                  href="https://tirbeo.app"
                  className="text-link font-semibold"
                  target="_blank"
                  rel="noreferrer"
                >
                  tirbeo.app
                </a>
              </div>
            </div>
          </div>

          {/* Mobile stats — under bio like IG mobile */}
          <ul className="mt-5 flex justify-around border-y border-divider py-3 text-center text-[13px] sm:hidden">
            {[
              ["25", "posts"],
              ["12.8k", "followers"],
              ["184", "following"],
            ].map(([n, l]) => (
              <li key={l} className="flex-1">
                <b className="block font-semibold tabular">{n}</b>
                <span className="text-muted">{l}</span>
              </li>
            ))}
          </ul>

          {/* Story highlights */}
          <div className="scrollbar-none mt-6 flex gap-4 overflow-x-auto pb-2 sm:justify-center">
            {HIGHLIGHTS.map((h) => (
              <StoryBubble key={h.label} {...h} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Tabbed grid — profile posts ────────────────────── */}
      <section className="border-t border-divider">
        <div className="mx-auto max-w-[935px]">
          <div className="flex justify-center gap-12" role="tablist" aria-label="Profile content">
            {(
              [
                ["posts", Grid3X3, "POSTS"],
                ["tagged", Tag, "TAGGED"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mt-px flex items-center gap-1.5 border-t py-3.5 text-[11px] font-semibold tracking-[0.08em] transition-colors ${
                  tab === id
                    ? "border-fg text-fg"
                    : "border-transparent text-muted hover:text-fg"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="max-sm:hidden">{label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-0.5 sm:gap-1" role="tabpanel">
            {(tab === "posts" ? POSTS : [...POSTS].reverse()).map((p) => (
              <GridTile key={p.title} post={p} />
            ))}
            {tab === "tagged" ? (
              <div className="col-span-3 flex flex-col items-center px-6 py-16 text-center">
                <Tag className="size-12 text-muted" strokeWidth={1} />
                <p className="mt-4 text-[19px] font-bold">Photos of you</p>
                <p className="mt-1 max-w-xs text-[13.5px] text-muted">
                  When people tag you in their settings setups, they'll appear here.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Feed — full IG post cards ──────────────────────── */}
      <section id="feed" className="scroll-mt-20 py-14 max-lg:py-10">
        <div className="mx-auto max-w-[935px] px-4 sm:px-6">
          <Reveal className="mb-8 text-center">
            <h2 className="text-[24px] font-bold tracking-tight max-md:text-[21px]">
              The feed
            </h2>
            <p className="mt-1.5 text-[14px] text-muted">
              Every part of the dashboard, framed the way you'd scroll it. Double-tap to like.
            </p>
          </Reveal>
          <div className="mx-auto grid max-w-[470px] gap-6 lg:max-w-none lg:grid-cols-2 lg:gap-x-24 lg:gap-y-10">
            {POSTS.slice(0, 4).map((p, i) => (
              <Reveal key={p.title} delay={i * 60}>
                <PostCard post={p} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security — explore-style cards ─────────────────── */}
      <section id="security" className="scroll-mt-20 py-14 max-lg:py-10">
        <div className="mx-auto max-w-[935px] px-4 sm:px-6">
          <Reveal>
            <div className="mb-8 flex items-center justify-between border-b border-divider pb-4">
              <h2 className="text-[24px] font-bold tracking-tight max-md:text-[21px]">
                Security
              </h2>
              <Link
                href="/settings/security"
                className="text-link flex items-center gap-1.5 text-[13px] font-semibold"
              >
                Open in app
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map(({ icon: Icon, title, sub }, i) => (
              <Reveal key={title} delay={i * 70}>
                <div className="flex h-full items-start gap-4 rounded-xl border border-divider bg-card p-5 transition-colors hover:border-accent/40">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold">{title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{sub}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Your data ──────────────────────────────────────── */}
      <section id="control" className="scroll-mt-20 py-14 max-lg:py-10">
        <div className="mx-auto max-w-[935px] px-4 sm:px-6">
          <Reveal className="mb-8">
            <h2 className="text-[24px] font-bold tracking-tight max-md:text-[21px]">
              Your data is yours{" "}
              <span className="ig-gradient-text">— genuinely</span>
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONTROL.map(({ icon: Icon, title, sub }, i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="flex h-full flex-col rounded-xl border border-divider bg-card p-5 transition-all hover:-translate-y-1 hover:border-accent/40">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-accent hover:text-white">
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-3.5 text-[14px] font-semibold">{title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-20 py-14 max-lg:py-10">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Reveal className="text-center">
            <h2 className="text-[24px] font-bold tracking-tight max-md:text-[21px]">
              Questions, answered
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 divide-y divide-divider overflow-hidden rounded-xl border border-divider bg-card">
              {FAQS.map((f, i) => {
                const open = openFaq === i;
                return (
                  <div key={f.q}>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <span className="flex-1 text-[14.5px] font-semibold">{f.q}</span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-muted transition-transform duration-300 ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-muted">
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA — gradient banner ──────────────────────────── */}
      <section className="py-14 max-lg:py-10">
        <div className="mx-auto max-w-[935px] px-4 sm:px-6">
          <Reveal>
            <div className="ig-gradient relative overflow-hidden rounded-2xl px-8 py-14 text-center max-md:px-6 max-md:py-10">
              <h2 className="mx-auto max-w-lg text-[26px] font-bold tracking-tight text-white max-md:text-[23px]">
                Open the dashboard and see it all
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/85">
                25 settings pages, one design system, zero guesswork.
              </p>
              <Link
                href="/settings"
                className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-7 text-[14.5px] font-semibold text-[#1a1a1a] transition-transform hover:scale-[1.02] active:scale-[0.99]"
              >
                Open Tirbeo
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-divider py-9 pb-24 md:pb-9">
        <div className="mx-auto flex max-w-[935px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <AppIcon size={22} />
            <span className="text-[14px] font-semibold">Tirbeo</span>
            <span className="text-[13px] text-muted">© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-5 text-[13px] text-muted" aria-label="Footer">
            <Link href="/settings" className="transition-colors hover:text-fg">
              Settings
            </Link>
            <Link href="/login" className="transition-colors hover:text-fg">
              Log in
            </Link>
            <a href="#feed" className="transition-colors hover:text-fg">
              Feed
            </a>
            <a href="#faq" className="transition-colors hover:text-fg">
              FAQ
            </a>
          </nav>
        </div>
      </footer>

      {/* ── Mobile bottom tab bar — IG 5-icon layout ───────── */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex h-[52px] items-center justify-around border-t border-divider bg-bg/95 backdrop-blur md:hidden"
        aria-label="Primary mobile"
      >
        <Link href="/" aria-label="Home" className="p-2 text-fg">
          <Home className="size-[26px]" />
        </Link>
        <a href="#control" aria-label="Search" className="p-2 text-fg">
          <Search className="size-[26px]" />
        </a>
        <Link
          href="/settings"
          aria-label="Open app"
          className="p-2 text-fg"
        >
          <PlusSquare className="size-[26px]" />
        </Link>
        <a href="#security" aria-label="Security" className="p-2 text-fg">
          <ShieldCheck className="size-[26px]" />
        </a>
        <Link
          href="/settings"
          aria-label="Profile"
          className="flex size-[26px] items-center justify-center rounded-full border-2 border-fg p-0.5 text-muted"
        >
          <User className="size-full" />
        </Link>
      </nav>
    </div>
  );
}
