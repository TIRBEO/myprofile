"use client";

import { useState } from "react";
import { RandomAvatar } from "@/components/random-avatar";
import { cn } from "@/components/ig-ui";

/* ═══════════════════════════════════════════════════════════════════
   The face of the account

   The same three sizes — a row's 32px, the nav's 40px, a profile's 96px —
   drawn the same way everywhere it appears, so a page you've never been to
   still shows the same picture as the one you just left.

   An uploaded photo wins; without one, the handle seeds the cartoon face,
   which is stable per handle rather than random per render.
   ═══════════════════════════════════════════════════════════════════ */

export function ProfilePicture({
  photo,
  seed,
  name,
  size = 40,
  ring = false,
  className,
}: {
  photo?: string | null;
  /** The handle — what the fallback face is drawn from. */
  seed: string;
  name?: string;
  size?: number;
  /** A hairline of page background around it, for when it sits on a photo. */
  ring?: boolean;
  className?: string;
}) {
  /* A provider photo can be blocked by the browser before it paints, and a
     dead <img> is a black circle — the seeded face is the honest fallback. */
  const [photoBroken, setPhotoBroken] = useState(false);

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3",
        ring && "ring-[3px] ring-bg",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photo && !photoBroken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name ? `${name}'s photo` : "Your photo"}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setPhotoBroken(true)}
        />
      ) : (
        <RandomAvatar seed={seed} className="size-full" />
      )}
    </span>
  );
}
