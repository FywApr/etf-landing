import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { PageViewTracker } from "@/components/Analytics";
import "./globals.css";

// latin-ext is required for Czech diacritics (ě, š, č, ř, ž, ů, …).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Display face for headlines only; the width axis gives a slightly condensed cut.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth", "opsz"],
});

export const metadata: Metadata = {
  title: "Srovnání amerických ETF",
  description:
    "Srovnání vybraných amerických ETF a kalkulačka poplatků pro české investory.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111210",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}
