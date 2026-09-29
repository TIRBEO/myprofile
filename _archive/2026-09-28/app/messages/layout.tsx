"use client";

import { SettingsLayout } from "@/components/settings-layout";

/* Chats belong to the account, so they borrow the shell rather than standing
   up a second one: the same rail, the same search, and the same gate that
   keeps a paused account from reading anybody's messages. */

export default function MessagesShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
