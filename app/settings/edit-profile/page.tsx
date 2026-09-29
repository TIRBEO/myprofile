"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Input, PILL_BASE, PILL_FILL, Sheet, SheetActions, SheetOption, Textarea, cn } from "@/components/ig-ui";
import {
  Group,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { RandomAvatar } from "@/components/random-avatar";
import {
  DEFAULT_PROFILE,
  NAME_PREFIXES,
  displayName,
  liftTitle,
  readProfile,
  slugOf,
  writeProfile,
  type Profile,
} from "@/lib/profile";
import { formatDate, monthNames, weekdayNames } from "@/lib/dates";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
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

type Sub = "pronouns" | "gender" | "dob" | "prefix" | null;

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

export default function EditProfilePage() {
  const [form, setForm] = useState<Profile>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sub, setSub] = useState<Sub>(null);
  const [editor, setEditor] = useState<{ key: "photo" | "banner"; src: string } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [nudge, setNudge] = useState(0);

  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(0), 500);
    return () => clearTimeout(t);
  }, [nudge]);
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

  useEffect(() => {
    setForm(readProfile());
  }, []);

  /* One record for the whole app: what is saved here is what the rail prints
     and what an archive exports, so the two can't drift apart. */
  function commit(next: Profile) {
    setForm(next);
    writeProfile(next);
  }

  /* ── Edit popup — all fields in one sheet ── */

  function openEdit() {
    setDraft({
      name: form.name,
      prefix: form.prefix,
      suffix: form.suffix,
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

  /* Every starred field is compulsory — the popup won't close until
     they're all filled, however the user tries to leave. */
  const missing = REQUIRED.filter((k) => {
    const v = draft[k] ?? "";
    return k === "username" ? !slugOf(v) : !v.trim();
  });

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

  function saveEdit() {
    if (missing.length) {
      blockClose();
      return;
    }
    /* "Dr. Soham Dhitle" typed into the name box is a title and a name, so it
       comes apart here — the handle and the initial read the name alone. */
    const chosen = draft.prefix.trim();
    const lifted = chosen ? { title: "", name: draft.name.trim() } : liftTitle(draft.name.trim());
    commit({
      ...form,
      name: lifted.name,
      prefix: chosen || lifted.title,
      suffix: draft.suffix.trim().replace(/^,\s*/, ""),
      username: slugOf(draft.username ?? ""),
      pronouns: draft.pronouns.trim(),
      location: draft.location.trim(),
      dob: draft.dob,
      gender: draft.gender.trim(),
      bio: (draft.bio ?? "").trim(),
      photo: draft.photo || null,
      banner: draft.banner || null,
    });
    setEditing(false);
    toast.success("Profile saved");
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

  /* The pickers share one sheet, so the list is whatever the open one needs.
     A title carries an empty option because it's the only one you can take
     back off. */
  const subOptions =
    sub === "pronouns"
      ? PRONOUNS
      : sub === "gender"
        ? GENDERS
        : sub === "prefix"
          ? ["", ...NAME_PREFIXES]
          : [];

  return (
    <SettingsPage title="Edit profile">

      {/* ══ Preview — read-only. Every change happens in the sheet below it,
             so the picture, the name and the fields all edit through exactly
             one control instead of three that open the same thing. ══ */}
      <section className="-mx-4 overflow-hidden sm:-mx-6">
        <div className="relative">
          <div className="block h-[141px] w-full overflow-hidden bg-surface-2">
            {form.banner ? (
              <img src={form.banner} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="absolute top-full left-1/2 z-10 flex size-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-bg bg-surface-2">
            {form.photo ? (
              <img src={form.photo} alt="" className="size-full rounded-full object-cover" />
            ) : (
              <RandomAvatar seed={username} className="size-full" />
            )}
          </div>
        </div>

        <div className="px-4 pt-24 pb-2 text-center sm:px-5">
          <p className="text-[24px] leading-tight font-bold tracking-[-0.01em] break-words">
            {[form.prefix.trim(), form.name.trim()].filter(Boolean).join(" ") || (
              <span className="text-muted">No name yet</span>
            )}
          </p>
          <p className="mt-1 text-[15px] text-muted break-words">@{username}</p>
          {/* Qualifications are a line of their own: at the size of the name a
              string of post-nominals reads as shouting. */}
          {form.suffix.trim() ? (
            <p className="mt-1 text-[13.5px] text-muted break-words">{form.suffix.trim()}</p>
          ) : null}
        </div>
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
        <StaticRow title="Name" sub={displayName(form) || "Not added"} />
        <StaticRow title="Username" sub={`@${username}`} />
        <StaticRow title="Pronouns" sub={form.pronouns || "Not added"} />
        <StaticRow title="Location" sub={form.location || "Not added"} />
        <StaticRow title="Date of birth" sub={prettyDate(form.dob) || "Not added"} />
        <StaticRow title="Gender" sub={form.gender || "Not added"} />
      </Group>

      <BioBlock bio={form.bio} />

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
              confirmLabel="Save"
              onConfirm={saveEdit}
            />
          }
        >
          <div className="-mx-4 sm:-mx-5">
            {/* Live preview — banner with the avatar centred on its edge.
                Smaller on a phone: the sheet has six fields to reach and a
                160px face was eating a third of the scrollable height. */}
            <div className="px-4 pt-1 pb-[38px] sm:px-5 sm:pb-24">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => bannerRef.current?.click()}
                  aria-label="Change banner"
 className="block h-[92px] w-full overflow-hidden rounded-2xl bg-surface-2 outline-none sm:h-[141px]"
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
                </button>

                <div className="absolute top-full left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    aria-label="Change profile photo"
                    className="flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-surface-2 transition-transform active:scale-95 sm:size-40"
                  >
                    {draft.photo ? (
                      <img src={draft.photo} alt="" className="size-full rounded-full object-cover" />
                    ) : (
                      <RandomAvatar seed={slugOf(draft.username ?? "") || form.username} className="size-full" />
                    )}
                  </button>
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
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit();
                      }
                    }}
                    placeholder={k === "username" ? "username" : "Your name"}
                    autoFocus={i === 0}
                    spellCheck={false}
                    invalid={attempted && missing.includes(k)}
                    aria-describedby={attempted && missing.includes(k) ? `req-${k}` : undefined}
                    className="h-11"
                  />
                  <ReqNote show={attempted && missing.includes(k)} id={`req-${k}`} />
                </div>
              ))}

              {/* The optional pair that modifies the name just above it. They
                  live apart from it on purpose: fold a title into the name and
                  it follows you into the handle, the initial beside an avatar
                  and the order of every list of people. */}
              <PickerRow
                label="Title"
                value={draft.prefix ?? ""}
                placeholder="None"
                icon={<ChevronDown className="size-4 shrink-0 text-muted" />}
                onClick={() => setSub("prefix")}
              />

              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <FieldLabel text="Qualifications" />
                <Input
                  aria-label="Qualifications"
                  value={draft.suffix ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDraft((d) => ({ ...d, suffix: e.target.value }))
                  }
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEdit();
                    }
                  }}
                  placeholder="MBBS, Ph.D."
                  spellCheck={false}
                  className="h-11"
                />
              </div>

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
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEdit();
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
      {(sub === "pronouns" || sub === "gender" || sub === "prefix") && (
        <Sheet
          title={sub === "pronouns" ? "Pronouns" : sub === "gender" ? "Gender" : "Title"}
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
          <button
            type="button"
            aria-label="Previous month"
            disabled={atStart}
            onClick={() => shift(-1)}
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="size-[18px]" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => setPicker((p) => (p === "months" ? "none" : "months"))}
            className={cn(
              "rounded-full px-3 py-1.5 text-[15px] font-bold tracking-tight transition-colors",
              picker === "months" ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg hover:bg-surface-3",
            )}
          >
            {months[view.m]}
          </button>
          <button
            type="button"
            onClick={() => setPicker((p) => (p === "years" ? "none" : "years"))}
            className={cn(
              "rounded-full px-3 py-1.5 text-[15px] font-bold text-fg tabular-nums transition-colors",
              picker === "years" ? "bg-accent text-accent-fg" : "bg-surface-2 hover:bg-surface-3",
            )}
          >
            {view.y}
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={atEnd}
            onClick={() => shift(1)}
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="size-[18px]" strokeWidth={2.25} />
          </button>
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
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(iso)}
                      className={cn(
                        "grid size-10 place-items-center rounded-full text-[14.5px] tabular-nums transition-colors",
                        selected
                          ? "bg-accent font-semibold text-accent-fg"
                          : "text-fg hover:bg-surface-2",
                        !selected && isSaturday && "text-danger-text",
                        !selected && isToday && "font-bold text-accent-text",
                        disabled && "pointer-events-none text-muted/25",
                        disabled && isSaturday && "text-danger/25",
                      )}
                    >
                      {day}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ) : picker === "months" ? (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {months.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setView((v) => ({ ...v, m: i }));
                  setPicker("none");
                }}
                className={cn(
                  "rounded-full py-2 text-[13.5px] font-medium transition-colors",
                  i === view.m
                    ? "bg-accent font-semibold text-accent-fg"
                    : "text-fg hover:bg-surface-2",
                )}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 grid max-h-[300px] grid-cols-4 gap-1.5 overflow-y-auto pr-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setView((v) => ({ ...v, y: Math.min(y, maxYear) }));
                  setPicker(value ? "none" : "months");
                }}
                className={cn(
                  "rounded-full py-2 text-[13.5px] font-medium tabular-nums transition-colors",
                  y === view.y
                    ? "bg-accent font-semibold text-accent-fg"
                    : "text-fg hover:bg-surface-2",
                )}
              >
                {y}
              </button>
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
          <button
            type="button"
            aria-label="Rotate left"
            onClick={() => setRot((r) => (r + 270) % 360)}
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface-3 active:bg-surface-3"
          >
            <RotateCcw className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Rotate right"
            onClick={() => setRot((r) => (r + 90) % 360)}
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface-3 active:bg-surface-3"
          >
            <RotateCw className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setRot(0);
              setPan({ x: 0, y: 0 });
            }}
            className="ml-auto rounded-full bg-surface-2 px-4 py-2 text-[13.5px] font-semibold text-fg transition-colors hover:bg-surface-3 active:bg-surface-3"
          >
            Reset
          </button>
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
function BioBlock({ bio }: { bio: string }) {
  const text = bio.trim();
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
          <p
            ref={body}
            className={cn(
              "mt-2 max-w-[62ch] px-1 text-[15px] leading-[1.65] break-words whitespace-pre-line",
              !open && "line-clamp-5",
            )}
          >
            {text}
          </p>
          {taller || open ? (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setOpen((o) => !o);
              }}
 className="mt-2 px-1 text-[13.5px] font-semibold text-accent-text outline-none transition-colors hover:brightness-110"
            >
              {open ? "Show less" : "Show the whole bio"}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-2 px-1 text-[15px] text-muted">Not added</p>
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
      <button
        type="button"
        onClick={onClick}
        aria-describedby={invalid ? noteId : undefined}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-2xl border bg-surface-2 px-4 text-left transition-colors",
          invalid
            ? "border-danger/70 hover:border-danger"
            : "border-transparent hover:bg-surface-3",
        )}
      >
        <span
          className={cn(
            "min-w-0 break-words text-[15px]",
            value ? "text-fg" : "text-muted/70 italic",
          )}
        >
          {value || placeholder}
        </span>
        {icon}
      </button>
      <ReqNote show={!!invalid} id={noteId} />
    </div>
  );
}
