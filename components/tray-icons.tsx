"use client";

/* ═══════════════════════════════════════════════════════════════════
   The pictures a deleted thing is known by

   The tray and one item's page draw the same mark for the same kind of
   thing. Anything the app hasn't got a picture for yet falls back to the
   bin, so an unfamiliar kind still reads as a deleted item rather than
   nothing at all.
   ═══════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { Bookmark, File, Images, Search, StickyNote, Trash2 } from "lucide-react";

const KIND_ICON: Record<string, ReactNode> = {
  Note: <StickyNote className="size-[18px]" strokeWidth={1.8} />,
  Draft: <File className="size-[18px]" strokeWidth={1.8} />,
  Bookmark: <Bookmark className="size-[18px]" strokeWidth={1.8} />,
  Search: <Search className="size-[18px]" strokeWidth={1.8} />,
  File: <File className="size-[18px]" strokeWidth={1.8} />,
  Album: <Images className="size-[18px]" strokeWidth={1.8} />,
};

export function trayGlyph(kind: string): ReactNode {
  return KIND_ICON[kind] ?? <Trash2 className="size-[18px]" strokeWidth={1.8} />;
}
