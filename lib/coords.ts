/* ═══════════════════════════════════════════════════════════════════
   Coordinates a record carries

   The account's rows keep a place name, and some keep the point the edge
   resolved that address to. Two numbers, or nothing — a pin at (0,0) would
   put the map in the sea, so a pair that isn't a point on Earth reads as
   "no map", the same as a row with no coordinates at all.
   ═══════════════════════════════════════════════════════════════════ */

export function coordsOf(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lat, lng] = value;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}
