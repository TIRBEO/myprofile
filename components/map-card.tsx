"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

/* ═══════════════════════════════════════════════════════════════════
   Where it happened

   One container, one picture, no words. Everything that explains the
   pin — the place, the numbers, how it was found — is text on the page
   above, so the map itself is only ever a map. Tiles come from Mapbox
   GL; if the token can't serve (unset, wrong, or billing not yet active)
   the same coordinates drop to the keyless OpenStreetMap embed rather
   than showing an empty plate. Either way the pin is a plain coordinate,
   and a record whose place nobody knows never renders this at all.
   ═══════════════════════════════════════════════════════════════════ */

/* A public (pk.) token is safe to ship to the browser; set NEXT_PUBLIC_MAPBOX_TOKEN
   to override it without a code change. */
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoiYmlzaG51ZXA0bmUiLCJhIjoiY211ZWZxejB3MDRiZjMwcXlyOHBsaTlnMyJ9.aD7mPt56FH-9KDSUC6TxQQ";

const STYLE = "mapbox://styles/mapbox/dark-v11";

/** Half-width of the OSM fallback box in degrees — wide enough to place a
    city, which is all an address-derived pin can honestly claim. */
const SPAN = 0.01;

export function MapCard({ coords, label }: { coords: [number, number]; label: string }) {
  const [lat, lng] = coords;
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (fallback || !host.current) return;
    let map: import("mapbox-gl").Map | undefined;
    let marker: import("mapbox-gl").Marker | undefined;
    let cancelled = false;

    // mapbox-gl touches window at module scope, so it loads only on the client.
    import("mapbox-gl")
      .then((mod) => {
        if (cancelled || !host.current) return;
        const mapboxgl = mod.default;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        map = new mapboxgl.Map({
          container: host.current,
          style: STYLE,
          center: [lng, lat],
          zoom: 11,
          attributionControl: true,
          // A map embedded in a scrolling page must never steal the wheel.
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
        });
        marker = new mapboxgl.Marker({ color: "#0a84ff" })
          .setLngLat([lng, lat])
          .addTo(map);
        // A bad or unbilled token fails here, once the style request comes back.
        map.on("error", () => {
          if (!cancelled) setFallback(true);
        });
      })
      .catch(() => setFallback(true));

    return () => {
      cancelled = true;
      marker?.remove();
      map?.remove();
    };
  }, [lat, lng, fallback]);

  if (fallback) {
    const bbox = encodeURIComponent(
      `${lng - SPAN},${lat - SPAN * 0.6},${lng + SPAN},${lat + SPAN * 0.6}`,
    );
    const tiles = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
    return (
      <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_36px_-24px_rgb(0_0_0/0.4)]">
        <div className="relative h-[220px] overflow-hidden sm:h-[260px]">
          <iframe
            src={tiles}
            title={`Map showing ${label}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="map-tiles absolute inset-x-0 top-0 block w-full border-0"
            style={{ height: "calc(100% + 44px)" }}
          />
        </div>
      </figure>
    );
  }

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_36px_-24px_rgb(0_0_0/0.4)]">
      <div
        ref={host}
        className="h-[220px] w-full sm:h-[260px]"
        role="img"
        aria-label={`Map showing ${label}`}
      />
    </figure>
  );
}
