/**
 * Geldbeträge so schreiben, wie sie im jeweiligen Land geschrieben werden.
 *
 * ── Warum das nicht egal ist ──────────────────────────────────
 *
 * Bisher stand an zwei Stellen `Intl.NumberFormat("de-DE")` — in der
 * Jobliste als blosse Zahl mit angehängtem Kürzel, im Jobdetail als
 * Währungsformat. Beide mit fest eingetragenem deutschem Gebietsschema.
 *
 * Für deutsche Stellen ging das gut. Für alle anderen nicht: Ein
 * Schweizer Gehalt erschien als „90.000 CHF" statt „CHF 90'000", ein
 * britisches als „60.000 GBP" statt „£60,000". Das liest sich wie eine
 * Übersetzung, die jemand vergessen hat — und bei Beträgen mit
 * Tausenderpunkten ist die Verwechslungsgefahr real: In der Schweiz
 * trennt ein Apostroph, in Grossbritannien ein Komma.
 *
 * ── Eine Stelle, nicht zwei ───────────────────────────────────
 *
 * Zwei Formatierungen für dieselbe Sache driften auseinander — sie
 * hatten es schon: Die Liste hängte das Kürzel an, das Detail setzte
 * das Symbol davor. Dieselbe Stelle sah an zwei Orten verschieden aus.
 */

/**
 * Welches Gebietsschema schreibt diese Währung richtig?
 *
 * Nicht das Land des Nutzers und nicht die Sprache der Oberfläche: die
 * Schreibweise gehört zur Währung. Ein Deutscher, der eine Zürcher
 * Stelle ansieht, soll „CHF 90'000" lesen — so steht es im Vertrag.
 */
const SCHREIBWEISE: Record<string, string> = {
  EUR: "de-DE",
  CHF: "de-CH",
  GBP: "en-GB",
  USD: "en-US",
  CAD: "en-CA",
  AUD: "en-AU",
  NZD: "en-NZ",
  PLN: "pl-PL",
  CZK: "cs-CZ",
  HUF: "hu-HU",
  SEK: "sv-SE",
  NOK: "nb-NO",
  DKK: "da-DK",
  JPY: "ja-JP",
  SGD: "en-SG",
  INR: "en-IN",
};

export type Zeitraum = "year" | "month" | "hour" | "day" | "week";

const ZEITRAUM_TEXT: Record<Zeitraum, string> = {
  year: "pro Jahr",
  month: "pro Monat",
  hour: "pro Stunde",
  day: "pro Tag",
  week: "pro Woche",
};

function formatierer(waehrung: string): Intl.NumberFormat {
  const ort = SCHREIBWEISE[waehrung.toUpperCase()] ?? "de-DE";
  return new Intl.NumberFormat(ort, {
    style: "currency",
    currency: waehrung.toUpperCase(),
    maximumFractionDigits: 0,
  });
}

/** Ein einzelner Betrag. */
export function betrag(wert: number, waehrung: string): string {
  try {
    return formatierer(waehrung).format(wert);
  } catch {
    /*
     * Ein unbekanntes Währungskürzel darf die Seite nicht zerreissen.
     *
     * `Intl.NumberFormat` wirft bei einem ungültigen Code. Der kommt
     * aus fremden Daten, also ist er möglich — und eine Stellenliste,
     * die wegen eines krummen Kürzels gar nicht mehr rendert, ist ein
     * schlechterer Zustand als eine, die den Betrag schlicht anzeigt.
     */
    return `${new Intl.NumberFormat("de-DE").format(wert)} ${waehrung}`;
  }
}

/**
 * Eine Spanne — mit dem Symbol nur einmal, wenn es vorne steht.
 *
 * „£60,000 – £80,000" ist im Englischen üblich, „60.000 – 80.000 €" im
 * Deutschen. Beides ergibt sich aus dem Gebietsschema; hier wird nur
 * entschieden, ob die Wiederholung stört. Sie stört nicht, und sie ist
 * eindeutiger als eine Spanne, deren zweite Zahl keine Währung trägt.
 */
export function spanne(
  min: number | null,
  max: number | null,
  waehrung: string,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${betrag(min, waehrung)} – ${betrag(max, waehrung)}`;
  }
  return betrag((min ?? max)!, waehrung);
}

/**
 * Die vollständige Angabe inklusive Zeitraum.
 *
 * Der Zeitraum wird NICHT umgerechnet. Ein Stundenlohn bleibt ein
 * Stundenlohn — daraus ein Jahresgehalt zu machen setzt eine
 * Wochenarbeitszeit voraus, die in der Anzeige selten steht.
 */
export function gehaltText(
  min: number | null,
  max: number | null,
  waehrung: string,
  zeitraum: Zeitraum = "year",
): string | null {
  const s = spanne(min, max, waehrung);
  return s === null ? null : `${s} ${ZEITRAUM_TEXT[zeitraum] ?? ""}`.trim();
}
