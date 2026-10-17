import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { BlockedView } from "./blocked-view";

/* ═══════════════════════════════════════════════════════════════════
   The interruption screen.

   The accounts app sends banned/suspended/deleted visitors here with the
   block carried in the query string, signed `kind|eventId|until` with the
   shared BLOCK_REDIRECT_SECRET (HMAC-SHA256, base64url, first 32 chars —
   see apps/accounts/src/lib/blockSignature.ts). The signature is
   defense-in-depth against forged scareware URLs, not an access grant: the
   API stays the real enforcement layer. A bad or missing sig simply sends
   the visitor to the normal login hand-off.
   ═══════════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const SECRET = process.env.BLOCK_REDIRECT_SECRET || "tirbeo-block-redirect-dev";
const KINDS = new Set(["banned", "suspended", "deleted"]);

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

  if (!KINDS.has(kind) || !verifySig(kind, eventId, until, sig)) redirect("/login");

  return (
    <BlockedView
      kind={kind as "banned" | "suspended" | "deleted"}
      eventId={eventId || null}
      reason={reason || null}
      until={until || null}
    />
  );
}
