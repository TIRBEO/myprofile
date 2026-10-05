"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  IconButton,
  Input,
  PILL_BASE,
  PILL_FILL,
  Sheet,
  SheetActions,
  SheetOption,
  Textarea,
  cn,
} from "@/components/ig-ui";
import {
  Group,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { RandomAvatar } from "@/components/random-avatar";
import {
  DEFAULT_PROFILE,
  displayName,
  persistProfile,
  readProfile,
  slugOf,
  syncProfile,
  type Profile,
} from "@/lib/profile";
import { formatDate, monthNames, weekdayNames } from "@/lib/dates";
import { checkUsername, type UsernameStatus } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { usePageRefresh } from "@/lib/page-refresh";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  RotateCw,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Edit profile — same pattern as Personal details.

   The card is a read-only preview. Pressing Edit opens one popup
   with every field and both uploads. Pronouns, gender and the date
   of birth open their own sub-popup on top — picking something
   drops you back into the edit popup with the new value. Save
   writes it all at once. Nothing leaves the browser.
   ═══════════════════════════════════════════════════════════════════ */

const PHOTO_LIMIT = 5 * 1024 * 1024;

/* The gender choices, in the words the signup wizard shows too:
   `apps/accounts/src/lib/profile-fields.ts` mirrors this array byte-for-byte
   and stores the *label* on the account row, so the answer a person picks at
   signup is selected here rather than read back as blank. There is no package
   both apps import, so the lists are kept identical by hand and
   `apps/api/tests/work-fields.test.ts` fails if they drift. */
const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const PRONOUNS = ["Prefer not to say", "He/him", "She/her", "They/them"];
/* A bio is a few sentences about a person, not a tweet: it runs to several
   paragraphs, so the field has room for them and the preview can be opened. */
const BIO_MAX = 2000;
/** Where the preview stops until it's asked for — five lines of a bio is
    already more than a row in the list above it could carry. */
const BIO_LINES = 5;

const prettyDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDate(d.getTime());
};

type Sub = "pronouns" | "gender" | "dob" | null;

const REQUIRED = ["name", "username", "pronouns", "location", "dob", "gender"] as const;
type ReqKey = (typeof REQUIRED)[number];

const REQ_LABELS: Record<ReqKey, string> = {
  name: "Full name",
  username: "Username",
  pronouns: "Pronouns",
  location: "Location",
  dob: "Date of birth",
  gender: "Gender",
};

type UsernameCheck = UsernameStatus | "idle" | "checking";

const USERNAME_NOTES: Partial<Record<UsernameCheck, string>> = {
  checking: "Checking that username…",
  available: "That username is free.",
  taken: "That username is taken — try another.",
  reserved: "That username is reserved by Tirbeo.",
  invalid: "3–30 characters: letters, numbers, hyphens or underscores.",
};

