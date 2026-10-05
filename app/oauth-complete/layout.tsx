import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-seg", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-seg", display: "swap" });

/** Fonts for this route segment only — the OAuth completion flow mirrors
    the Instagram-quiet dark design of the Tirbeo Accounts app
    (accounts.tirbeo.com), with a #101014 canvas behind a photograph, a glass
    plate card, white/[0.09] hairlines, the one #0064c8 accent for primary
    fills, and transparent inputs on a white/[0.07] plate. */
export default function OAuthCompleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} ${mono.variable}`} style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
