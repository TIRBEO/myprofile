"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, CircleAlert, Link2, Plus, X } from "lucide-react";
import { Input, PILL_BASE, PILL_FILL, Textarea, cn } from "@/components/ig-ui";
import { Group, Helper, SectionTitle, SettingsPage } from "@/components/settings-shell";
import { ProfilePicture } from "@/components/profile-picture";
import {
  DEFAULT_PROFILE,
  profileHref,
  readProfile,
  slugOf,
  writeProfile,
  type Profile,
  type ProfileLink,
} from "@/lib/profile";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Edit details

   The public half of the account, on one screen, the way Instagram does it:
   the fields other people read, and nothing else. The rest of what lives on
   a profile — birth date, gender, pronouns, where you are — is on the
   account settings pages, because that's where the person editing it is
   looking for it.

   The form starts from what's stored and writes back the whole record, so
   the fields this screen doesn't show survive a save untouched. A photo is
   read into the browser and kept as the picture itself; nothing is uploaded,
   because there's nowhere to upload it to.
   ═══════════════════════════════════════════════════════════════════ */

const PHOTO_LIMIT = 5 * 1024 * 1024;
const NAME_MAX = 40;
const HANDLE_MAX = 30;
const BIO_MAX = 150;
const LINKS_MAX = 5;

export default function EditDetailsPage() {
  const router = useRouter();
  const toast = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(readProfile());
  }, []);

  if (!form) return null;

  const patch = (next: Partial<Profile>) => {
    setForm((current) => ({ ...(current as Profile), ...next }));
    setDirty(true);
  };

  const handle = slugOf(form.username);
  const badHandle = !handle || handle.length < 3;
  const badName = !form.name.trim();

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      haptic("error");
      toast.error("That file isn't a photo");
      return;
    }
    if (file.size > PHOTO_LIMIT) {
      haptic("error");
      toast.error(`Photos are capped at ${Math.round(PHOTO_LIMIT / 1024 / 1024)} MB on this device`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ photo: String(reader.result) });
    reader.onerror = () => toast.error("That photo couldn't be read");
    reader.readAsDataURL(file);
  }

  function save() {
    if (!form || badName || badHandle) {
      haptic("error");
      return;
    }
    const next = writeProfile({ ...form, username: handle });
    setForm(next);
    setDirty(false);
    haptic("success");
    toast.success("Your profile is updated");
    router.replace(profileHref(next.username));
  }

  return (
    <SettingsPage title="Edit details">
      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => {
            haptic("light");
            photoRef.current?.click();
          }}
          className="group relative outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          aria-label="Change your profile photo"
        >
          <ProfilePicture photo={form.photo} seed={handle || form.username} name={form.name} size={98} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="size-6" strokeWidth={1.9} />
          </span>
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            pickPhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="flex gap-2">
          {form.photo ? (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                patch({ photo: null });
              }}
              className="text-[13px] font-semibold text-muted hover:text-fg"
            >
              Remove photo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              photoRef.current?.click();
            }}
            className="text-[13px] font-semibold text-accent-text hover:underline"
          >
            {form.photo ? "Replace photo" : "Upload photo"}
          </button>
        </div>
      </div>

      <SectionTitle desc="Both appear at the top of your profile. The username is also the address: it's what comes after the slash.">
        Name and username
      </SectionTitle>
      <Group>
        <div className="w-full px-4 py-3 sm:px-5">
          <Label text="Name" count={`${form.name.length}/${NAME_MAX}`} />
          <Input
            value={form.name}
            maxLength={NAME_MAX}
            placeholder="Your name"
            autoComplete="name"
            onChange={(event) => patch({ name: event.target.value })}
          />
          {badName ? <Error>Names can&apos;t be empty.</Error> : null}
        </div>
        <div className="w-full px-4 py-3 sm:px-5">
          <Label text="Username" count={`${handle.length}/${HANDLE_MAX}`} />
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[15px] font-medium text-muted">@</span>
            <Input
              value={form.username}
              maxLength={HANDLE_MAX}
              placeholder="username"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => patch({ username: event.target.value })}
            />
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {profileHref(handle || "…")}
          </p>
          {badHandle ? <Error>At least three letters, numbers, dots, underscores or dashes.</Error> : null}
        </div>
      </Group>

      <SectionTitle desc="Up to three lines, shown under your name. A return key starts one, so the shape you type is the shape people read.">
        Bio
      </SectionTitle>
      <Group>
        <div className="w-full px-4 py-3 sm:px-5">
          <Label text="Bio" count={`${form.bio.length}/${BIO_MAX}`} />
          <Textarea
            value={form.bio}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="Who you are, in your own words"
            onChange={(event) => patch({ bio: event.target.value })}
          />
        </div>
      </Group>

      <SectionTitle desc={`${form.links.length} of ${LINKS_MAX} used. These are the only clickable things on a profile.`}>
        Links
      </SectionTitle>
      <Group>
        {form.links.map((link, index) => (
          <LinkFields
            key={link.id}
            link={link}
            onChange={(next) =>
              patch({ links: form.links.map((row, i) => (i === index ? next : row)) })
            }
            onRemove={() => {
              haptic("light");
              patch({ links: form.links.filter((_, i) => i !== index) });
            }}
          />
        ))}
        {form.links.length < LINKS_MAX ? (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              patch({
                links: [
                  ...form.links,
                  { id: `link-${Date.now()}`, title: "", url: "" } as ProfileLink,
                ],
              });
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-accent-text transition-colors hover:bg-surface-2/50 active:bg-surface-2/70 sm:px-5"
          >
            <Plus className="size-[18px] shrink-0" strokeWidth={2.1} />
            Add link
          </button>
        ) : null}
      </Group>

      <div className="mt-8 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || badName || badHandle}
          className={cn(
            PILL_BASE,
            PILL_FILL.primary,
            "py-3.5 text-[15.5px]",
            (!dirty || badName || badHandle) && "pointer-events-none opacity-55",
          )}
        >
          <Check className="size-[18px]" strokeWidth={2.2} />
          <span className="min-w-0">{dirty ? "Save changes" : "Saved"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(DEFAULT_PROFILE);
            setDirty(true);
            haptic("light");
          }}
          className={cn(PILL_BASE, PILL_FILL.outline, "py-3.5 text-[15.5px]")}
        >
          <span className="min-w-0">Reset to the example profile</span>
        </button>
      </div>

      <Helper>
        Saved on this device only — there&apos;s no profile server to write to yet, so this is what
        the profile pages read. Nothing here changes your email, your password or your name on
        account settings.
      </Helper>
    </SettingsPage>
  );
}

