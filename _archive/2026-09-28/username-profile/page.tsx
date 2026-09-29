"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Group,
  Helper,
  LinkRow,
  PageSkeleton,
  PillButton,
  PillStack,
  SectionTitle,
  SettingsPage,
} from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import { cn } from "@/components/ig-ui";
import { profileHref, slugOf, useProfile, linkHost, type Profile } from "@/lib/profile";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   The profile, at its own address

   Filed under the handle rather than under /p/ or /u/, because that's the
   address people actually type and the one that appears in a shared link.

   It shows what the account tells people about itself and nothing else:
   the counts and the bio and the links, no invented feed. Yours carries the
   way out of it — edit, message, settings. Anyone else's carries a request,
   because you can't edit a stranger.
   ═══════════════════════════════════════════════════════════════════ */

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const profile = useProfile();

  if (!profile) return <PageSkeleton title="Profile" sections={2} />;

  const handle = slugOf(params.username ?? "");
  const mine = handle === profile.username;

  /* The handle in the address is the only thing that decides what this page
     is. Yours is complete; everyone else's is what they'd see too. */
  if (!mine) return <StrangerPage handle={handle} />;

  return (
    <SettingsPage title={profile.name}>
      <Header profile={profile} />

      <Counts following={profile.following} followers={profile.followers} />

      {profile.bio ? (
        <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed whitespace-pre-line">
          {profile.bio}
        </p>
      ) : null}

      {profile.links.length ? <SectionTitle>Links</SectionTitle> : null}
      {profile.links.length ? (
        <Group>
          {profile.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => haptic("light")}
              className={cn(
                "flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none transition-colors",
                "hover:bg-surface-2/50 active:bg-surface-2/70 focus-visible:outline-none sm:px-5 sm:py-4",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[15px] font-medium">
                  {link.title || linkHost(link.url)}
                </span>
                <span className="mt-1 block text-[13px] text-muted">{linkHost(link.url)}</span>
              </span>
            </a>
          ))}
        </Group>
      ) : null}

      <PillStack>
        <PillButton label="Edit details" href={`${profileHref(profile.username)}/edit`} />
        <PillButton label="Notifications" href="/settings/notifications" tone="outline" />
      </PillStack>

      <SectionTitle>Everything else</SectionTitle>
      <Group>
        <LinkRow
          href="/settings"
          title="Account settings"
          sub="Security, privacy, your data and the rest of the controls."
        />
      </Group>

      <Helper>
        This is the page other accounts see at <span className="font-medium">@{profile.username}</span>.
        What&apos;s on it is set on the edit screen — nothing here is filled in for you.
      </Helper>
    </SettingsPage>
  );
}

/* ── The name, the handle, the face ─────────────────────────────── */

function Header({ profile }: { profile: Profile }) {
  return (
    <div className="mt-6 flex items-center gap-5">
      <ProfilePicture
        photo={profile.photo}
        seed={profile.username}
        name={profile.name}
        size={92}
        className="shadow-[0_10px_30px_-12px_rgb(0_0_0/0.55)]"
      />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold">@{profile.username}</p>
        {profile.pronouns ? <p className="mt-1 text-[13px] text-muted">{profile.pronouns}</p> : null}
      </div>
    </div>
  );
}

/* ── The two numbers a profile is asked to carry ──────────────────
   A pair of real counts, as a line of text you can read rather than two
   tiles pretending to be buttons — neither of them opens anything here,
   because nothing measures them yet. */

function Counts({ following, followers }: { following: number; followers: number }) {
  return (
    <p className="mt-7 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-y border-divider py-4">
      <Figure n={following} label="Following" />
      <Figure n={followers} label="Followers" />
    </p>
  );
}

function Figure({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[19px] font-bold tabular-nums tracking-[-0.02em]">
        {n.toLocaleString("en-US")}
      </span>
      <span className="text-[13.5px] text-muted">{label}</span>
    </span>
  );
}

/* ── Someone else's handle ────────────────────────────────────────
   The same address shape and the same column, and nothing you can change.
   Only one account exists on this device, so there is no bio, no counts and
   no links to show for anyone else — the page says so instead of inventing
   a stranger. */

function StrangerPage({ handle }: { handle: string }) {
  const name = handle
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <SettingsPage title={name || handle}>
      <div className="mt-6 flex flex-col items-center py-4 text-center">
        <ProfilePicture seed={handle} name={name} size={104} />
        <h2 className="mt-5 text-[20px] font-bold tracking-[-0.02em]">{name || handle}</h2>
        <p className="mt-1 text-[14px] text-muted">@{handle}</p>
      </div>

      <Helper>
        Only your own profile is kept on this device, so there&apos;s nothing else to show for @{handle}
        yet. The address is right — the record isn&apos;t here.
      </Helper>
    </SettingsPage>
  );
}
