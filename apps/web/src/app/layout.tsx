import type { Metadata, Viewport } from "next";
import { besucherSprache } from "@/lib/herkunft";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Manrope, Chivo_Mono, Instrument_Sans } from "next/font/google";
import { brand } from "@paycheck/config";
import { isLocale } from "@paycheck/i18n";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

/*
 * Eine Textschrift für alles.
 *
 * ── Was hier verschwunden ist ─────────────────────────────────
 *
 * Manrope trug die Überschriften, Geist die Oberfläche, Inter die
 * redaktionelle Fläche. Drei Schriften auf einer Seite sind auf einem
 * Jobportal kein Charakter, sondern Unruhe: Wer Titel, Gehälter und
 * Orte über Dutzende Karten vergleicht, zahlt jeden Schriftwechsel
 * mit einem Moment Aufmerksamkeit.
 *
 * Geist bleibt für Zahlen und Kennungen — dort ist gleiche Breite
 * eine Eigenschaft, kein Stil.
 *
 * ── Warum 400 bis 700 ─────────────────────────────────────────
 *
 * Überschriften laufen auf 600, einige Marken- und Landingelemente auf
 * 700. Vorher kam das aus Manrope; ohne diese Schnitte fiele der
 * Browser auf eine gerechnete Fettung zurück, und die sieht bei Inter
 * sichtbar schlechter aus als der echte Schnitt.
 */
/*
 * Source Sans 3 als Textschrift.
 *
 * ── Warum nicht Inter ─────────────────────────────────────────
 *
 * Inter ist die Standardwahl jeder Anwendungsoberfläche der letzten
 * Jahre — genau deshalb sieht eine Seite damit aus wie eine
 * Anwendung. Ein Marktplatz, dem man Jahre zutraut, klingt anders.
 *
 * Source Sans hat eine schmalere, ruhigere Zeichnung, offene
 * Punzen und deutlich unterscheidbare Ziffern. In dichten Listen —
 * Gehalt, Ort, Datum untereinander — liest sie sich schneller, und
 * in Überschriften wirkt sie sachlich statt technisch.
 *
 * Sie ist frei (SIL Open Font License) und wird mit ausgeliefert;
 * beim Öffnen der Seite geht keine Anfrage an einen fremden Server.
 *
 * ── Warum 400 bis 700 ─────────────────────────────────────────
 *
 * Fliesstext 400, Navigation und Etiketten 500, Überschriften 600,
 * Marke und Zahlen 700. Ohne echte Schnitte rechnet der Browser die
 * Fettung, und das sieht sichtbar schlechter aus.
 */
/*
 * Manrope — die neue Hausschrift.
 *
 * Vorher Source Sans 3, davor Inter: beide humanistische Grotesken,
 * die man auf jeder zweiten Seite sieht. Manrope ist geometrisch
 * gebaut und dadurch sofort als eigene Wahl erkennbar, ohne
 * verspielt zu werden.
 *
 * Ausschlaggebend waren die Ziffern. Auf einem Stellenmarkt sind sie
 * kein Beiwerk — Gehalt, Entfernung, Passungswert und Bestandsgrösse
 * tragen die halbe Seite. Manrope hat gleich breite Ziffern und eine
 * offene Null, die sich nicht mit dem O verwechselt.
 *
 * 800 ist mit dabei: Die Kopfzeile und der Markenzug brauchen einen
 * Schnitt oberhalb von 700, sonst rechnet der Browser die Fettung
 * selbst — und das sieht man.
 */
/*
 * Instrument Sans für Stellentitel.
 *
 * ── Warum eine dritte Schrift ─────────────────────────────────
 *
 * Manrope trägt alles, Chivo Mono die Zahlen. Für Titel fehlte etwas
 * dazwischen: Manrope ist als Überschrift zu freundlich-rund, Chivo
 * Mono als Titel zu technisch — bei einem dreizeiligen deutschen
 * Berufstitel liest sich gleichmässige Zeichenbreite als Quelltext.
 *
 * Instrument Sans hat schmalere Grossbuchstaben und geradere Enden.
 * Damit passt ein langer Titel wie „Sachbearbeiter Debitorenbuchhaltung
 * (m/w/d)" in weniger Zeilen, ohne dass er gedrängt wirkt — und er
 * unterscheidet sich deutlich vom Fliesstext darunter, was in einer
 * Liste aus fünfundzwanzig Einträgen die eigentliche Arbeit ist.
 *
 * Sie wird ausdrücklich NICHT global auf `--font-display` gelegt: Die
 * Klasse steht an neunzig Stellen, und die habe ich nicht alle
 * gesehen. Sie gilt vorerst für Stellentitel.
 */
