import type { Metadata, Viewport } from "next";
import { brand } from "@paycheck/config";
import { cookies } from "next/headers";
import { isLocale } from "@paycheck/i18n";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline.de,
  applicationName: brand.name,
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#16151a" },
  ],
};

/**
 * Das Theme wird serverseitig aus dem Cookie gesetzt, damit beim Laden
 * kein heller Blitz erscheint. Ohne gesetzte Wahl bleibt das Attribut
 * leer und die Systemeinstellung entscheidet - genau wie in den Tokens
 * vorgesehen.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = store.get("paycheck_theme")?.value;
  const localeCookie = store.get("paycheck_locale")?.value;
  const locale = isLocale(localeCookie) ? localeCookie : "de";

  return (
    <html lang={locale} data-theme={theme === "light" || theme === "dark" ? theme : undefined}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
