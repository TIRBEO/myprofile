"use client";

import { useState } from "react";
import { Helper, SheetGroup, StaticRow } from "@/components/settings-shell";
import { Sheet, SheetActions, SheetOption } from "@/components/ig-ui";
import { EXPORT_FORMATS, type ExportFormat } from "./export-format";

/* ═══════════════════════════════════════════════════════════════════
   The format sheet

   Two options, one line each, and a confirm that is the only thing that writes
   a request on the account. Opening this sheet and dismissing it — the Cancel
   button, Escape, the drag down, the backdrop — leaves nothing behind, because
   the record is made by the confirm, not by the asking.

   `defaultFormat` is what the button starts on: the download page defaults to
   JSON (what the archive always was), and a history row defaults to the format
   that row was asked for, so re-downloading one gives you the same kind of file
   again rather than a surprise.
   ═══════════════════════════════════════════════════════════════════ */

export function FormatSheet({
  onClose,
  onConfirm,
  busy,
  defaultFormat = "json",
  title = "Which format should your file be?",
  description = "Both hold the same records. The difference is who is meant to read them.",
  confirmPrefix = "Write the",
}: {
  onClose: () => void;
  onConfirm: (format: ExportFormat) => void;
  busy: boolean;
  defaultFormat?: ExportFormat;
  title?: string;
  description?: string;
  confirmPrefix?: string;
}) {
  const [chosen, setChosen] = useState<ExportFormat>(defaultFormat);
  const chosenLabel = EXPORT_FORMATS.find((option) => option.value === chosen)?.label ?? "JSON archive";

  return (
    <Sheet
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onClose}
          confirmLabel={`${confirmPrefix} ${chosenLabel.toLowerCase()}`}
          confirmVariant="primary"
          loading={busy}
          onConfirm={() => onConfirm(chosen)}
        />
      }
    >
      <div className="-mx-4 list-divide sm:-mx-5" role="radiogroup" aria-label="File format">
        {EXPORT_FORMATS.map((option) => (
          <SheetOption
            key={option.value}
            selected={option.value === chosen}
            description={option.sub}
            onClick={() => setChosen(option.value)}
          >
            {option.label}
          </SheetOption>
        ))}
      </div>

      <SheetGroup>
        <StaticRow
          title="What the file will hold"
          sub="Every part listed on your data page, as it stands the moment you confirm. Secrets stay out of it either way."
        />
      </SheetGroup>

      <Helper className="mt-4">
        Nothing is written down until you confirm. A request you cancel leaves no record on your
        account.
      </Helper>
    </Sheet>
  );
}
