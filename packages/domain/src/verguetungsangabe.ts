import { type Gehaltsquelle, vomArbeitgeber } from "./gehaltsquelle.ts";

/**
 * Eine Gehaltszahl mit allem, was sie zu einer Aussage macht.
 *
 * ══════════════════════════════════════════════════════════════
 * Was `gehaltsquelle.ts` schon beantwortet — und was fehlte
 * ══════════════════════════════════════════════════════════════
 *
 * Woher eine Zahl stammt, steht bereits in `gehaltsquelle.ts`. Das
 * beantwortet die halbe Frage. Die andere Hälfte kam in der
 * Wettbewerbsprüfung heraus: Eine Anzeige zeigte im Kopf
 * „28.000–38.000 €", und im lesbaren Text stand kein einziger Betrag.
 *
 * Nicht behauptet wird, die Zahl sei erfunden. Sie kann aus einem
 * strukturierten Feld des Arbeitgebers kommen. Nur: Ob sie das feste
 * Monatsgehalt meint, das Jahresziel mit Provision oder ein Paket
 * einschliesslich Zulagen, sagt die Spanne nicht — und davon hängt ab,
 * ob sie eine Einkommensbedingung überhaupt erfüllen kann.
 *
 * Deshalb tragen Vergütungsangaben hier vier Dinge zusätzlich:
 *
 *   teil            fest, variabel, gesamt oder unbestimmt
 *   zeitraum        Stunde, Monat, Jahr
 *   stundenbasis    auf wie viele Wochenstunden sich die Zahl bezieht
 *   quelle          die Herkunft aus `gehaltsquelle.ts`
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel, um die es geht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Portalkopf allein wird nicht zum garantiert gezahlten
 * Festgehalt. Er darf gezeigt werden, er darf sogar gerechnet werden —
 * aber er kann eine Bedingung „mindestens 45.000 fest" nicht erfüllen.
 *
 * Und: Eine Spanne, die die Grenze überlappt, entscheidet nichts.
 * 28.000–38.000 gegen eine Untergrenze von 32.000 ist weder ein Ja
 * noch ein Nein; es ist die Frage, die im Gespräch zu stellen ist.
 */

export const VERGUETUNGSTEILE = ["fest", "variabel", "gesamt", "unbestimmt"] as const;
export type Verguetungsteil = (typeof VERGUETUNGSTEILE)[number];

export const TEILTEXT: Record<Verguetungsteil, string> = {
  fest: "festes Gehalt",
  variabel: "variabler Anteil",
  gesamt: "Gesamtpaket aus fest und variabel",
  unbestimmt: "Zusammensetzung nicht genannt",
};

export const ZEITRAEUME = ["stunde", "monat", "jahr"] as const;
export type Zeitraum = (typeof ZEITRAEUME)[number];

export interface Verguetungsangabe {
  von: number | null;
  bis: number | null;
  waehrung: string;
  zeitraum: Zeitraum | null;
  /**
   * Wochenstunden, auf die sich die Zahl bezieht.
   *
   * Ohne sie ist ein Monatsbetrag nicht vergleichbar: 3.000 € bei 40
   * Stunden und 3.000 € bei 30 Stunden sind zwei verschiedene Angebote.
   */
  stundenbasis: number | null;
  teil: Verguetungsteil;
  quelle: Gehaltsquelle;
  belege: readonly string[];
}

/** Ist erkennbar, wie viel davon regelmässig und fest gezahlt wird? */
export function festerAnteilGeklaert(a: Verguetungsangabe): boolean {
  return a.teil === "fest";
}

/** Arbeitswochen je Jahr für die Hochrechnung eines Stundensatzes. */
const WOCHEN_JE_JAHR = 52;

/**
 * Auf Jahresbrutto bringen — nur wenn es ohne Annahme geht.
 *
 * Ein Stundensatz ohne Stundenbasis lässt sich nicht hochrechnen. Die
 * übliche Abkürzung wäre, 40 Stunden anzunehmen; sie macht aus einer
 * Teilzeitstelle rechnerisch eine Vollzeitstelle.
 */
export function aufJahr(a: Verguetungsangabe, betrag: number): number | null {
  if (a.zeitraum === "jahr") return betrag;
  if (a.zeitraum === "monat") return betrag * 12;
  if (a.zeitraum === "stunde") {
    if (a.stundenbasis === null) return null;
    return betrag * a.stundenbasis * WOCHEN_JE_JAHR;
  }
  return null;
}

export type Erfuellung = "ja" | "nein" | "offen";

