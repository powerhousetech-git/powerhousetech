import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PowerhouseTech — AI Automation Studio for B2B SaaS",
  description:
    "We automate the ops. You scale the company. AI automation infrastructure for India's sharpest B2B SaaS founders.",
  openGraph: {
    title: "PowerhouseTech — AI Automation Studio",
    description: "High-leverage automation infrastructure. Working demo in 7 days.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-black font-sans text-[#f5f5f7] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
