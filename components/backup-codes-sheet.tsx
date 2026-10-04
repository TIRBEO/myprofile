"use client";

import { useState } from "react";
import { cn, PILL_BASE, PILL_FILL, Sheet } from "@/components/ig-ui";
import { downloadCodesPdf } from "@/lib/backup-codes";
import type { RevealedCodes } from "@/lib/two-factor";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { Check, Copy, Download } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Backup codes reveal sheet

   The account service prints a set once, in the reply that minted it, and
   keeps only the hashes after that. So this sheet is the one moment a set
   is readable anywhere: it holds the codes for as long as it is open, and
   when the parent drops it they are gone from the browser too. Nothing is
   written to storage here — there is nowhere to write them back from.
   ═══════════════════════════════════════════════════════════════════ */

export function BackupCodesSheet({
  set,
  stamp,
  onDone,
}: {
  set: RevealedCodes;
  stamp: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  function copyAll() {
    navigator.clipboard
      .writeText(set.codes.join("\n"))
      .then(() => {
        setCopied(true);
        haptic("success");
        toast.success("Codes copied");
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => toast.error("Couldn't reach the clipboard"));
  }

  function download() {
    downloadCodesPdf(set, stamp);
    toast.success("PDF downloaded");
  }

  return (
    <Sheet
      title="Your backup codes"
      description="Save these now. Once you close this, they can't be shown again."
      onClose={onDone}
      footer={
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
          <button
            type="button"
            onClick={download}
            className={cn(PILL_BASE, PILL_FILL.primary)}
          >
            <Download className="size-[18px]" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={copyAll}
            className={cn(PILL_BASE, PILL_FILL.outline)}
          >
            {copied ? <Check className="size-[18px]" /> : <Copy className="size-[18px]" />}
            {copied ? "Copied" : "Copy all"}
          </button>
        </div>
      }
    >
      <div className="-mx-4 px-5 py-4 sm:-mx-5">
        <div className="grid grid-cols-2 gap-2">
          {set.codes.map((code) => (
            <div
              key={code}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-center font-mono text-[14px] font-semibold tracking-[0.04em]"
            >
              {code}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Each code works once, and signing in without your app is the only thing they're good for.
        </p>
      </div>
    </Sheet>
  );
}