/* ── One link, two boxes and a way to drop it ───────────────────── */

function LinkFields({
  link,
  onChange,
  onRemove,
}: {
  link: ProfileLink;
  onChange: (next: ProfileLink) => void;
  onRemove: () => void;
}) {
  return (
    <div className="w-full px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Link2 className="size-[16px] shrink-0 text-muted" strokeWidth={1.9} />
          <span className="truncate text-[13px] font-medium text-muted">
            {link.title || link.url || "New link"}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this link"
          className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-danger-text"
        >
          <X className="size-[17px]" strokeWidth={2.1} />
        </button>
      </div>
      <div className="mt-2.5 space-y-2.5">
        <Input
          value={link.title}
          maxLength={40}
          placeholder="Title — GitHub, Portfolio"
          onChange={(event) => onChange({ ...link, title: event.target.value })}
        />
        <Input
          value={link.url}
          maxLength={160}
          inputMode="url"
          placeholder="https://"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => onChange({ ...link, url: event.target.value })}
        />
      </div>
    </div>
  );
}

function Label({ text, count }: { text: string; count?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-semibold text-muted">{text}</span>
      {count ? <span className="text-[12px] tabular-nums text-muted">{count}</span> : null}
    </div>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-danger-text">
      <CircleAlert className="mt-px size-[13px] shrink-0" strokeWidth={2.1} />
      {children}
    </p>
  );
}
