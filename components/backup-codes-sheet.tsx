"use client";

import { useEffect, useRef, useState } from "react";
import { cn, PILL_BASE, PILL_FILL, Sheet } from "@/components/ig-ui";
import { type CodeSet, downloadCodesPdf, markSeen } from "@/lib/backup-codes";
import { useToast } from "@/lib/use-toast";
import { haptic } from "@/lib/haptics";
import { Check, Copy, Download } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Backup codes reveal sheet

   The only place a set of backup codes is ever readable, and it is
   readable once: closing it, or leaving the page it sits on, files the
   set away for good. Used by Two-factor right after setup and by the
   backup codes page after a fresh generation.
   ═══════════════════════════════════════════════════════════════════ */

export function BackupCodesSheet({
  set,
  stamp,
  onDone,
}: {
  set: CodeSet;
  stamp: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  function dismiss() {
    markSeen(set.id);
    onDone();
  }

  // Leaving without closing the sheet still costs the codes. The timer is
  // cancelled by an immediate remount, so React's dev double-render doesn't
  // file the set away before it is ever shown.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    return () => {
      pending.current = setTimeout(() => markSeen(set.id), 0);
    };
  }, [set.id]);

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
      onClose={dismiss}
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
