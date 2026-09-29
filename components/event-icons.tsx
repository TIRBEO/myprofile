"use client";

/* ═══════════════════════════════════════════════════════════════════
   The pictures a sign-in is known by

   Same mark for the same kind of event whether it's a line in the log or
   the page it opens, so the two screens read as one thing. Drawn at list
   size; the page that leads with one scales the glyph up with a single
   class instead of keeping a second copy of the map.
   ═══════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import type { EventKind } from "@/lib/login-activity";
import { Fingerprint, KeyRound, LogIn, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";

export const EVENT_ICONS: Record<EventKind, ReactNode> = {
  signin: <LogIn className="size-[18px]" strokeWidth={1.8} />,
  signout: <LogOut className="size-[18px]" strokeWidth={1.8} />,
  failed: <ShieldAlert className="size-[18px]" strokeWidth={1.8} />,
  password: <KeyRound className="size-[18px]" strokeWidth={1.8} />,
  "two-factor": <ShieldCheck className="size-[18px]" strokeWidth={1.8} />,
  passkey: <Fingerprint className="size-[18px]" strokeWidth={1.8} />,
};
