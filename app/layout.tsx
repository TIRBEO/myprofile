import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/lib/use-toast";
import { LANGUAGE_BOOT } from "@/lib/language";
import { THEME_BOOT } from "@/lib/theme";
import { ThemeSync } from "@/components/theme-sync";
import { LanguageProvider } from "@/components/language-provider";
import { MachineTranslate } from "@/lib/machine-translate";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tirbeo — Your account",
    template: "%s · Tirbeo",
  },
  description:
    "Your Tirbeo account: profile, security, privacy and your data. Everything in one place.",
  applicationName: "Tirbeo",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the tab bar sit under the home indicator on notched devices.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f4f4f6" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The boot scripts below write data-theme and lang before React
    // hydrates, so the server and client markup intentionally differ here.
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ThemeSync />
        <ToastProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ToastProvider>
        {/* Rewrites the page's other-language words in place; renders nothing.
            It sits after the content on purpose: a component's effect runs once
            the tree before it has hydrated, which is the only safe moment to
            edit markup React is still comparing against the server's. */}
        <MachineTranslate />
      </body>
    </html>
  );
}
