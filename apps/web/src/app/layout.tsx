import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces } from "next/font/google";
import { brand } from "@paycheck/config";
import { isLocale } from "@paycheck/i18n";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

/**
 * Zwei Schriften, klar getrennte Aufgaben.
 *
 * Geist trägt die gesamte Oberfläche: eng laufend, ruhig, hervorragend
 * lesbar in kleinen Größen — genau das, was Formulare und Listen
 * brauchen.
 *
 * Fraunces erscheint ausschließlich in großen Überschriften und Zahlen.
 * Eine Serifenschrift in einem Eingabefeld ist ein Fehler; eine
 * Serifenschrift in einer Hero-Zeile ist der Unterschied zwischen
 * "noch ein SaaS" und "das wurde gestaltet".
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  // Variabler Schnitt: eine Datei, alle Stärken, plus die optische
  // Größenachse — dadurch wirkt dieselbe Schrift in 14px und in 60px
  // jeweils richtig proportioniert statt bloß skaliert.
  axes: ["SOFT", "WONK", "opsz"],
});

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
    { media: "(prefers-color-scheme: light)", color: "#F5F2EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0C" },
  ],
};

/**
 * Das Theme wird serverseitig aus dem Cookie gesetzt, damit beim Laden
 * kein heller Blitz erscheint. Ohne gesetzte Wahl bleibt das Attribut
 * leer und die Systemeinstellung entscheidet — genau wie in den Tokens
 * vorgesehen.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = store.get("paycheck_theme")?.value;
  const localeCookie = store.get("paycheck_locale")?.value;
  const locale = isLocale(localeCookie) ? localeCookie : "de";

  return (
    <html
      lang={locale}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
