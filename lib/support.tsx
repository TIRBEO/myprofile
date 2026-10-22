"use client";

/* ═══════════════════════════════════════════════════════════════════
   "Email support" — one door, from every screen that can go wrong

   A person reporting a problem should not have to retype what the app already
   knows, and should not have to read it back either. So the sheet opens on the
   one thing they came to do — the message box — and the record's own facts sit
   under it, quiet, in the order they matter: what happened, when, on what.
   The reference is the last line, not the first: it is only needed when
   somebody replies.

   What they type goes to the account as a support request: a row in the event
   ledger, a copy in their inbox, and a copy for the people on the other end,
   all three quoting the same reference. The mail-app route stays, underneath —
   some days a mailbox with the thread in it is what someone wants.
   ═══════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Button, Field, Sheet, SheetActions, Textarea } from "@/components/ig-ui";
import { ApiError, apiJson } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";
import { trackError } from "@/lib/telemetry";

export const SUPPORT_EMAIL = "support@tirbeo.com";

/** Mirrors the desk's own floor and ceiling (`features/support/requests.ts`),
    so the send button tells the truth before the server has to. */
export const MIN_MESSAGE = 20;
export const MAX_MESSAGE = 4000;

/** One fact about the record. The callers write `Label: value`; the sheet sets
    the label in a column so the values line up, and the mail sends the plain
    line back. */
type Fact = { label: string | null; value: string };

function factsOf(lines: (string | null | undefined | false)[], ref?: string | null): Fact[] {
  const kept = lines
    .filter(Boolean)
    .map((line) => String(line))
    // One reference, at the end, whatever the caller's own list carried — the
    // record screens already show the code above the pill, and a raw row id is
    // a query parameter, not a fact anybody can read aloud.
    .filter((line) => !/^(event reference|record id)\s*:/i.test(line));
  return [...kept, ...(ref ? [`Reference: ${ref}`] : [])].map((line) => {
    const at = line.indexOf(":");
    return at > 0 && at <= 24
      ? { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
      : { label: null, value: line };
  });
}

const asText = (facts: Fact[]): string[] =>
  facts.map((fact) => (fact.label ? `${fact.label}: ${fact.value}` : fact.value));

export function supportMailto(
  subject: string,
  lines: (string | null | undefined | false)[],
  note?: string,
  ref?: string | null,
): string {
  const facts = asText(factsOf(lines, ref)).join("\n");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const body = [
    "Tirbeo support,",
    "",
    "I'm writing about the account screen below.",
    "",
    facts,
    "",
    `Reported: ${new Date().toISOString()}`,
    `Browser: ${ua}`,
    "",
    "My note:",
    "---",
    ...(note ? ["", note] : []),
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The text-pill every blocked/status page carries.
 *
 *  `mailOnly` is for the screens that know they have no account to file
 *  against — signed out, or an account that will not answer. There the sheet
 *  would be a form that can only fail, so the pill goes straight to the mail
 *  app with the same details attached. */
export function SupportPill({
  subject,
  lines,
  refCode,
  label = "Email support",
  mailOnly = false,
}: {
  subject: string;
  lines: (string | null | undefined | false)[];
  /** The code that answers for this record — shown once, last, and quoted in
      the mail so a reply finds the row. */
  refCode?: string | null;
  label?: string;
  mailOnly?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  /** The filing did not go through. Not a dead end — the note is still here,
      and the one door that cannot fail is the mail app on this device. */
  const [unfiled, setUnfiled] = useState(false);

  const trimmed = message.trim();
  const short = trimmed.length < MIN_MESSAGE;
  const attached = factsOf(lines, refCode);

  if (mailOnly) {
    return (
      <a href={supportMailto(subject, lines, undefined, refCode)} className="btn btn-secondary">
        {label}
      </a>
    );
  }

  async function send() {
    setSending(true);
    try {
      const filed = await apiJson<{ ok: boolean; ref: string }>("/api/support/request", {
        method: "POST",
        body: JSON.stringify({ subject, message: trimmed }),
      });
      setRef(filed.ref);
      setUnfiled(false);
      haptic("success");
      toast.success(`Sent — quote ${filed.ref} if you write again`);
    } catch (err) {
      haptic("error");
      trackError("support.send", err);
      setUnfiled(true);
      toast.error(
        err instanceof ApiError && err.message ? err.message : "The message couldn't be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  const close = () => {
    setOpen(false);
    setRef(null);
  };

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <Sheet
          title={ref ? "Sent" : "Email support"}
          description={
            ref
              ? "A person reads these in the order they arrive, and the answer comes to the address on your account."
              : "Only the box below is yours to write — the rest travels with the message."
          }
          onClose={close}
          footer={
            ref ? (
              <Button variant="primary" className="btn flex-1 max-sm:w-full" onClick={close}>
                Done
              </Button>
            ) : (
              <SheetActions
                cancelLabel="Cancel"
                onCancel={() => setOpen(false)}
                confirmLabel="Send message"
                onConfirm={() => void send()}
                disabled={short}
                loading={sending}
              />
            )
          }
        >
          {ref ? (
            <p className="text-[15px] leading-relaxed text-text-2">
              Quote <span className="font-mono text-[14px] text-fg">{ref}</span> if you write
              again — it opens the same record this message went into.
            </p>
          ) : (
            <>
              <div className="-mx-4 sm:-mx-5">
                <Field
                  label="Your message"
                  hint={
                    short && trimmed.length > 0
                      ? `${MIN_MESSAGE - trimmed.length} more characters, and we can act on it.`
                      : undefined
                  }
                  action={
                    <span className="text-[12px] tabular-nums text-muted">
                      {trimmed.length}/{MAX_MESSAGE}
                    </span>
                  }
                >
                  <Textarea
                    value={message}
                    maxLength={MAX_MESSAGE}
                    rows={5}
                    placeholder="What happened, and what you were trying to do."
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </Field>
              </div>

              {attached.length > 0 && (
                <div className="mt-2 border-t border-divider pt-3">
                  <div className="mb-1.5 text-[12px] text-muted">About this record</div>
                  <div className="space-y-[3px]">
                    {attached.map((fact, index) => (
                      <div key={index} className="flex gap-3 text-[13px] leading-[20px]">
                        {fact.label && (
                          <span className="w-[86px] shrink-0 text-muted">{fact.label}</span>
                        )}
                        <span className="min-w-0 flex-1 break-words text-text-2">
                          {fact.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unfiled && (
                <div className="mt-4 rounded-xl border border-divider bg-surface-2 px-4 py-3 text-[13px] leading-relaxed break-words text-text-2">
                  Nothing was filed and your note is still here.{" "}
                  <a
                    href={supportMailto(subject, lines, trimmed, refCode)}
                    className="text-accent underline underline-offset-2"
                  >
                    Send it from your mail app
                  </a>
                  .
                </div>
              )}

              {/* One mail-app door, not two: when a filing has just failed the
                  notice carries it, and the standing line would only repeat it
                  two lines below. */}
              {!unfiled && (
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  Goes to {SUPPORT_EMAIL}, or{" "}
                  <a
                    href={supportMailto(subject, lines, undefined, refCode)}
                    className="text-accent underline underline-offset-2"
                  >
                    write it in your own mail app
                  </a>
                  .
                </p>
              )}
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
