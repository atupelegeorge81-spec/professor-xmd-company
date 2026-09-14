import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

export const metadata: Metadata = {
  title: "PROFESSOR-XMD-COMPANY",
  description: "Chat room ya virtual AI software company — agents 5 wanaotumia Groq Qwen3.6 na web search (SearXNG).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
