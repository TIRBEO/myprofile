"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import {
  Button,
  cn,
  Input,
  Sheet,
  SheetActions,
} from "@/components/ig-ui";
import {
  Helper,
  ROW,
  SectionTitle,
  SettingsPage,
  StaticRow,
  SUB,
  TITLE,
} from "@/components/settings-shell";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";

/* ═══════════════════════════════════════════════════════════════════
   Personal details.

   Two contained panels and one tag cloud, each editable block stated as
   read-only values with a single big blue action underneath — never a
   row-level chevron competing with a heading-level Edit. Phone and
   website share one sheet, so there is one edit gesture for contact and
   one for work. Skills are plain pills; tapping one asks before it goes.
   Everything saves to localStorage as it changes.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:personal-details";
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
  email: "a.shrestha97@gmail.com",
  phone: "",
  website: "tirbeo.app",
  job: { role: "Product engineer", company: "Tirbeo", place: "Kathmandu, Nepal", start: "2022" },
  skills: ["TypeScript", "React", "Design systems"],
};

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

export default function PersonalDetailsPage() {
  const [form, setForm] = useState<Details>(EMPTY);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [skillSheet, setSkillSheet] = useState(false);
  const [draftSkill, setDraftSkill] = useState("");
  const [removingSkill, setRemovingSkill] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const contact = (saved.contact ?? {}) as Record<string, string | undefined>;
      const job = (saved.job ?? firstEntry(saved.work)) as Record<string, string | undefined>;
      setForm({
        email: str(saved.email ?? contact.email),
        phone: str(saved.phone ?? contact.phone),
        website: str(saved.website ?? contact.website),
        job: {
          role: str(job.role),
          company: str(job.company),
          place: str(job.place),
          start: str(job.start),
        },
        skills: Array.isArray(saved.skills)
          ? saved.skills
              .map((s) => (typeof s === "string" ? s : str((s as { name?: string }).name)))
              .filter(Boolean)
          : [],
      });
    } catch {
      /* unreadable draft — keep the defaults */
    }
  }, []);

  function commit(next: Details) {
    setForm(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* private mode — the change still holds for this session */
    }
  }

  /* ── Sheets ── */

  function openSheet(id: SheetId) {
    if (id === "job") {
      const next: Record<string, string> = {};
      for (const k of JOB_KEYS) next[k] = form.job[k] ?? "";
      setDraft(next);
    } else {
      setDraft({ phone: form.phone, website: form.website });
    }
    setSheet(id);
  }

  function saveSheet() {
    if (!sheet) return;
    if (sheet === "job") {
      const clean: Record<JobKey, string> = { role: "", company: "", place: "", start: "" };
      for (const k of JOB_KEYS) clean[k] = (draft[k] ?? "").trim();
      commit({ ...form, job: clean });
    } else {
      commit({
        ...form,
        phone: (draft.phone ?? "").trim(),
        website: (draft.website ?? "").trim(),
      });
    }
    setSheet(null);
    toast.success("Saved");
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
    commit({ ...form, skills: [...form.skills, name] });
    setDraftSkill("");
    setSkillSheet(false);
  }

  /** Only ever called from the confirm sheet, never straight off the pill. */
  function removeSkill(skill: string) {
    commit({ ...form, skills: form.skills.filter((s) => s !== skill) });
  }

  const full = form.skills.length >= MAX_SKILLS;
  const hasJob = !!(form.job.role || form.job.company);

  return (
    <SettingsPage title="Personal details">
      {/* ── Contact — read-only values, one edit for the whole block.
          The email is fixed; it's what the account was created with. ── */}
      <SectionTitle>Contact</SectionTitle>
      <div className="grouped list-divide">
        <StaticRow title="Email" sub={form.email || "Not added"} right="Confirmed" />
        <StaticRow title="Phone" sub={form.phone || "Not added"} />
        <StaticRow title="Website" sub={form.website || "Not added"} />
      </div>
      <Button size="lg" block className="mt-3" onClick={() => openSheet("contact")}>
        Edit contact details
      </Button>

      {/* ── Work — the job said the way it appears on a profile, one row,
          one blue button. Four label/value rows read as a form you can't
          edit; this reads as a fact you can. ── */}
      <SectionTitle>Work</SectionTitle>
      <div className="grouped">
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
      </div>
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
          <button
            key={skill}
            type="button"
            onClick={() => {
              haptic("light");
              setRemovingSkill(skill);
            }}
 className="min-h-10 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13.5px] font-medium outline-none transition-colors hover:border-danger/45 hover:text-danger-text"
          >
            {skill}
          </button>
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
              confirmLabel="Save"
              onConfirm={saveSheet}
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
                      saveSheet();
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
              confirmLabel="Save"
              onConfirm={saveSheet}
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
                      saveSheet();
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

/* ── Helpers ─────────────────────────────────────────────────────── */

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function firstEntry(v: unknown): Record<string, unknown> {
  return Array.isArray(v) && v.length > 0 ? (v[0] as Record<string, unknown>) : {};
}
