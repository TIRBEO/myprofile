import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { BlockedView, type Kind } from "./blocked-view";

/* ═══════════════════════════════════════════════════════════════════
   The interruption screen.

   The accounts app sends a closed account here with the block carried in the
   query string, signed `kind|eventId|until` with the shared
   BLOCK_REDIRECT_SECRET (HMAC-SHA256, base64url, first 32 chars — see
   apps/accounts/src/lib/blockSignature.ts). Five kinds arrive: `banned`,
   `suspended` and `deleted`, which are only worth reading, and
   `deletion_pending` and `deactivated`, both of which the screen can undo
   with a code to the sign-in address.

   The signature is defense-in-depth against forged scareware URLs, not an
   access grant: the API stays the real enforcement layer. A bad or missing
   sig simply sends the visitor to the normal login hand-off.

   `until` is part of the signed text even for the kinds that never carry one
   — the accounts app signs `kind|eventId|until` with an empty third field
   there, so an empty string is what has to go into the check here or every
   legitimate `deactivated` and `banned` hand-off would read as tampering.
   ═══════════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const SECRET = process.env.BLOCK_REDIRECT_SECRET || "tirbeo-block-redirect-dev";
const KINDS = new Set<Kind>(["banned", "suspended", "deleted", "deletion_pending", "deactivated"]);

function verifySig(kind: string, eventId: string, until: string, sig: string): boolean {
  if (!sig) return false;
  const want = createHmac("sha256", SECRET)
    .update(`${kind}|${eventId}|${until}`)
    .digest("base64url")
    .slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const kind = String(q.blocked ?? "");
  const eventId = String(q.eventId ?? "");
  const reason = String(q.reason ?? "");
  const until = String(q.until ?? "");
  const sig = String(q.sig ?? "");

  if (!KINDS.has(kind as Kind) || !verifySig(kind, eventId, until, sig)) redirect("/login");

  return (
    <BlockedView
      kind={kind as Kind}
      eventId={eventId || null}
      reason={reason || null}
      until={until || null}
    />
  );
}
