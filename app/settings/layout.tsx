import { SettingsLayout } from "@/components/settings-layout";

/* Nothing under /settings belongs to "whoever loads the site": it is one
   person's account, read live over the bridge. Without this the App Router
   prerenders each page at build time, which bakes one visitor's shell into the
   output and serves it to the next — the exact thing the edge gate exists to
   prevent, undone by a cache. */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function SettingsGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
