import { Cormorant_Garamond, Manrope } from "next/font/google";

import type { Metadata } from "next";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"]
});

const uiFont = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "Personal Agent Suite",
  description: "Self-hosted AI agent platform control plane"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${uiFont.variable}`}>{children}</body>
    </html>
  );
}
