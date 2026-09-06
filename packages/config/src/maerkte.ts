/**
 * Die Märkte, in denen Velvova tatsächlich etwas anzubieten hat.
 *
 * ── Warum das eine Konfiguration ist und keine Liste im Footer ─
 *
 * Ein Footer mit vierzig Ländern sieht nach einer grossen Plattform
 * aus und ist eine Behauptung: In neunundreissig davon gäbe es keine
 * Stelle, keine Gehaltsreferenz und keine Zukunftseinschätzung.
 *
 * Hier stehen die drei, für die wir Daten haben. Kommt ein Markt dazu,
 * kommt er hier dazu — und erscheint dann überall zugleich: im Footer,
 * in der Regionsauswahl, in der Währungsformatierung.
 *
 * ── Was „vollständig" und „teilweise" bedeutet ────────────────
 *
 * Deutschland: Stellen von der Bundesagentur und Adzuna, amtliche
 * Entgeltreferenzen, Berufskennung an 73,5 Prozent der Anzeigen.
 *
 * Österreich und Schweiz: Stellen über Adzuna, aber keine amtliche
 * Gehaltsreferenz — der Entgeltatlas ist deutsch. Das steht als
 * `gehaltsreferenz: false` da und darf in der Oberfläche nicht
 * verschwiegen werden.
 */

export interface Markt {
  countryCode: string;
  name: string;
  /** Die Sprachkennung für Datums- und Zahlenformate. */
  locale: string;
  /** ISO-4217. Bestimmt, in welcher Währung Gehälter erscheinen. */
  currency: string;
  /** Liegt eine amtliche Gehaltsreferenz für diesen Markt vor? */
  gehaltsreferenz: boolean;
  /** Woher die Stellen kommen — für den Hinweis in der Oberfläche. */
  quellen: string;
}

/*
 * Die 19 Länder, in denen tatsächlich Stellen liegen.
 *
 * Die Liste war auf DE, AT und CH beschränkt, während der Bestand
 * längst 19 Länder umfasste — die Regionsauswahl bot also drei von
 * neunzehn an, und wer in Grossbritannien suchte, konnte das nicht
 * einstellen.
 *
 * `quellen` ist je Land abgefragt, nicht geschätzt: Gezählt wurden
 * am 4.9.2026 alle Quellen mit mehr als fünfzig Anzeigen im
 * jeweiligen Land.
 *
 * `gehaltsreferenz` bleibt allein bei Deutschland wahr. Der
 * Entgeltatlas der Bundesagentur ist deutsch; für die übrigen
 * achtzehn Märkte gibt es bei uns keine amtliche Referenz, und das
 * darf die Oberfläche nicht verschweigen.
 */
export const MAERKTE: readonly Markt[] = [
  { countryCode: "DE", name: "Deutschland", locale: "de-DE", currency: "EUR", gehaltsreferenz: true,
    quellen: "Bundesagentur für Arbeit, Adzuna, Arbeitnow, Findwork, TheirStack, JSearch" },
  { countryCode: "AT", name: "Österreich", locale: "de-AT", currency: "EUR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "CH", name: "Schweiz", locale: "de-CH", currency: "CHF", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "GB", name: "Vereinigtes Königreich", locale: "en-GB", currency: "GBP", gehaltsreferenz: false, quellen: "Adzuna, Reed" },
  { countryCode: "US", name: "USA", locale: "en-US", currency: "USD", gehaltsreferenz: false, quellen: "Adzuna, USAJOBS" },
  { countryCode: "FR", name: "Frankreich", locale: "fr-FR", currency: "EUR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "IT", name: "Italien", locale: "it-IT", currency: "EUR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "ES", name: "Spanien", locale: "es-ES", currency: "EUR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "NL", name: "Niederlande", locale: "nl-NL", currency: "EUR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "BE", name: "Belgien", locale: "nl-BE", currency: "EUR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "PL", name: "Polen", locale: "pl-PL", currency: "PLN", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "BR", name: "Brasilien", locale: "pt-BR", currency: "BRL", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "MX", name: "Mexiko", locale: "es-MX", currency: "MXN", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "CA", name: "Kanada", locale: "en-CA", currency: "CAD", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "AU", name: "Australien", locale: "en-AU", currency: "AUD", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "NZ", name: "Neuseeland", locale: "en-NZ", currency: "NZD", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "IN", name: "Indien", locale: "en-IN", currency: "INR", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "SG", name: "Singapur", locale: "en-SG", currency: "SGD", gehaltsreferenz: false, quellen: "Adzuna" },
  { countryCode: "ZA", name: "Südafrika", locale: "en-ZA", currency: "ZAR", gehaltsreferenz: false, quellen: "Adzuna" },
] as const;

export function marktFuer(code: string | null | undefined): Markt {
  const c = (code ?? "").toUpperCase();
  return MAERKTE.find((m) => m.countryCode === c) ?? MAERKTE[0]!;
}

/**
 * Verweise, die es tatsächlich gibt.
 *
 * ── Warum leer und nicht ausgedacht ───────────────────────────
 *
 * Ein Footer mit App-Store-Abzeichen, die auf nichts führen, und
 * Social-Symbolen für Konten, die niemand betreibt, ist die billigste
 * Art, grösser auszusehen als man ist. Wer darauf klickt, merkt es
 * sofort — und rechnet danach damit, dass auch der Rest so gemeint
 * ist.
 *
 * Wo hier `null` steht, zeigt die Oberfläche „kommt bald" statt eines
 * toten Verweises.
 */
export interface Aussenverweise {
  iosUrl: string | null;
  androidUrl: string | null;
  /** Seite mit Informationen zur App, solange es keine App gibt. */
  appInfoUrl: string | null;
  /**
   * Soziale Kanäle.
   *
   * `netz` benennt das Netzwerk und entscheidet, welches Zeichen die
   * Oberfläche zeichnet — nicht der Anzeigename. Ein Eintrag mit
   * `url: null` erscheint nicht: Ein Abzeichen, das ins Leere führt,
   * ist schlimmer als keins.
   */
  social: { netz: SozialesNetz; name: string; url: string | null }[];
}

export type SozialesNetz = "instagram" | "facebook" | "linkedin" | "youtube" | "x";

export const AUSSENVERWEISE: Aussenverweise = {
  iosUrl: null,
  androidUrl: null,
  appInfoUrl: null,
  /*
   * TODO(Velvova): Die fünf Adressen eintragen, sobald die Konten
   * bestehen. Bis dahin bleibt jede `null`, und die Leiste im Fuss
   * zeigt genau die Kanäle, die es wirklich gibt — bei ausschliesslich
   * `null` gar keine.
   *
   * Die Reihenfolge hier ist die Reihenfolge im Fuss.
   */
  social: [
    { netz: "instagram", name: "Instagram", url: null },
    { netz: "facebook", name: "Facebook", url: null },
    { netz: "linkedin", name: "LinkedIn", url: null },
    { netz: "youtube", name: "YouTube", url: null },
    { netz: "x", name: "X", url: null },
  ],
};
