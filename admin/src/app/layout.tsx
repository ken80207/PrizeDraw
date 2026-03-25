import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrizeDraw Admin",
  description: "PrizeDraw 後台管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="h-full bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
