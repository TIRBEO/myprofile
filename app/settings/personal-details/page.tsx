"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  cn,
  Input,
  Sheet,
  SheetActions,
} from "@/components/ig-ui";
import {
  Group,
  Helper,
  PageSkeleton,
  ROW,
  SectionTitle,
  SettingsPage,
  StaticRow,
  SUB,
  TITLE,
} from "@/components/settings-shell";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import {
  DEFAULT_PROFILE,
  PROFILE_SYNCED_EVENT,
  persistProfile,
  readProfile,
  sharedSyncForDetails,
  syncProfile,
  type Profile,
} from "@/lib/profile";
import { usePageRefresh } from "@/lib/page-refresh";

/* ═══════════════════════════════════════════════════════════════════
   Personal details.

   Two contained panels and one tag cloud, each editable block stated as
   read-only values with a single big blue action underneath — never a
   row-level chevron competing with a heading-level Edit. Phone and
   website share one sheet, so there is one edit gesture for contact and
   one for work. Skills are plain pills; tapping one asks before it goes.

   The store is the server: email arrives read-only off the account row,
   website and the job fields save through the profile endpoint, and the
   local copy is only the cache that paints first. Phone is a recovery
   number owned by the security flow — shown, never edited here. Skills
   have no column yet, so they stay local-only and say so on save.
   ═══════════════════════════════════════════════════════════════════ */

const MAX_SKILLS = 8;

type JobKey = "role" | "company" | "place" | "start";

type Details = {
  email: string;
  phone: string;
  website: string;
  job: Record<JobKey, string>;
  skills: string[];
};

const EMPTY: Details = {
  email: "",
  phone: "",
  website: "",
  job: { role: "", company: "", place: "", start: "" },
  skills: [],
};

/** The Work answers, in the words the signup wizard uses too.
    `apps/accounts/src/lib/profile-fields.ts` mirrors these four label/placeholder
    pairs byte-for-byte — there is no package both apps import, so the two lists
    are kept identical by hand and `apps/api/tests/work-fields.test.ts` fails if
    they ever drift. The answers land on the account row's
    `jobRole`/`jobCompany`/`jobPlace`/`jobStarted` columns, which is also where
    signup writes them. */
const JOB_FIELDS: Record<JobKey, { label: string; placeholder: string }> = {
  role: { label: "Job title", placeholder: "Product engineer" },
  company: { label: "Company", placeholder: "Tirbeo" },
  place: { label: "Work location", placeholder: "Kathmandu, Nepal" },
  start: { label: "Started in", placeholder: "2022" },
};

const JOB_KEYS = Object.keys(JOB_FIELDS) as JobKey[];

type SheetId = "job" | "contact";

const CONTACT_FIELDS = [
  {
    key: "phone" as const,
    label: "Phone",
    placeholder: "+977 98XXXXXXXX",
    hint: "Used for login alerts and account recovery.",
    type: "tel",
  },
  {
    key: "website" as const,
    label: "Website",
    placeholder: "yoursite.com",
    hint: "Shown as a link on your public profile.",
    type: "url",
  },
];

function detailsOf(profile: Profile): Details {
  return {
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    website: profile.website ?? "",
    job: {
      role: profile.jobRole ?? "",
      company: profile.jobCompany ?? "",
      // All four are real columns on the account row (`job_role`, `job_company`,
      // `job_place`, `job_started`), so what signup asked for shows up here.
      place: profile.jobPlace ?? "",
      start: profile.jobStartedOn ?? "",
    },
    skills: profile.skills ?? [],
  };
}

