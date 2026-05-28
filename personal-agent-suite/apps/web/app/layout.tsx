import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Agent Suite",
  description: "Self-hosted AI agent platform control plane"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
