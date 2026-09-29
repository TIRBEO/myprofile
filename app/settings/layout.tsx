import { SettingsLayout } from "@/components/settings-layout";

export default function SettingsGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