export default function EditProfilePage() {
  const [form, setForm] = useState<Profile>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sub, setSub] = useState<Sub>(null);
  const [editor, setEditor] = useState<{ key: "photo" | "banner"; src: string } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [nudge, setNudge] = useState(0);
  const [saving, setSaving] = useState(false);
  /** A provider photo the browser blocked (OpaqueResponseBlocking) renders as
      a dead black circle — the address that failed, so a fresh upload after
      it gets its chance to load. The seeded face stands in while it's dead. */
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  /** The copy the last sync left — a save only sends what moved since it. */
  const [baseline, setBaseline] = useState<Profile>(DEFAULT_PROFILE);
  /** False while neither the cache nor the account has produced a profile. */
  const [loaded, setLoaded] = useState(false);
  /** The brain's answer on the draft username, checked as it's typed. */
  const [usernameStatus, setUsernameStatus] = useState<UsernameCheck>("idle");

  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(0), 500);
    return () => clearTimeout(t);
  }, [nudge]);

  /* Only a changed username needs asking about — the one on the account is,
     by definition, available to this account. Debounced so a fast typist
     pays one check, not ten. A check that fails to answer says nothing and
     blocks nothing: the save path validates the same way server-side. */
  useEffect(() => {
    if (!editing) return;
    const wanted = slugOf(draft.username ?? "");
    if (!wanted || wanted === form.username) {
      setUsernameStatus("idle");
      return;
    }
    let live = true;
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const status = await checkUsername(wanted);
      if (live) setUsernameStatus(status === "error" ? "idle" : status);
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [editing, draft.username, form.username]);
  const toast = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  /* A bio is written, not typed into a box that scrolls: the field grows to
     hold every paragraph, up to the height of the sheet itself, and only then
     starts scrolling on its own. */
  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [draft.bio, editing]);

  /* The server is the store; the local copy is what paints first. When the
     sync lands it replaces the form — unless the reader is mid-edit, in
     which case their draft is left alone and the sheet picks the new
     baseline up the next time it opens. With no local copy to paint, the
     page shows its skeleton until the account has answered — an empty
     form is not a profile. */
  useEffect(() => {
    let alive = true;
    syncProfile().then((merged) => {
      if (!alive) return;
      setLoaded(true);
      if (!merged) return;
      setForm((current) => {
        if (editing) return current;
        setBaseline(merged);
        return merged;
      });
    });
    const cached = readProfile();
    if (cached.name || cached.username || cached.photo) {
      setForm((current) => (current === DEFAULT_PROFILE ? cached : current));
      setLoaded(true);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    setLoaded(false);
    syncProfile().then((merged) => {
      setLoaded(true);
      if (!merged || editing) return;
      setBaseline(merged);
      setForm(merged);
    });
  };

  usePageRefresh(load);

  /* One record for the whole app: what is saved here is what the rail prints
     and what an archive exports, so the two can't drift apart. The write
     goes through the profile endpoint; fields the account row can't hold
     stay in the local copy and are reported in the save outcome. */
  async function commit(next: Profile) {
    setSaving(true);
    const result = await persistProfile(baseline, next);
    setSaving(false);
    if (!result.ok) {
      if (result.errors) {
        toast.error(Object.values(result.errors)[0] ?? "Some fields need attention");
      } else {
        haptic("error");
        toast.error(result.message ?? "The change could not be saved.");
      }
      return false;
    }
    setBaseline(result.outcome.profile);
    setForm(result.outcome.profile);
    if (result.outcome.unsupported.length > 0) {
      toast.error(
        `Saved — kept on this device only: ${result.outcome.unsupported.join(", ")}`,
      );
    } else {
      toast.success("Profile saved");
    }
    return true;
  }

  /* ── Edit popup — all fields in one sheet ── */

  function openEdit() {
    setDraft({
      name: form.name,
      username: form.username,
      pronouns: form.pronouns,
      location: form.location,
      dob: form.dob,
      gender: form.gender,
      bio: form.bio,
      photo: form.photo ?? "",
      banner: form.banner ?? "",
    });
    setAttempted(false);
    setSub(null);
    setEditing(true);
  }

  /* Any part of the profile opens the same popup — the banner, the face,
     the name, a detail row or the bio — so "Edit" is never a button you
     have to find before a field will answer. */
  function openEditFromPart() {
    haptic("light");
    openEdit();
  }

  /* Every starred field is compulsory — the popup won't close until
     they're all filled, however the user tries to leave. */
  const missing = REQUIRED.filter((k) => {
    const v = draft[k] ?? "";
    return k === "username" ? !slugOf(v) : !v.trim();
  });

  const usernameBad =
    usernameStatus === "taken" || usernameStatus === "reserved" || usernameStatus === "invalid";

  function blockClose() {
    setAttempted(true);
    setNudge((n) => n + 1);
    haptic("error");
    toast.error(`Still needed: ${missing.map((k) => REQ_LABELS[k]).join(", ")}`);
  }

  function tryClose() {
    if (missing.length) {
      blockClose();
      return;
    }
    setEditing(false);
  }

  async function saveEdit(): Promise<boolean> {
    if (missing.length) {
      blockClose();
      return false;
    }
    if (usernameBad || usernameStatus === "checking") {
      haptic("error");
      toast.error(
        usernameStatus === "checking"
          ? "Hold on — that username is still being checked."
          : (USERNAME_NOTES[usernameStatus] ?? "That username can't be used."),
      );
      return false;
    }
    const saved = await commit({
      ...form,
      name: draft.name.trim(),
      username: slugOf(draft.username ?? ""),
      pronouns: draft.pronouns.trim(),
      location: draft.location.trim(),
      dob: draft.dob,
      gender: draft.gender.trim(),
      bio: (draft.bio ?? "").trim(),
      photo: draft.photo || null,
      banner: draft.banner || null,
    });
    if (saved) setEditing(false);
    return saved;
  }

  function pickImage(key: "photo" | "banner", e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      haptic("error");
      toast.error("That file isn't a photo");
      return;
    }
    if (file.size > PHOTO_LIMIT) {
      haptic("error");
      toast.error("That image is larger than 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditor({ key, src: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const username = slugOf(form.username) || "username";

  /* The pickers share one sheet, so the list is whatever the open one needs. */
  const subOptions =
    sub === "pronouns"
      ? PRONOUNS
      : sub === "gender"
        ? GENDERS
        : [];

  if (!loaded) return <PageSkeleton title="Edit profile" sections={2} />;

  return (
    <SettingsPage title="Edit profile">

      {/* ══ Preview — read-only. Every change happens in the sheet below it,
             so the picture, the name and the fields all edit through exactly
             one control instead of three that open the same thing. ══ */}
      <section className="-mx-4 overflow-hidden sm:-mx-6">
        <div className="relative">
          <button
            type="button"
            onClick={openEditFromPart}
            aria-label="Edit profile — change banner"
            className="block h-[141px] w-full cursor-pointer overflow-hidden bg-surface-2 transition-opacity hover:opacity-95"
          >
            {form.banner ? (
              <img src={form.banner} alt="" className="size-full object-cover" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={openEditFromPart}
            aria-label="Edit profile — change photo"
            className="absolute top-full left-1/2 z-10 flex size-40 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-bg bg-surface-2 transition-transform hover:scale-[1.02]"
          >
            {form.photo && brokenPhoto !== form.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.photo}
                alt=""
                className="size-full rounded-full object-cover"
                onError={() => setBrokenPhoto(form.photo)}
              />
            ) : (
              <RandomAvatar seed={username} className="size-full" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={openEditFromPart}
          aria-label="Edit profile"
          className="block w-full cursor-pointer px-4 pt-24 pb-2 text-center transition-opacity hover:opacity-90 sm:px-5"
        >
          <p className="text-[24px] leading-tight font-bold tracking-[-0.01em] break-words">
            {(form.name ?? "").trim() || <span className="text-muted">No name yet</span>}
          </p>
          <p className="mt-1 text-[15px] text-muted break-words">@{username}</p>
        </button>
      </section>

      {/* One control edits the whole profile — the picture, the name, the
          handle and every field under them. */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            haptic("light");
            openEdit();
          }}
          className={cn(PILL_BASE, PILL_FILL.primary, "py-3.5 text-[15.5px]")}
        >
          <span className="min-w-0">Edit profile</span>
        </button>
      </div>

      <SectionTitle>Profile details</SectionTitle>
      <Group>
        <StaticRow title="Name" sub={displayName(form) || "Not added"} onClick={openEditFromPart} />
        <StaticRow title="Username" sub={`@${username}`} onClick={openEditFromPart} />
        <StaticRow title="Pronouns" sub={form.pronouns || "Not added"} onClick={openEditFromPart} />
        <StaticRow title="Location" sub={form.location || "Not added"} onClick={openEditFromPart} />
        <StaticRow title="Date of birth" sub={prettyDate(form.dob) || "Not added"} onClick={openEditFromPart} />
        <StaticRow title="Gender" sub={form.gender || "Not added"} onClick={openEditFromPart} />
      </Group>

      <BioBlock bio={form.bio} onEdit={openEditFromPart} />

      {/* ══ Edit popup — every field, both uploads ══ */}
      {editing ? (
        <Sheet
          title="Edit profile"
          width="lg"
          onClose={tryClose}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={tryClose}
              confirmLabel={saving ? "Saving…" : "Save"}
              disabled={saving}
              onConfirm={() => void saveEdit()}
            />
          }
        >
          <div className="-mx-4 sm:-mx-5">
            {/* Live preview — banner with the avatar centred on its edge.
                Smaller on a phone: the sheet has six fields to reach and a
                160px face was eating a third of the scrollable height. */}
            <div className="px-4 pt-1 pb-[38px] sm:px-5 sm:pb-24">
              <div className="relative">
                <Button
                  variant="ghost"
                  onClick={() => bannerRef.current?.click()}
                  aria-label="Change banner"
                  className="h-[92px] w-full overflow-hidden bg-surface-2 ps-0 pe-0 sm:h-[141px]"
                >
                  {draft.banner ? (
                    <img src={draft.banner} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center gap-1.5 pb-9 text-[13px] font-medium text-muted">
                      <ImageIcon className="size-4" />
                      Tap to add a banner
                    </span>
                  )}
                  <span className="pointer-events-none absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-scrim text-white">
                    <Pencil className="size-[15px]" />
                  </span>
                </Button>

                <div className="absolute top-full left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <IconButton
                    label="Change profile photo"
                    onClick={() => photoRef.current?.click()}
                    className="size-[76px] overflow-hidden border-4 border-surface bg-surface-2 transition-transform active:scale-95 sm:size-40"
                    icon={
                      draft.photo && brokenPhoto !== draft.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.photo}
                          alt=""
                          className="size-full rounded-full object-cover"
                          onError={() => setBrokenPhoto(draft.photo)}
                        />
                      ) : (
                        <RandomAvatar seed={slugOf(draft.username ?? "") || form.username} className="size-full" />
                      )
                    }
                  />
                  <span className="pointer-events-none absolute right-1 bottom-1.5 grid size-7 place-items-center rounded-full border-[3px] border-surface bg-surface-2 text-fg sm:size-8">
                    <Pencil className="size-3" />
                  </span>
                </div>
              </div>
            </div>

            <div className={cn("border-t border-divider", nudge > 0 && "animate-[ig-shake_0.45s_ease-in-out]")}>
              {/* Plain text fields */}
              {(["name", "username"] as const).map((k, i) => (
                <div key={k} className="px-4 py-3 sm:px-5 sm:py-4">
                  <ReqLabel k={k} />
                  <Input
                    aria-label={REQ_LABELS[k]}
                    value={draft[k] ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setDraft((d) => ({ ...d, [k]: e.target.value }))
                    }
                    onKeyDown={async (e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void (await saveEdit());
                      }
                    }}
                    placeholder={k === "username" ? "username" : "Your name"}
                    autoFocus={i === 0}
                    spellCheck={false}
                    invalid={k === "username" ? usernameBad : attempted && missing.includes(k)}
                    aria-describedby={attempted && missing.includes(k) ? `req-${k}` : undefined}
                    className="h-11"
                  />
                  <ReqNote show={attempted && missing.includes(k)} id={`req-${k}`} />
                  {k === "username" && usernameStatus !== "idle" && (
                    <p
                      className={cn(
                        "mt-1.5 text-[12.5px] font-medium",
                        usernameBad ? "text-danger-text" : "text-muted",
                      )}
                    >
                      {USERNAME_NOTES[usernameStatus]}
                    </p>
                  )}
                </div>
              ))}

              {/* Picker rows — each opens a sub-popup on top */}
              <PickerRow
                label="Pronouns"
                value={draft.pronouns ?? ""}
                placeholder="Not added"
                invalid={attempted && missing.includes("pronouns")}
                icon={<ChevronDown className="size-4 shrink-0 text-muted" />}
                onClick={() => setSub("pronouns")}
              />

              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <ReqLabel k="location" />
                <Input
                  aria-label={REQ_LABELS.location}
                  value={draft.location ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDraft((d) => ({ ...d, location: e.target.value }))
                  }
                  onKeyDown={async (e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void (await saveEdit());
                    }
                  }}
                  placeholder="Kathmandu, Nepal"
                  spellCheck={false}
                  invalid={attempted && missing.includes("location")}
                  aria-describedby={attempted && missing.includes("location") ? "req-location" : undefined}
                  className="h-11"
                />
                <ReqNote show={attempted && missing.includes("location")} id="req-location" />
              </div>

              <PickerRow
                label="Date of birth"
                value={prettyDate(draft.dob ?? "")}
                placeholder="Not set"
                invalid={attempted && missing.includes("dob")}
                icon={<CalendarIcon className="size-4 shrink-0 text-muted" />}
                onClick={() => setSub("dob")}
              />

              <PickerRow
                label="Gender"
                value={draft.gender ?? ""}
                placeholder="Not added"
                invalid={attempted && missing.includes("gender")}
                icon={<ChevronDown className="size-4 shrink-0 text-muted" />}
                onClick={() => setSub("gender")}
              />

              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Bio
                  </span>
                  <span className="text-[12px] tabular-nums text-muted">
                    {(draft.bio ?? "").length}/{BIO_MAX}
                  </span>
                </div>
                <Textarea
                  aria-label="Bio"
                  ref={bioRef}
                  value={draft.bio ?? ""}
                  maxLength={BIO_MAX}
                  rows={3}
                  placeholder="Who you are, in your own words. Line breaks are kept."
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setDraft((d) => ({ ...d, bio: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </Sheet>
      ) : null}

      {/* ══ Sub-popups — sit on top of the edit popup ══ */}
  {(sub === "pronouns" || sub === "gender") && (
    <Sheet
      title={sub === "pronouns" ? "Pronouns" : "Gender"}
      description="Choose one — it lands when you save."
      onClose={() => setSub(null)}
    >
          <div className="-mx-4 list-divide sm:-mx-5">
            {subOptions.map((option) => (
              <SheetOption
                key={option || "none"}
                selected={(draft[sub] ?? "") === option}
                onClick={() => {
                  setDraft((d) => ({ ...d, [sub]: option }));
                  setSub(null);
                }}
              >
                {option || "None"}
              </SheetOption>
            ))}
          </div>
        </Sheet>
      )}

      {sub === "dob" ? (
        <CalendarSheet
          value={draft.dob ?? ""}
          onPick={(iso) => {
            setDraft((d) => ({ ...d, dob: iso }));
            setSub(null);
          }}
          onClear={() => {
            setDraft((d) => ({ ...d, dob: "" }));
            setSub(null);
          }}
          onClose={() => setSub(null)}
        />
      ) : null}

      {/* ══ Image editor — pan, zoom and rotate the picked picture ══ */}
      {editor ? (
        <EditorSheet
          key={editor.src}
          src={editor.src}
          kind={editor.key}
          onCancel={() => setEditor(null)}
          onApply={(dataUrl) => {
            setDraft((d) => ({ ...d, [editor.key]: dataUrl }));
            setEditor(null);
            toast.success(editor.key === "photo" ? "Photo updated" : "Banner updated");
          }}
        />
      ) : null}

      {/* Off-screen but still in the tab order, so each one needs a name of
          its own — a screen reader reaches them directly. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        aria-label="Choose a new profile photo"
        className="sr-only"
        onChange={(e) => pickImage("photo", e)}
      />
      <input
        ref={bannerRef}
        type="file"
        accept="image/*"
        aria-label="Choose a new banner image"
        className="sr-only"
        onChange={(e) => pickImage("banner", e)}
      />
    </SettingsPage>
  );
}

/* ── Custom date-of-birth calendar ─────────────────────────────── */

const SATURDAY_COL = 6;
const MIN_YEAR = 1900;

const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function CalendarSheet({
  value,
  onPick,
  onClear,
  onClose,
}: {
  value: string;
  onPick: (iso: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const today = new Date();
  const todayIso = isoOf(today.getFullYear(), today.getMonth(), today.getDate());
  /* Named in the language the app is set to, Sunday first like the grid. */
  const months = monthNames();
  const weekdays = weekdayNames();
  const maxYear = today.getFullYear() - 13;
  const maxIso = `${maxYear}-12-31`;
  const initial = value ? new Date(`${value}T00:00:00`) : new Date(maxYear, 5, 15);
  const safe = Number.isNaN(initial.getTime()) ? new Date(maxYear, 5, 15) : initial;

  const [view, setView] = useState({
    y: Math.min(safe.getFullYear(), maxYear),
    m: safe.getMonth(),
  });
  const [picker, setPicker] = useState<"none" | "months" | "years">(value ? "none" : "years");

  function shift(delta: number) {
    setPicker("none");
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const atEnd = view.y === maxYear && view.m === 11;
  const atStart = view.y === MIN_YEAR && view.m === 0;

  const years: number[] = [];
  for (let y = maxYear; y >= MIN_YEAR; y--) years.push(y);

  return (
    <Sheet title="Date of birth" onClose={onClose}>
      <div className="-mx-4 px-3 pb-4 sm:-mx-5 sm:px-4">
        {/* Month & year — centered between plain chevrons */}
        <div className="flex items-center justify-center gap-2">
          <IconButton
            label="Previous month"
            disabled={atStart}
            onClick={() => shift(-1)}
            className="bg-surface-2 hover:bg-surface-3"
            icon={<ChevronLeft className="size-[18px]" strokeWidth={2.25} />}
          />
          <Chip
            active={picker === "months"}
            onClick={() => setPicker((p) => (p === "months" ? "none" : "months"))}
          >
            {months[view.m]}
          </Chip>
          <Chip
            active={picker === "years"}
            className="tabular-nums"
            onClick={() => setPicker((p) => (p === "years" ? "none" : "years"))}
          >
            {view.y}
          </Chip>
          <IconButton
            label="Next month"
            disabled={atEnd}
            onClick={() => shift(1)}
            className="bg-surface-2 hover:bg-surface-3"
            icon={<ChevronRight className="size-[18px]" strokeWidth={2.25} />}
          />
        </div>

        {picker === "none" ? (
          <div className="mt-4">
            {/* Weekday captions — Saturday in red */}
            <div className="grid grid-cols-7">
              {weekdays.map((w, i) => (
                <span
                  key={w}
                  className={cn(
                    "pb-1 text-center text-[11px] font-semibold",
                    i === SATURDAY_COL ? "text-danger-text" : "text-muted/70",
                  )}
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Day cells — tap to pick and close */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstWeekday }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const iso = isoOf(view.y, view.m, day);
                const disabled = iso > maxIso || iso < `${MIN_YEAR}-01-01`;
                const selected = value === iso;
                const isToday = iso === todayIso;
                const isSaturday = new Date(view.y, view.m, day).getDay() === 6;
                return (
                  <span key={iso} className="flex justify-center">
                    <Chip
                      active={selected}
                      disabled={disabled}
                      onClick={() => onPick(iso)}
                      className="size-10 justify-center border-transparent"
                    >
                      <span
                        className={cn(
                          "text-[14.5px] tabular-nums",
                          !selected && isSaturday && "text-danger-text",
                          !selected && isToday && "font-bold text-accent-text",
                          disabled && "text-muted/25",
                          disabled && isSaturday && "text-danger/25",
                        )}
                      >
                        {day}
                      </span>
                    </Chip>
                  </span>
                );
              })}
            </div>
          </div>
        ) : picker === "months" ? (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {months.map((m, i) => (
              <Chip
                key={m}
                active={i === view.m}
                className="border-transparent"
                onClick={() => {
                  setView((v) => ({ ...v, m: i }));
                  setPicker("none");
                }}
              >
                {m.slice(0, 3)}
              </Chip>
            ))}
          </div>
        ) : (
          <div className="mt-3 grid max-h-[300px] grid-cols-4 gap-1.5 overflow-y-auto pr-1">
            {years.map((y) => (
              <Chip
                key={y}
                active={y === view.y}
                className="border-transparent tabular-nums"
                onClick={() => {
                  setView((v) => ({ ...v, y: Math.min(y, maxYear) }));
                  setPicker(value ? "none" : "months");
                }}
              >
                {y}
              </Chip>
            ))}
          </div>
        )}

        {/* Clear — only when a date exists; picking a day already saves and closes */}
        {value && picker === "none" ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(PILL_BASE, PILL_FILL.danger, "mt-1")}
          >
            Clear date
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

/* ── Image editor — drag to pan, slider to zoom, 90° rotation ──── */

function EditorSheet({
  src,
  kind,
  onCancel,
  onApply,
}: {
  src: string;
  kind: "photo" | "banner";
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  /* Keep the picture covering the frame — no empty corners ever.
     The <img> is object-cover in a full-size box, so the covered rect
     is simply the frame scaled by zoom (swapped when rotated 90°). */
  function coverBox(z: number, r: number) {
    const frame = frameRef.current;
    if (!frame) return null;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    if (!fw || !fh) return null;
    let W = fw * z;
    let H = fh * z;
    if (r % 180 !== 0) [W, H] = [H, W];
    return { fw, fh, W, H };
  }

  function clamp(p: { x: number; y: number }, z = zoom, r = rot) {
    const box = coverBox(z, r);
    if (!box) return { x: 0, y: 0 };
    const mx = Math.max(0, (box.W - box.fw) / 2);
    const my = Math.max(0, (box.H - box.fh) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  }

  useEffect(() => {
    // After a rotate the box swaps — zoom in enough to re-cover, then re-clamp.
    setZoom((z) => {
      const box = coverBox(z, rot);
      if (!box) return z;
      const need = Math.max(box.fw / box.W, box.fh / box.H, 1);
      return Math.min(4, z * need);
    });
    setPan((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot]);

  useEffect(() => {
    setPan((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPan(
      clamp({
        x: drag.current.ox + (e.clientX - drag.current.px),
        y: drag.current.oy + (e.clientY - drag.current.py),
      }),
    );
  }
  function onPointerUp() {
    drag.current = null;
  }

  function apply() {
    const frame = frameRef.current;
    const img = new window.Image();
    img.onload = () => {
      const out = kind === "photo" ? { w: 512, h: 512 } : { w: 1280, h: 448 };
      const c = document.createElement("canvas");
      c.width = out.w;
      c.height = out.h;
      const ctx = c.getContext("2d");
      if (!ctx || !frame) {
        onCancel();
        return;
      }
      const fw = frame.clientWidth || out.w;
      const fh = frame.clientHeight || out.h;
      const k = out.w / fw;
      const base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      const s = base * zoom * k;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, out.w, out.h);
      ctx.clip();
      ctx.translate(out.w / 2 + pan.x * k, out.h / 2 + pan.y * k);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(
        img,
        (-img.naturalWidth * s) / 2,
        (-img.naturalHeight * s) / 2,
        img.naturalWidth * s,
        img.naturalHeight * s,
      );
      ctx.restore();
      onApply(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => onCancel();
    img.src = src;
  }

  return (
    <Sheet
      title={kind === "photo" ? "Adjust photo" : "Adjust banner"}
      description="Drag to move · slide to zoom · turn to straighten."
      onClose={onCancel}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onCancel}
          confirmLabel="Apply"
          onConfirm={apply}
        />
      }
    >
      <div className="-mx-4 px-4 pt-1 pb-5 sm:-mx-5 sm:px-5">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "relative w-full touch-none overflow-hidden bg-surface-2 select-none",
            kind === "photo" ? "mx-auto max-w-[300px] aspect-square rounded-full" : "aspect-[40/14] rounded-2xl",
          )}
          style={{ cursor: drag.current ? "grabbing" : "grab" }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rot}deg)` }}
          />
        </div>

        {/* Zoom */}
        <div className="mt-5 flex items-center gap-3">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            Zoom
          </span>
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-7 flex-1 cursor-pointer appearance-none accent-accent"
          />
        </div>

        {/* Rotation + reset */}
        <div className="mt-4 flex items-center gap-2">
          <IconButton
            label="Rotate left"
            onClick={() => setRot((r) => (r + 270) % 360)}
            className="bg-surface-2 hover:bg-surface-3"
            icon={<RotateCcw className="size-[18px]" />}
          />
          <IconButton
            label="Rotate right"
            onClick={() => setRot((r) => (r + 90) % 360)}
            className="bg-surface-2 hover:bg-surface-3"
            icon={<RotateCw className="size-[18px]" />}
          />
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setZoom(1);
              setRot(0);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ── Pieces — the sheet's own field rows ══════════════════════════ */

/* A bio isn't a value the size of a row. It is written in paragraphs, and the
   line breaks someone put in it are part of what it says — so it sits under the
   list of short fields, at the width a paragraph is read at, with its breaks
   kept and only its first few lines shown until the rest is asked for. */
function BioBlock({ bio, onEdit }: { bio: string | null; onEdit?: () => void }) {
  // The endpoint answers `null` for a bio nobody has written, and `Profile`
  // types the field as a string — so this is called with a value its own
  // signature said could not happen. Normalising here as well as in the store
  // means a page cannot be taken down by a missing optional field.
  const text = (bio ?? "").trim();
  const body = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [taller, setTaller] = useState(false);

  /* Asked for, not guessed at: a bio is short most of the time and a "show
     more" on two lines would be a control with nothing behind it. */
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const check = () => setTaller(el.scrollHeight - el.clientHeight > 2);
    check();
    const box = new ResizeObserver(check);
    box.observe(el);
    return () => box.disconnect();
  }, [text]);

  return (
    <section className="mt-7">
      <h3 className="px-1 text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">
        Bio
      </h3>
      {text ? (
        <>
          {onEdit ? (
            <button type="button" onClick={onEdit} aria-label="Edit bio" className="mt-2 block w-full cursor-pointer text-left">
              <p
                ref={body}
                className={cn(
                  "max-w-[62ch] px-1 text-[15px] leading-[1.65] break-words whitespace-pre-line",
                  !open && "line-clamp-5",
                )}
              >
                {text}
              </p>
            </button>
          ) : (
            <p
              ref={body}
              className={cn(
                "mt-2 max-w-[62ch] px-1 text-[15px] leading-[1.65] break-words whitespace-pre-line",
                !open && "line-clamp-5",
              )}
            >
              {text}
            </p>
          )}
          {taller || open ? (
            <Button
              variant="link"
              className="mt-2 px-1"
              onClick={() => {
                haptic("light");
                setOpen((o) => !o);
              }}
            >
              {open ? "Show less" : "Show the whole bio"}
            </Button>
          ) : null}
        </>
      ) : (
        onEdit ? (
          <button type="button" onClick={onEdit} className="mt-2 block w-full cursor-pointer text-left">
            <p className="px-1 text-[15px] text-muted">Not added</p>
          </button>
        ) : (
          <p className="mt-2 px-1 text-[15px] text-muted">Not added</p>
        )
      )}
    </section>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">
      {text}
      {required ? <span className="text-danger"> *</span> : null}
    </p>
  );
}

function ReqLabel({ k }: { k: ReqKey }) {
  return <FieldLabel text={REQ_LABELS[k]} required />;
}

/* A missing field says so in words, under itself. The red edge is only a
   pointer — colour can't carry the message on its own, and one toast at the
   top of the sheet doesn't tell you which row to go back to. */
function ReqNote({ show, id }: { show: boolean; id: string }) {
  if (!show) return null;
  return (
    <p id={id} className="mt-1.5 text-[12.5px] font-medium text-danger-text">
      Needed before you can save
    </p>
  );
}

function PickerRow({
  label,
  value,
  placeholder,
  icon,
  invalid,
  onClick,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  invalid?: boolean;
  onClick: () => void;
}) {
  const noteId = `req-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="px-4 py-3 sm:px-5 sm:py-4">
      <FieldLabel text={label} />
      <Button
        variant="ghost"
        onClick={onClick}
        aria-describedby={invalid ? noteId : undefined}
        className={cn(
          "h-11 w-full gap-3 bg-surface-2 text-left",
          invalid ? "border border-danger/70 hover:border-danger" : "border border-transparent hover:bg-surface-3",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 break-words whitespace-normal text-[15px]",
            value ? "text-fg" : "text-muted/70 italic",
          )}
        >
          {value || placeholder}
        </span>
        {icon}
      </Button>
      <ReqNote show={!!invalid} id={noteId} />
    </div>
  );
}