export interface Einkommensbefund {
  erfuellt: Erfuellung;
  /** Ein Satz, der auch im Fall „offen" etwas sagt. */
  grund: string;
  /**
   * Darf diese Angabe eine Muss-Bedingung überhaupt belegen?
   *
   * Getrennt von `erfuellt`, weil beides verschiedene Fragen sind: Eine
   * Schätzung kann rechnerisch über der Grenze liegen und trotzdem
   * nichts beweisen.
   */
  alsNachweisGeeignet: boolean;
}

/**
 * Erfüllt diese Angabe eine Einkommensbedingung?
 *
 * Die Reihenfolge der Prüfungen ist die Rangfolge — und die erste
 * Prüfung ist die wichtigste: Wer die Zahl geliefert hat, entscheidet,
 * ob sie überhaupt etwas belegen kann.
 */
export function erfuelltEinkommensMuss(
  a: Verguetungsangabe,
  mussJahresbrutto: number,
): Einkommensbefund {
  const alsNachweisGeeignet = vomArbeitgeber(a.quelle) && a.teil === "fest";

  if (!vomArbeitgeber(a.quelle)) {
    return {
      erfuellt: "offen",
      grund:
        "Die Zahl stammt nicht vom Arbeitgeber. Sie kann zeigen, was üblich ist — " +
        "was diese Stelle zahlt, sagt sie nicht.",
      alsNachweisGeeignet: false,
    };
  }

  if (a.teil !== "fest") {
    return {
      erfuellt: "offen",
      grund:
        a.teil === "unbestimmt"
          ? "Wie sich der Betrag zusammensetzt, steht nicht in der Anzeige. Der feste regelmässige Anteil bleibt damit offen."
          : `Angegeben ist ${TEILTEXT[a.teil]}. Wie viel davon fest gezahlt wird, ist offen.`,
      alsNachweisGeeignet: false,
    };
  }

  const untergrenze = a.von ?? a.bis;
  const obergrenze = a.bis ?? a.von;
  if (untergrenze === null || obergrenze === null) {
    return {
      erfuellt: "offen",
      grund: "Es ist kein Betrag angegeben.",
      alsNachweisGeeignet,
    };
  }

  const unten = aufJahr(a, untergrenze);
  const oben = aufJahr(a, obergrenze);
  if (unten === null || oben === null) {
    return {
      erfuellt: "offen",
      grund:
        "Der Betrag lässt sich nicht auf ein Jahr hochrechnen, solange die Wochenstunden fehlen.",
      alsNachweisGeeignet,
    };
  }

  if (unten >= mussJahresbrutto) {
    return {
      erfuellt: "ja",
      grund: "Schon die Untergrenze der Angabe liegt über deiner Bedingung.",
      alsNachweisGeeignet,
    };
  }
  if (oben < mussJahresbrutto) {
    return {
      erfuellt: "nein",
      grund: "Auch die Obergrenze der Angabe liegt unter deiner Bedingung.",
      alsNachweisGeeignet,
    };
  }
  return {
    erfuellt: "offen",
    grund:
      "Deine Bedingung liegt innerhalb der angegebenen Spanne. Ob sie erreicht wird, " +
      "entscheidet das Gespräch, nicht die Anzeige.",
    alsNachweisGeeignet,
  };
}

/**
 * Zwei Angaben vergleichen — oder ausdrücklich nicht.
 *
 * Überlappende Spannen ergeben keinen sicheren Sieger. Das ist kein
 * Mangel der Rechnung, sondern die Aussage: Aus diesen beiden Anzeigen
 * folgt nicht, welche Stelle besser zahlt.
 */
export function verguetungVergleichbar(
  a: Verguetungsangabe,
  b: Verguetungsangabe,
): { vergleichbar: boolean; grund: string } {
  if (a.waehrung !== b.waehrung) {
    return { vergleichbar: false, grund: "Die Beträge stehen in verschiedenen Währungen." };
  }
  if (a.teil !== b.teil) {
    return {
      vergleichbar: false,
      grund: `Die eine Angabe ist ${TEILTEXT[a.teil]}, die andere ${TEILTEXT[b.teil]}.`,
    };
  }
  if (aufJahr(a, a.von ?? 0) === null || aufJahr(b, b.von ?? 0) === null) {
    return { vergleichbar: false, grund: "Mindestens eine Angabe lässt sich nicht auf ein Jahr beziehen." };
  }
  return { vergleichbar: true, grund: "Beide Angaben beziehen sich auf dieselbe Grundlage." };
}
