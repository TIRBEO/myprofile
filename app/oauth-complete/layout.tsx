import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-seg", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-seg", display: "swap" });

/** Fonts for this route segment only. Inter and JetBrains Mono are loaded
    here rather than in the root layout so the rest of the app keeps its own
    stacks. The palette is global — one black canvas and one indigo action
    colour across myprofile and accounts.tirbeo.com. */
export default function OAuthCompleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} ${mono.variable}`} style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
