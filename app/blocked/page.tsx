import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { BlockedGate } from "./blocked-gate";
import type { Kind } from "./blocked-view";

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
   access grant: the API stays the real enforcement layer. A bad or missing one
   costs the visitor the details that came in the URL, and on a kind with
   nothing else to show, the login hand-off; a kind this screen can undo is
   never turned away for it, because that flow authenticates by emailed code.

   `until` is part of the signed text even for the kinds that never carry one
   — the accounts app signs `kind|eventId|until` with an empty third field
   there, so an empty string is what has to go into the check here or every
   legitimate `deactivated` and `banned` hand-off would read as tampering.
   ═══════════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const SECRET = process.env.BLOCK_REDIRECT_SECRET || "tirbeo-block-redirect-dev";
const KINDS = new Set<Kind>(["banned", "suspended", "deleted", "deletion_pending", "deactivated"]);

/** The kinds this screen can undo — keep in step with RECOVERY in
    blocked-view.tsx, which holds the two buttons. An unverified hand-off is
    only ever shown for these, because proving the account is theirs is the
    flow's own first step and no claim from the URL is needed to offer it. */
const RECOVERABLE = new Set<Kind>(["deletion_pending", "deactivated"]);

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

  if (!KINDS.has(kind as Kind)) redirect("/login");

  const verified = verifySig(kind, eventId, until, sig);
  /* A hand-off that fails its signature is not the same thing as an account
     with nothing wrong with it — the signature only proves the link was
     written by the accounts app, and both sides read the secret from their own
     deployment settings, so one project missing BLOCK_REDIRECT_SECRET breaks
     it for every blocked visitor. Bouncing them to /login from here is the
     worst possible answer: the login is exactly what refused them, so they
     arrive back on this page and the two screens alternate forever.

     `deletion_pending` and `deactivated` are the kinds this screen can undo,
     and the undo proves the visitor owns the account with a code to the sign-in
     address — a client-side HMAC adds nothing to that. So an unverified
     hand-off still gets the recovery flow, minus every word the URL supplied:
     a reason, a date and an event reference are facts about the account, and
     facts we cannot vouch for are not shown as though we could.

     The read-only verdicts (banned, suspended, deleted) offer nothing but those
     untrusted facts, so they keep bouncing. */
  if (!verified) {
    if (sig) {
      // The one failure mode that is invisible from the outside: the two
      // projects disagreeing about the secret. Say so in the request log.
      console.warn("[BLOCK-SIG] hand-off signature rejected — BLOCK_REDIRECT_SECRET must match accounts' VITE_BLOCK_REDIRECT_SECRET");
    }
    if (!RECOVERABLE.has(kind as Kind)) redirect("/login");
  }

  return (
    <BlockedGate
      kind={kind as Kind}
      eventId={(verified && eventId) || null}
      reason={(verified && reason) || null}
      until={(verified && until) || null}
      verifiedSignature={verified}
    />
  );
}
