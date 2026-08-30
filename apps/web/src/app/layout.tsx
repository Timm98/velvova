import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Inter, Manrope } from "next/font/google";
import { brand } from "@paycheck/config";
import { isLocale } from "@paycheck/i18n";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

/**
 * Drei Schriften, klar getrennte Aufgaben.
 *
 * Manrope trägt Überschriften: geometrisch, offen, mit Charakter in
 * großen Graden — ohne die Verspieltheit, die eine Serifenschrift in ein
 * technisches Produkt bringt.
 *
 * Geist trägt die Oberfläche: eng laufend, ruhig, hervorragend lesbar in
 * kleinen Größen — genau das, was Formulare und dichte Listen brauchen.
 *
 * Geist Mono trägt Zahlen. Scores und Metadaten brauchen gleich breite
 * Ziffern, sonst springt eine Liste bei jedem Wert.
 *
 * Alle drei werden selbst ausgeliefert; beim Öffnen der Seite geht keine
 * Anfrage an einen fremden Server.
 */
const display = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["500", "600", "700"],
});

/**
 * Inter für die redaktionelle Fläche.
 *
 * Geist ist für dichte Oberflächen gebaut — eng, ruhig, sparsam. Auf
 * einer Landingpage mit langen Zeilen und grossem Weissraum wirkt genau
 * das karg. Inter hat die offenere Zeichnung, die längere Absätze
 * tragen, ohne dabei dekorativ zu werden.
 *
 * Zwei Textschriften sind eine Entscheidung, kein Versehen: die
 * Anwendung und die öffentliche Seite haben verschiedene Aufgaben und
 * dürfen verschieden klingen.
 */
const editorial = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600"],
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
  /* Hell zuerst — auch hier. Die Adressleiste des Telefons soll nicht
     dunkel sein, während die Seite hell ist. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0C14" },
  ],
};

/**
 * Das Thema wird serverseitig aus dem Cookie gesetzt, damit beim Laden
 * kein Farbblitz erscheint.
 *
 * Drei Wege, drei Ergebnisse — und ein vierter Fall, der der wichtigste
 * ist:
 *
 *   "dark"    → data-theme="dark"          immer dunkel
 *   "light"   → data-theme="light"         immer hell
 *   "system"  → data-theme-mode="system"   folgt dem Gerät
 *   nichts    → kein Attribut              HELL
 *
 * Der letzte Fall war vorher falsch: ohne Cookie entschied die
 * Systemeinstellung, und wer sein Betriebssystem dunkel eingestellt
 * hatte, landete beim allerersten Besuch in einer dunklen Oberfläche,
 * ohne je etwas gewählt zu haben. Deshalb hat „System“ jetzt ein
 * eigenes Attribut: sonst ist es von „nie gewählt“ nicht zu
 * unterscheiden.
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
      data-theme-mode={theme === "system" ? "system" : undefined}
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} ${editorial.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
