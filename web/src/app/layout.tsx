import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ToastContainer } from "@/components/Toast";
import { StatusGate } from "@/components/StatusGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PrizeDraw — 一番賞抽獎平台",
    template: "%s | PrizeDraw",
  },
  description:
    "PrizeDraw 是台灣最好玩的線上一番賞平台。參加活動、即時抽獎、交易賞品，盡在 PrizeDraw。",
  keywords: ["一番賞", "抽獎", "賞品", "PrizeDraw", "無限賞"],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "PrizeDraw",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <StatusGate>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </StatusGate>
        <ToastContainer />
      </body>
    </html>
  );
}
