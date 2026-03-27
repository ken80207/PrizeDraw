import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ToastContainer } from "@/components/Toast";
import { StatusGate } from "@/components/StatusGate";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "The Illuminated Gallery | Kuji Noir",
    template: "%s | Kuji Noir",
  },
  description:
    "The Illuminated Gallery — Premium digital collectible experience. Ichiban Kuji & Infinite Kuji draws.",
  keywords: ["一番賞", "抽獎", "賞品", "Kuji Noir", "無限賞", "Ichiban Kuji"],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "Kuji Noir",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`dark ${plusJakarta.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-surface-dim text-on-surface font-body">
        <NextIntlClientProvider messages={messages}>
          <StatusGate>
            <AppShell>{children}</AppShell>
          </StatusGate>
          <ToastContainer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
