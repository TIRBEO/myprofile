"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

/* ═══════════════════════════════════════════════════════════════════
   Where it happened

   One container, one picture, no words. Everything that explains the
   pin — the place, the numbers, how it was found — is text on the page
   above, so the map itself is only ever a map. Tiles come from Mapbox
   GL, and the pin is a plain coordinate: a record whose place nobody
   knows never renders this at all.
   ═══════════════════════════════════════════════════════════════════ */

/* A public (pk.) token is safe to ship to the browser; set NEXT_PUBLIC_MAPBOX_TOKEN
   to override it without a code change. */
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoiYmlzaG51ZXA0bmUiLCJhIjoiY211ZWZxejB3MDRiZjMwcXlyOHBsaTlnMyJ9.aD7mPt56FH-9KDSUC6TxQQ";

const STYLE = "mapbox://styles/mapbox/dark-v11";

export function MapCard({ coords, label }: { coords: [number, number]; label: string }) {
  const [lat, lng] = coords;
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
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
      })
      .catch(() => {
        /* token/billing/network missing — leave the plate empty rather than crash the page */
      });

    return () => {
      cancelled = true;
      marker?.remove();
      map?.remove();
    };
  }, [lat, lng]);

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
