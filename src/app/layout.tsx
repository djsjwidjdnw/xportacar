import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

import { I18nProvider } from "@/i18n/provider";
import { messages, direction } from "@/i18n";
import { resolveLocale } from "@/i18n/server";
import { Toaster } from "@/components/ui/toast";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "XportACar — UAE-to-EU Online Car Auctions",
    template: "%s · XportACar",
  },
  description:
    "Premium UAE vehicles, inspected and auctioned to verified European trade buyers. Door-to-door logistics included.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  manifest: "/manifest.json",
  applicationName: "XportACar",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "XportACar",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport = {
  themeColor: "#1570EF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await resolveLocale();

  return (
    <html
      lang={locale}
      dir={direction(locale)}
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        suppressHydrationWarning on <body> only:  some browser wallet / a11y
        extensions (Trust Wallet, Grammarly, ColorZilla …) inject attributes
        onto <html>/<body> before React hydrates, which fails strict hydration
        in Next 16 / React 19.  Suppression is scoped to this element's
        attributes — children still hydrate normally.
      */}
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <I18nProvider locale={locale} messages={messages[locale]}>
          <Toaster>{children}</Toaster>
        </I18nProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
