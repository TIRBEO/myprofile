"use client";

/* ═══════════════════════════════════════════════════════════════════
   Where it happened

   One container, one picture, no words. Everything that explains the
   pin — the place, the numbers, how it was found — is text on the page
   above, so the map itself is only ever a map. Tiles come from
   OpenStreetMap: no key, no account, and the pin is a plain coordinate.
   ═══════════════════════════════════════════════════════════════════ */

/** Height of the embed's own footer strip, which the frame cuts away. */
const CROP = 44;

/** Half-width of the visible box in degrees — wide enough to place a city,
    which is all an address-derived pin can honestly claim. */
const SPAN = 0.01;

export function MapCard({ coords, label }: { coords: [number, number]; label: string }) {
  const [lat, lng] = coords;
  const bbox = encodeURIComponent(
    `${lng - SPAN},${lat - SPAN * 0.6},${lng + SPAN},${lat + SPAN * 0.6}`,
  );
  const tiles = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_36px_-24px_rgb(0_0_0/0.4)]">
      {/* The embed hangs a strip of its own housekeeping off the bottom —
          "Report a problem", the OSM heart, the donation link. It's the
          provider's furniture, not the map's, so the frame is cut 44px short
          of it and the tiles run to the edge. */}
      <div className="relative h-[220px] overflow-hidden sm:h-[260px]">
        <iframe
          src={tiles}
          title={`Map showing ${label}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="map-tiles absolute inset-x-0 top-0 block w-full border-0"
          style={{ height: `calc(100% + ${CROP}px)` }}
        />
      </div>
    </figure>
  );
}
