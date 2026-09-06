/**
 * Woher eine Gehaltszahl stammt — und was sie deshalb bedeutet.
 *
 * ── Der Unterschied, um den es geht ───────────────────────────
 *
 * „75.000 €" und „75.000 €" sehen in einer Liste gleich aus. Das eine
 * hat ein Arbeitgeber in seine Anzeige geschrieben und wird daran
 * gemessen; das andere ist die Mitte einer amtlichen Statistik über
 * Zehntausende Beschäftigte. Wer sie verwechselt, geht mit der
 * falschen Zahl ins Gespräch.
 *
 * ── Warum die Reihenfolge feststeht ───────────────────────────
 *
 * Eine Angabe des Arbeitgebers schlägt jede Statistik, auch eine
 * bessere. Sie ist keine Schätzung über den Beruf, sondern eine
 * Aussage über diese Stelle — und nur an ihr lässt sich später
 * messen, ob sie gehalten wurde.
 */

export const GEHALTSQUELLEN = [
  "arbeitgeber",
  "aus_text",
  "amtlich_beruf",
  "amtlich_gruppe",
  "portal",
] as const;
export type Gehaltsquelle = (typeof GEHALTSQUELLEN)[number];

export interface Quellentext {
  /** Das Etikett an der Zahl. Zwei Wörter, nicht mehr. */
  kurz: string;
  /** Ein Satz, der erklärt, was die Zahl ist. */
  lang: string;
  /** Ist es eine Aussage über DIESE Stelle? */
  zurStelle: boolean;
}

export const QUELLENTEXT: Record<Gehaltsquelle, Quellentext> = {
  arbeitgeber: {
    kurz: "vom Arbeitgeber angegeben",
    lang: "Diese Zahl steht so in der Anzeige. Der Arbeitgeber lässt sich daran messen.",
    zurStelle: true,
  },
  aus_text: {
    kurz: "aus dem Anzeigentext",
    lang:
      "Aus dem Fliesstext der Anzeige gelesen, nicht aus einem eigenen Gehaltsfeld. " +
      "Sie stammt vom Arbeitgeber, kann aber eine Spanne, ein Zielgehalt oder ein Beispiel sein.",
    zurStelle: true,
  },
  amtlich_beruf: {
    kurz: "geschätzt",
    lang:
      "Kein Gehalt in der Anzeige. Gezeigt wird die mittlere Hälfte laut Entgeltatlas der " +
      "Bundesagentur für diesen Beruf — amtliche Beschäftigungsstatistik, keine Auswertung " +
      "von Anzeigen. Über diese Stelle sagt sie nichts.",
    zurStelle: false,
  },
  amtlich_gruppe: {
    kurz: "grob geschätzt",
    lang:
      "Kein Gehalt in der Anzeige und kein Wert für genau diesen Beruf. Gezeigt wird die " +
      "Spanne der nächstgrösseren Berufsgruppe — die Streuung darin ist erheblich.",
    zurStelle: false,
  },
  portal: {
    kurz: "vom Portal",
    lang:
      "Von der Quelle mitgeliefert, ohne dass erkennbar ist, ob der Arbeitgeber sie " +
      "genannt hat. Zwischen Angabe und Schätzung lässt sich hier nicht unterscheiden.",
    zurStelle: false,
  },
};

/**
 * Zählt eine Zahl als Angabe des Arbeitgebers?
 *
 * Für den Filter „nur Stellen ab 45.000, wenn das Gehalt angegeben
 * ist". Eine Schätzung erfüllt ihn nicht — sonst wäre die Bedingung
 * wertlos, weil fast jede Stelle eine Schätzung hat.
 */
export function vomArbeitgeber(q: Gehaltsquelle): boolean {
  return QUELLENTEXT[q].zurStelle;
}