export default function PersonalDetailsPage() {
  const [form, setForm] = useState<Details>(EMPTY);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [skillSheet, setSkillSheet] = useState(false);
  const [draftSkill, setDraftSkill] = useState("");
  const [removingSkill, setRemovingSkill] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  /** False while neither the cache nor the account has produced a profile. */
  const [loaded, setLoaded] = useState(false);
  /** The last synced server copy — a save only sends what moved since it. */
  const baselineRef = useRef<Profile>(DEFAULT_PROFILE);

  /* Paint the cache first, then reconcile with the server once. The shared
     sync means a page that also mounts useProfile() costs no extra fetch.
     With no local copy, an all-blank form is not the account's answer, so
     the page keeps its skeleton until the sync settles. */
  useEffect(() => {
    let alive = true;
    const paint = (profile: Profile) => {
      if (!alive) return;
      baselineRef.current = profile;
      setForm(detailsOf(profile));
      setLoaded(true);
    };
    const cached = readProfile();
    if (cached.name || cached.email || cached.website || cached.jobRole) paint(cached);
    void sharedSyncForDetails().then((merged) => {
      if (!alive) return;
      if (merged) paint(readProfile());
      else setLoaded(true);
    });
    const onSynced = () => paint(readProfile());
    window.addEventListener(PROFILE_SYNCED_EVENT, onSynced);
    return () => {
      alive = false;
      window.removeEventListener(PROFILE_SYNCED_EVENT, onSynced);
    };
  }, []);

  usePageRefresh(() => {
    void syncProfile().then((merged) => {
      if (!merged) return;
      baselineRef.current = merged;
      setForm(detailsOf(merged));
      setLoaded(true);
    });
  });

  /** Saves the whole Details shape through the profile endpoint. The fields
      the row cannot hold are merged into the local copy before the write so
      they survive the server answer overwriting it — today that is only the
      follower counts, so every work answer goes up. */
  async function commit(next: Details) {
    const localOnly = {
      jobPlace: next.job.place,
      jobStartedOn: next.job.start,
      skills: next.skills,
    };
    const merged: Profile = {
      ...baselineRef.current,
      email: next.email || baselineRef.current.email,
      phone: next.phone || baselineRef.current.phone,
      website: next.website,
      jobRole: next.job.role,
      jobCompany: next.job.company,
      ...localOnly,
    };
    setForm(next);
    setSaving(true);
    const result = await persistProfile(baselineRef.current, merged);
    setSaving(false);
    if (!result.ok) {
      haptic("error");
      if (result.errors) {
        toast.error(Object.values(result.errors)[0] ?? "Some fields need attention");
      } else {
        toast.error(result.message ?? "The change could not be saved.");
      }
      return;
    }
    const unsupported = new Set(result.outcome.unsupported);
    const keptLocal = [
      ...(next.job.place && unsupported.has("jobPlace") ? ["work location"] : []),
      ...(next.job.start && unsupported.has("jobStartedOn") ? ["started-in year"] : []),
      ...(next.skills.length > 0 && unsupported.has("skills") ? ["skills"] : []),
    ];
    if (keptLocal.length > 0) {
      toast.error(`Saved — kept on this device only: ${keptLocal.join(", ")}`);
    } else {
      toast.success("Saved");
    }
  }

  /* ── Sheets ── */

  function openSheet(id: SheetId) {
    if (id === "job") {
      const next: Record<string, string> = {};
      for (const k of JOB_KEYS) next[k] = form.job[k] ?? "";
      setDraft(next);
    } else {
      // Phone is a recovery identity owned by /api/security — shown but
      // never edited from here, so it doesn't go into the draft.
      setDraft({ phone: form.phone, website: form.website });
    }
    setSheet(id);
  }

  async function saveSheet() {
    if (!sheet) return;
    if (sheet === "job") {
      const clean: Record<JobKey, string> = { role: "", company: "", place: "", start: "" };
      for (const k of JOB_KEYS) clean[k] = (draft[k] ?? "").trim();
      await commit({ ...form, job: clean });
    } else {
      await commit({
        ...form,
        phone: (draft.phone ?? "").trim() || form.phone,
        website: (draft.website ?? "").trim(),
      });
    }
    setSheet(null);
  }

  /* ── Skills ── */

  function addSkill() {
    const name = draftSkill.trim();
    if (!name) return;
    if (form.skills.length >= MAX_SKILLS) {
      haptic("error");
      toast.error(`You can list up to ${MAX_SKILLS} skills`);
      setSkillSheet(false);
      return;
    }
    if (form.skills.some((s) => s.toLowerCase() === name.toLowerCase())) {
      haptic("error");
      toast.error("That skill is already listed");
      return;
    }
    void commit({ ...form, skills: [...form.skills, name] });
    setDraftSkill("");
    setSkillSheet(false);
  }

  /** Only ever called from the confirm sheet, never straight off the pill. */
  function removeSkill(skill: string) {
    void commit({ ...form, skills: form.skills.filter((s) => s !== skill) });
  }

  const full = form.skills.length >= MAX_SKILLS;
  const hasJob = !!(form.job.role || form.job.company);

  if (!loaded) return <PageSkeleton title="Personal details" sections={2} />;

  return (
    <SettingsPage title="Personal details">
      {/* ── Contact — read-only values, one edit for the whole block.
          The email is fixed; it's what the account was created with. ── */}
      <SectionTitle>Contact</SectionTitle>
      <Group>
        <StaticRow title="Email" sub={form.email || "Not added"} right={form.email ? "Confirmed" : undefined} />
        <StaticRow title="Phone" sub={form.phone || "Not added"} />
        <StaticRow title="Website" sub={form.website || "Not added"} />
      </Group>
      <Button size="lg" block className="mt-3" onClick={() => openSheet("contact")}>
        Edit contact details
      </Button>

      {/* ── Work — the job said the way it appears on a profile, one row,
          one blue button. Four label/value rows read as a form you can't
          edit; this reads as a fact you can. ── */}
      <SectionTitle>Work</SectionTitle>
      <Group>
        <div className={ROW}>
          <span className="min-w-0 flex-1">
            {hasJob ? (
              <>
                <span className={TITLE}>
                  {[form.job.role, form.job.company].filter(Boolean).join(" · ")}
                </span>
                <span className={SUB}>
                  {form.job.place || "Location not added"}
                  {form.job.start ? (
                    <>
                      {" · "}
                      <span className="tabular-nums">since {form.job.start}</span>
                    </>
                  ) : null}
                </span>
              </>
            ) : (
              <span className={cn(SUB, "mt-0")}>No job added yet.</span>
            )}
          </span>
        </div>
      </Group>
      <Button size="lg" block className="mt-3" onClick={() => openSheet("job")}>
        Edit work details
      </Button>

      {/* ── Skills — plain pills on the canvas; each opens a confirm sheet.
          No X inside a pill: the tap itself is the affordance. ── */}
      <SectionTitle desc={`${form.skills.length} of ${MAX_SKILLS} used. A few topics that describe you.`}>
        Skills
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {form.skills.map((skill) => (
          <Chip
            key={skill}
            onClick={() => {
              haptic("light");
              setRemovingSkill(skill);
            }}
            className="min-h-10 hover:border-danger/45 hover:text-danger-text"
          >
            {skill}
          </Chip>
        ))}
        <Button
          size="sm"
          className="rounded-full px-4"
          disabled={full}
          onClick={() => {
            if (full) {
              toast.error(`You can list up to ${MAX_SKILLS} skills`);
              return;
            }
            haptic("light");
            setSkillSheet(true);
          }}
        >
          Add skill
        </Button>
      </div>
      {full ? (
        <Helper className="mt-3">
          {"That's all"} {MAX_SKILLS} {"— remove one to make room for another."}
        </Helper>
      ) : null}

      {/* ── Contact sheet: the two editable fields, one Save ── */}
      {sheet === "contact" ? (
        <Sheet
          title="Contact details"
          onClose={() => setSheet(null)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setSheet(null)}
              confirmLabel={saving ? "Saving…" : "Save"}
              disabled={saving}
              onConfirm={() => void saveSheet()}
            />
          }
        >
          <div>
            {CONTACT_FIELDS.map((f, i) => (
              <div key={f.key} className="px-1 py-3 sm:px-2 sm:py-4">
                <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {f.label}
                </p>
                <Input
                  aria-label={f.label}
                  value={draft[f.key] ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveSheet();
                    }
                  }}
                  type={f.type}
                  placeholder={f.placeholder}
                  autoFocus={i === 0}
                  className="h-11"
                />
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{f.hint}</p>
              </div>
            ))}
          </div>
        </Sheet>
      ) : null}

      {/* ── Job sheet ── */}
      {sheet === "job" ? (
        <Sheet
          title="Current job"
          onClose={() => setSheet(null)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setSheet(null)}
              confirmLabel={saving ? "Saving…" : "Save"}
              disabled={saving}
              onConfirm={() => void saveSheet()}
            />
          }
        >
          <div>
            {JOB_KEYS.map((k, i) => (
              <div key={k} className="px-1 py-3 sm:px-2 sm:py-4">
                <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {JOB_FIELDS[k].label}
                </p>
                <Input
                  aria-label={JOB_FIELDS[k].label}
                  value={draft[k] ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDraft((d) => ({ ...d, [k]: e.target.value }))
                  }
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveSheet();
                    }
                  }}
                  placeholder={JOB_FIELDS[k].placeholder}
                  autoFocus={i === 0}
                  className="h-11"
                />
              </div>
            ))}
          </div>
        </Sheet>
      ) : null}

      {/* ── Add skill ── */}
      {skillSheet ? (
        <Sheet
          title="Add a skill"
          description="Shown on your profile."
          onClose={() => {
            setSkillSheet(false);
            setDraftSkill("");
          }}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => {
                setSkillSheet(false);
                setDraftSkill("");
              }}
              confirmLabel="Add skill"
              onConfirm={addSkill}
              disabled={!draftSkill.trim()}
            />
          }
        >
          <div className="px-1 py-4 sm:px-2">
            <Input
              aria-label="New skill"
              value={draftSkill}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftSkill(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="TypeScript"
              autoFocus
            />
          </div>
        </Sheet>
      ) : null}

      {/* ── Remove skill ────────────────────────────────────────────
          Deliberately bodyless: Sheet focuses the first field it finds, and
          with no field in here the focus lands on a button, so the phone
          keyboard stays shut on a question that has nothing to type. ────── */}
      {removingSkill ? (
        <Sheet
          title={`Remove ${removingSkill}?`}
          onClose={() => setRemovingSkill(null)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setRemovingSkill(null)}
              confirmLabel="Remove"
              confirmVariant="danger"
              onConfirm={() => {
                removeSkill(removingSkill);
                setRemovingSkill(null);
                toast.error("Skill removed");
              }}
            />
          }
        />
      ) : null}
    </SettingsPage>
  );
}
