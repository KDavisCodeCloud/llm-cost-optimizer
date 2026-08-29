import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-heading", subsets: ["latin"] });
const ibmPlexSans = IBM_Plex_Sans({ variable: "--font-body", weight: ["400", "500", "600"], subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LLM Cost Optimizer | THD Agentic Systems",
  description:
    "See what model tiering and prompt caching would actually save your team on LLM API spend -- real numbers, not a generic estimate.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">{children}</body>
    </html>
  );
}