const titelschrift = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-titel-raw",
  display: "swap",
  weight: ["500", "600", "700"],
});

const hausschrift = Manrope({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

/*
 * Chivo Mono für Zahlen und Kennungen.
 *
 * Zahlen tragen auf einem Stellenmarkt die halbe Aussage: Gehalt,
 * Entfernung, Passung, Bestandsgrösse. Sie dürfen sich vom Fliesstext
 * unterscheiden — und sie sollen sich lesen lassen wie eine Messung,
 * nicht wie ein Fliesstext mit Ziffern darin.
 *
 * Der Weg hierher ging über vier Absagen: Geist Mono war dieselbe
 * Familie wie die Oberflächenschrift und damit keine eigene Stimme.
 * JetBrains Mono schreibt die Null mit Schrägstrich —
 * Entwicklerkonvention, keine Schreibweise für Gehaltsangaben. Roboto
 * Mono setzt sie offen, blieb aber zu neutral. Space Mono hatte einen
 * Retro-Anklang, der neben Manrope aus der Zeit fiel. Azeret Mono war
 * richtig gebaut, aber eng — im Fliesstext unauffällig.
 *
 * Martian Mono danach war das Gegenteil von eng — so breit, dass jede
 * knappe Stelle riss: die Gehaltsspanne in der Stellenkarte, die
 * Bestandszahl in der Kopfzeile, die Prozentwerte neben den Balken.
 *
 * Chivo Mono liegt dazwischen. Sie ist eine Grotesk, keine
 * Schreibmaschine: gerade Endstriche, hohe x-Höhe, eine glatt
 * geschlossene Null ohne Strich und ohne Punkt. Neben Manrope
 * erkennbar als eigene Stimme, aber in derselben Tonlage — und mit
 * dem vollen Schnittbereich bis 700, sodass fette Zahlen wirklich
 * gezeichnet und nicht vom Browser gerechnet werden.
 */
const zahlenschrift = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
  /*
   * ══════════════════════════════════════════════════════════════
   * Die Sprache des Dokuments — gewählt, sonst abgeleitet
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `: "de"`. Damit trug jede Seite `lang="de"`, gleich
   * wer sie öffnete — auch die englische Fassung, wenn es sie gab.
   *
   * Das ist mehr als Kosmetik: `lang` sagt dem Vorleseprogramm, in
   * welcher Sprache es sprechen soll, und der Rechtschreibprüfung, in
   * welcher sie prüft. Ein englischer Text mit `lang="de"` wird auf
   * Deutsch vorgelesen.
   *
   * ── Die Reihenfolge ────────────────────────────────────────
   *
   *   1. der Keks — jemand hat auf der Seite umgeschaltet
   *   2. `Accept-Language`, sonst der Ländercode der Anfrage
   *
   * Die Kontoeinstellung steht hier bewusst NICHT: Das Layout läuft
   * auch für Besucher ohne Konto, und eine Datenbankrunde im
   * Wurzellayout liegt vor jeder Seite. Wer angemeldet ist und eine
   * Sprache gewählt hat, bekommt den Keks beim Speichern gesetzt.
   */
  const localeCookie = store.get("paycheck_locale")?.value;
  const locale = isLocale(localeCookie)
    ? localeCookie
    : await besucherSprache()
        .then((s) => s.sprache)
        .catch(() => "de" as const);

  return (
    <html
      lang={locale}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      data-theme-mode={theme === "system" ? "system" : undefined}
      className={`${GeistSans.variable} ${zahlenschrift.variable} ${hausschrift.variable} ${titelschrift.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
