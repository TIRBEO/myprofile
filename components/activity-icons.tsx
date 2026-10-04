"use client";

/* ═══════════════════════════════════════════════════════════════════
   The pictures a change is known by

   The log and a single change's page draw the same mark for the same kind of
   edit, so the two screens read as one thing. They're drawn at the list size;
   a page that leads with one scales the whole thing up with one class rather
   than keeping a second, larger copy of the map.

   The server writes kinds in its own vocabulary, which grows as features do,
   so a kind is matched on what it says rather than looked up in a fixed list.
   Anything unrecognised gets the plain mark — a log that invented a picture
   for a kind it had never seen would be guessing.
   ═══════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
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
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const ICONS: [match: RegExp, icon: ReactNode][] = [
  [/password/i, <KeyRound className="size-[18px]" strokeWidth={1.8} />],
  [/2fa|totp|two.?factor|backup.?code/i, <ShieldCheck className="size-[18px]" strokeWidth={1.8} />],
  [/passkey|webauthn/i, <Fingerprint className="size-[18px]" strokeWidth={1.8} />],
  [/recovery/i, <LifeBuoy className="size-[18px]" strokeWidth={1.8} />],
  [/email/i, <Mail className="size-[18px]" strokeWidth={1.8} />],
  [/phone/i, <Phone className="size-[18px]" strokeWidth={1.8} />],
  [/username/i, <AtSign className="size-[18px]" strokeWidth={1.8} />],
  [/language|locale/i, <Languages className="size-[18px]" strokeWidth={1.8} />],
  [/visibility|privacy|consent/i, <Lock className="size-[18px]" strokeWidth={1.8} />],
  [/merge|oauth|integrat|app_disconnect/i, <Link2 className="size-[18px]" strokeWidth={1.8} />],
  [/export|archive|download/i, <Download className="size-[18px]" strokeWidth={1.8} />],
  [/ban|suspend|restrict|appeal/i, <Lock className="size-[18px]" strokeWidth={1.8} />],
  [/created|signup|profile|theme|preference|setting/i, <UserRound className="size-[18px]" strokeWidth={1.8} />],
];

export function changeIcon(kind: string): ReactNode {
  return ICONS.find(([match]) => match.test(kind))?.[1] ?? (
    <Pencil className="size-[18px]" strokeWidth={1.8} />
  );
}
