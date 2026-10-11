import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// latin-ext is required for Czech diacritics (ě, š, č, ř, ž, ů, …).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Srovnání amerických ETF",
  description:
    "Přehledné srovnání amerických ETF pro české investory. Stránka je ve výstavbě.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
