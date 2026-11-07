import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import { containerClass } from "@/components/ui";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

// Explicit override first, then Vercel's production domain, then local dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3001");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SceneHawk",
    template: "%s · SceneHawk",
  },
  description:
    "Describe the film you want to feel. SceneHawk searches by atmosphere, pacing, and visual language — not genre, rating, or what you watched last.",
  openGraph: {
    title: "SceneHawk",
    description:
      "Multi-agent film discovery — search by atmosphere, pacing, and visual language.",
    images: ["/scenehawk.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0c",
  colorScheme: "dark",
};

// No accounts: SceneHawk only searches a public film corpus, so there is
// nothing user-specific to protect. Don't add a sign-in button back.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-fg px-4 py-2.5 text-sm font-medium text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to content
        </a>
        <SiteNav />

        <main id="main" tabIndex={-1} className="w-full flex-1">
          {children}
        </main>

        <footer className="border-t border-line">
          <div
            className={`${containerClass} flex flex-col gap-3 py-8 font-mono text-xs text-fg-faint sm:flex-row sm:items-center sm:justify-between`}
          >
            <span>SceneHawk prototype · CSCI 49900, Hunter College</span>
            <span>Research project · not a commercial service</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
