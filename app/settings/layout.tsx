import { SettingsLayout } from "@/components/settings-layout";

/* Nothing under /settings used to carry a segment config, which meant the App
   Router prerendered all 40-odd screens at build time — one serverless function
   each, and a Hobby deployment stops at 12.

   Prerendering is safe here, and the reason is worth keeping in writing: every
   screen under this layout is a client component that reads the account over
   /api/*, so the prerendered HTML is the same shell for everyone and holds no
   one person's data. `proxy.ts` still runs before a byte of it is served, still
   refuses a visitor without a valid session, and still answers with
   `Cache-Control: no-store` — so the output is never handed to the next person
   by a cache. What force-dynamic bought here was isolation the shell never
   needed, at the price of a function per page.

   The screens that genuinely cannot be prerendered keep their own functions:
   the two bridge routes and the eight pages that address a single record by id. */
export default function SettingsGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SettingsLayout>{children}</SettingsLayout>;
}