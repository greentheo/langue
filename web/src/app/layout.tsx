import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { PhosphorScript } from "@/components/phosphor-toggle";

/**
 * IBM Plex Mono stands in for the IIe's character ROM: a real monospace face
 * with proper accented glyph coverage, which matters when half the interface
 * is Italian, Portuguese, and Spanish text.
 */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-ibm-vga",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LANGUE",
  description: "Language practice on a green screen. Italian, Portuguese, Spanish, and French.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plexMono.variable} suppressHydrationWarning>
      <head>
        <PhosphorScript />
      </head>
      <body className="crt-screen">{children}</body>
    </html>
  );
}
