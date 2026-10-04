"use client";

/* ═══════════════════════════════════════════════════════════════════
   The deleted tray

   Not the account's record: Tirbeo has no user content — no notes, no
   albums, no bookmarks — so there is nothing server-side that a deletion
   could have removed, and nothing that could be restored. Until a content
   model exists, this tray is a stand-in that lives in this browser, and the
   page that shows it should say so rather than imply the account is keeping
   a recovery shelf it doesn't have.

   Kept separate from lib/your-activity, which IS the account's real record.
   ═══════════════════════════════════════════════════════════════════ */

const STORE = "tirbeo:your-activity:deleted";

/** How long deleted content stays recoverable. */
export const KEEP_DAYS = 30;
export const MAX_DELETED = 12;

export type DeletedItem = {
  id: string;
  kind: string;
  label: string;
  deletedAt: number;
};

const DAY = 24 * 60 * 60_000;

function seedDeleted(): DeletedItem[] {
  const now = Date.now();
  const rows: [offset: number, kind: string, label: string][] = [
    [2 * DAY, "Note", "Upper Mustang trip plan"],
    [5 * DAY, "Bookmark", "Himalayan Frontiers trail guide"],
    [9 * DAY, "Search", "best time to visit Phoksundo"],
    [13 * DAY, "File", "photostreet-roll-frame-6.jpg"],
    [22 * DAY, "Album", "Boudha, 12 photos"],
    [28 * DAY, "Draft", "Reading list, second pass"],
  ];
  return rows.map(([offset, kind, label]) => ({
    id: `${(now - offset).toString(36)}-${kind.toLowerCase()}`,
    kind,
    label,
    deletedAt: now - offset,
  }));
}

export function readDeleted(): DeletedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) {
      const seeded = seedDeleted();
      writeDeleted(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<DeletedItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is DeletedItem =>
          typeof item?.label === "string" && typeof item?.deletedAt === "number",
      )
      .sort((a, b) => b.deletedAt - a.deletedAt)
      .slice(0, MAX_DELETED);
  } catch {
    return [];
  }
}

function writeDeleted(items: DeletedItem[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(items.slice(0, MAX_DELETED)));
  } catch {
    /* private mode — the tray simply isn't kept between visits */
  }
}

/** Whole days before an item leaves the tray for good, never below zero. */
export function daysLeft(item: DeletedItem): number {
  const purgeAt = item.deletedAt + KEEP_DAYS * DAY;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / DAY));
}

/** One tray item by its id, for the page that shows nothing but it. */
export function findDeleted(id: string | undefined): DeletedItem | null {
  if (!id) return null;
  return readDeleted().find((item) => item.id === id) ?? null;
}

/** Takes one item out of the tray. Restoring puts it back where it was;
    deleting it here ends it without waiting out the clock. */
export function removeFromTray(id: string): DeletedItem[] {
  const next = readDeleted().filter((item) => item.id !== id).sort((a, b) => b.deletedAt - a.deletedAt);
  writeDeleted(next);
  return next;
}
