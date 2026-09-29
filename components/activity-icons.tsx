"use client";

/* ═══════════════════════════════════════════════════════════════════
   The pictures a change is known by

   The log and a single change's page draw the same mark for the same
   kind of edit, so the two screens read as one thing. They're drawn at
   the list size; a page that leads with one scales the whole thing up
   with one class rather than keeping a second, larger copy of the map.
   ═══════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import type { ChangeKind } from "@/lib/activity-log";
import {
  AtSign,
  Download,
  Fingerprint,
  KeyRound,
  Languages,
  LifeBuoy,
  Link2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export const CHANGE_ICONS: Record<ChangeKind, ReactNode> = {
  account: <UserRound className="size-[18px]" strokeWidth={1.8} />,
  email: <Mail className="size-[18px]" strokeWidth={1.8} />,
  "recovery-email": <LifeBuoy className="size-[18px]" strokeWidth={1.8} />,
  phone: <Phone className="size-[18px]" strokeWidth={1.8} />,
  username: <AtSign className="size-[18px]" strokeWidth={1.8} />,
  password: <KeyRound className="size-[18px]" strokeWidth={1.8} />,
  "two-factor": <ShieldCheck className="size-[18px]" strokeWidth={1.8} />,
  passkey: <Fingerprint className="size-[18px]" strokeWidth={1.8} />,
  visibility: <Lock className="size-[18px]" strokeWidth={1.8} />,
  language: <Languages className="size-[18px]" strokeWidth={1.8} />,
  "connected-app": <Link2 className="size-[18px]" strokeWidth={1.8} />,
  "data-request": <Download className="size-[18px]" strokeWidth={1.8} />,
};
