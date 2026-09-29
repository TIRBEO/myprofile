/* ═══════════════════════════════════════════════════════════════════
   Places

   A record says "Kathmandu, Nepal" and nothing else — the map on a
   detail page needs a latitude and a longitude, so the pairing lives
   here rather than being repeated on every row. A place that isn't in
   the table has no coordinates to invent: the caller leaves the map out
   and shows the words it already had.
   ═══════════════════════════════════════════════════════════════════ */

export type Place = {
  location: string;
  coords: [lat: number, lng: number];
};

const PLACES: Place[] = [
  { location: "Kathmandu, Nepal", coords: [27.7172, 85.324] },
  { location: "Lalitpur, Nepal", coords: [27.6587, 85.3247] },
  { location: "Bhaktapur, Nepal", coords: [27.6722, 85.4298] },
  { location: "Pokhara, Nepal", coords: [28.2096, 83.9856] },
  { location: "Chitwan, Nepal", coords: [27.5955, 84.4042] },
  { location: "Biratnagar, Nepal", coords: [26.4604, 87.2715] },
  { location: "Butwal, Nepal", coords: [27.6969, 83.4536] },
  { location: "Lagos, Nigeria", coords: [6.5244, 3.3792] },
  { location: "New Delhi, India", coords: [28.6139, 77.209] },
];

/** Where a place is, when this table knows it. */
export function placeFor(location: string): Place | null {
  return PLACES.find((place) => place.location === location) ?? null;
}
