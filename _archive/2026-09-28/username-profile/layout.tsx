"use client";

import { SettingsLayout } from "@/components/settings-layout";

/* These screens sit beside the settings area rather than inside it, and they
   still want the same navigation, the same search and the same account gate —
   so they borrow the shell instead of rebuilding a second one. */

export default function ProfileShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
