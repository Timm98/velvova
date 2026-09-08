/**
 * „Ausbildung **oder** einschlägige Erfahrung" — und was ein Portal
 * daraus macht.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, der Menschen aussortiert
 * ══════════════════════════════════════════════════════════════
 *
 * Die Metallbauer-Anzeige aus der Wettbewerbsprüfung nennt mehrere
 * Qualifikationswege, darunter einschlägige Berufserfahrung. Sie war in
 * dieser Prüfung ausdrücklich das Gegenbeispiel: eine saubere Anzeige.
 *
 * Kaputtgehen kann sie trotzdem — beim Lesen. Wer die Wege als Liste
 * von Anforderungen behandelt, verlangt sie alle. Aus einem Angebot
 * („eines davon genügt") wird eine Hürde („alles davon"), und eine
 * Person mit zehn Jahren Erfahrung erfährt, dass ihr die Ausbildung
 * fehlt.
 *
 * ══════════════════════════════════════════════════════════════
 * Und der zweite Fehler: Lücke ist nicht Mangel
 * ══════════════════════════════════════════════════════════════
 *
 * Wenn im Profil nichts über eine Ausbildung steht, heisst das nicht,
 * dass keine da ist. Es heisst, dass niemand gefragt hat.
 *
 * Deshalb gibt es hier drei Ergebnisse und nicht zwei: erfüllt, nicht
 * erfüllt und ungeprüft. Nur ein belegter Gegennachweis führt zu
 * „nicht erfüllt" — das Fehlen eines Nachweises führt zu einer Frage.
 */

export const VERKNUEPFUNGEN = ["oder", "und"] as const;
export type Verknuepfung = (typeof VERKNUEPFUNGEN)[number];

export interface Qualifikationsweg {
  /** Ein Weg, die Anforderung zu erfüllen. */
  schluessel: string;
  text: string;
}

export interface Qualifikationsforderung {
  text: string;
  wege: readonly Qualifikationsweg[];
  /**
   * Wie die Wege zusammenhängen.
   *
   * Muss aus der Anzeige stammen. Wird sie nicht gelesen, ist `oder`
   * die schonendere Annahme — sie sortiert niemanden aus. `und` ist die
   * Behauptung, dass wirklich alles verlangt wird, und die braucht
   * einen Beleg.
   */
  verknuepfung: Verknuepfung;
}

/** Was die Person nachweisen kann — je Weg. */
export const NACHWEISSTAENDE = ["belegt", "widerlegt", "ungeprueft"] as const;
export type Nachweisstand = (typeof NACHWEISSTAENDE)[number];

export interface Wegbefund {
  weg: Qualifikationsweg;
  stand: Nachweisstand;
}

export type Forderungsergebnis = "erfuellt" | "nicht_erfuellt" | "ungeprueft";

export interface Forderungsbefund {
  ergebnis: Forderungsergebnis;
  /** Die Wege, die tatsächlich belegt sind. */
  belegteWege: readonly string[];
  /** Die Wege, die noch niemand geprüft hat. */
  offeneWege: readonly string[];
  satz: string;
}

/**
 * Eine Anforderung gegen die Nachweise der Person prüfen.
 *
 * Bei `oder` genügt ein belegter Weg. „Nicht erfüllt" setzt voraus,
 * dass JEDER Weg widerlegt ist — solange auch nur einer ungeprüft ist,
 * ist die Antwort eine Frage und kein Nein.
 *
 * Bei `und` kehrt sich beides um: Ein einziger widerlegter Weg genügt
 * für ein Nein, und „erfüllt" verlangt, dass keiner offen ist.
 */
export function forderungPruefen(
  forderung: Qualifikationsforderung,
  befunde: readonly Wegbefund[],
): Forderungsbefund {
  const stand = (w: Qualifikationsweg): Nachweisstand =>
    befunde.find((b) => b.weg.schluessel === w.schluessel)?.stand ?? "ungeprueft";

  const belegteWege = forderung.wege.filter((w) => stand(w) === "belegt").map((w) => w.schluessel);
  const offeneWege = forderung.wege.filter((w) => stand(w) === "ungeprueft").map((w) => w.schluessel);
  const widerlegt = forderung.wege.filter((w) => stand(w) === "widerlegt").map((w) => w.schluessel);

  if (forderung.wege.length === 0) {
    return {
      ergebnis: "ungeprueft",
      belegteWege: [],
      offeneWege: [],
      satz: `${forderung.text}: Es ist nicht erkennbar, wie diese Anforderung erfüllt wird.`,
    };
  }

  if (forderung.verknuepfung === "oder") {
    if (belegteWege.length > 0) {
      return {
        ergebnis: "erfuellt",
        belegteWege,
        offeneWege,
        satz:
          forderung.wege.length > 1
            ? `${forderung.text}: erfüllt — einer der genannten Wege genügt, und einer davon trifft auf dich zu.`
            : `${forderung.text}: erfüllt.`,
      };
    }
    if (offeneWege.length === 0) {
      return {
        ergebnis: "nicht_erfuellt",
        belegteWege,
        offeneWege,
        satz: `${forderung.text}: Keiner der genannten Wege trifft auf dich zu.`,
      };
    }
    return {
      ergebnis: "ungeprueft",
      belegteWege,
      offeneWege,
      satz:
        `${forderung.text}: noch offen. ` +
        (widerlegt.length > 0
          ? "Ein Weg trifft nicht zu, über die anderen liegt nichts vor."
          : "Dazu liegt von dir nichts vor."),
    };
  }

  if (widerlegt.length > 0) {
    return {
      ergebnis: "nicht_erfuellt",
      belegteWege,
      offeneWege,
      satz: `${forderung.text}: Eine der verlangten Voraussetzungen trifft nicht zu.`,
    };
  }
  if (offeneWege.length > 0) {
    return {
      ergebnis: "ungeprueft",
      belegteWege,
      offeneWege,
      satz: `${forderung.text}: Hier wird alles Genannte verlangt; über einen Teil liegt von dir nichts vor.`,
    };
  }
  return {
    ergebnis: "erfuellt",
    belegteWege,
    offeneWege,
    satz: `${forderung.text}: erfüllt.`,
  };
}
