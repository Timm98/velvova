/**
 * Eine Frage. Nicht drei, und manchmal keine.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Produkt sonst ein Prüfprotokoll wird
 * ══════════════════════════════════════════════════════════════
 *
 * Ein System, das jede Lücke meldet, meldet bei jeder Anzeige etwas.
 * Deutsche Stellenanzeigen lassen fast immer etwas offen — nach zehn
 * Hinweisen liest niemand mehr den elften, auch nicht den, der zählt.
 *
 * Die Farbe der Arbeitskleidung fehlt in praktisch jeder Anzeige. Sie
 * erzeugt hier keine Frage, weil ihre Antwort keine Entscheidung
 * ändert. Fehlt dagegen die Dienstregelung bei jemandem, für den freie
 * Wochenenden ein Muss sind, ist das die eine Frage, die zählt.
 *
 * Der Maßstab ist deshalb nicht „fehlt etwas", sondern: Würden die
 * möglichen Antworten die Entscheidung dieser Person verändern?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine feste Reihenfolge und kein Wichtigkeitswert
 * ══════════════════════════════════════════════════════════════
 *
 * Ein vom Sprachmodell vergebener Score wäre flexibler und liesse sich
 * nicht prüfen: Zwei fast gleiche Anzeigen bekämen verschiedene
 * Reihenfolgen, und niemand könnte sagen, warum.
 *
 * Die Rangfolge steht hier fest und ist damit nachvollziehbar:
 *
 *   1. ein bekannter Muss-Konflikt      — das ist entschieden, nicht offen
 *   2. eine offene Muss-Frage           — sie kann die Stelle kippen
 *   3. eine fehlende Vergleichsbasis    — ohne sie ist kein Vergleich möglich
 *
 * Bei Gleichstand innerhalb einer Stufe wird nicht gewürfelt: Dann
 * bekommt die Person die Wahl. Eine willkürliche Vorauswahl wäre eine
 * Entscheidung, die niemand getroffen hat.
 */

export const KLAERUNGSARTEN = ["muss_konflikt", "muss_offen", "vergleichsbasis"] as const;
export type Klaerungsart = (typeof KLAERUNGSARTEN)[number];

/** Die Rangfolge. Kleiner heisst dringender. */
export const KLAERUNGSRANG: Record<Klaerungsart, number> = {
  muss_konflikt: 0,
  muss_offen: 1,
  vergleichsbasis: 2,
};

export interface Klaerungskandidat {
  schluessel: string;
  art: Klaerungsart;
  /** Die Frage, wie sie gestellt würde. */
  frage: string;
  /**
   * Würden verschiedene Antworten die Entscheidung verändern?
   *
   * Das Feld, an dem die Kleiderfarbe scheitert. Es wird gesetzt, wo
   * die Lücke entsteht — hier wird nur noch danach gefiltert.
   */
  entscheidungsrelevant: boolean;
}

export interface NaechsterSchritt {
  /** Der eine Vorschlag — oder `null`, wenn nichts zu klären ist. */
  vorschlag: Klaerungskandidat | null;
  /**
   * Gleichrangige Kandidaten, zwischen denen die Person wählen darf.
   *
   * Enthält den Vorschlag selbst. Bei genau einem Kandidaten bleibt die
   * Liste einelementig und die Oberfläche zeigt keine Wahl.
   */
  gleichrangig: readonly Klaerungskandidat[];
  /** Was zurückgestellt wurde. Nicht verworfen, nur nicht jetzt. */
  spaeter: readonly Klaerungskandidat[];
  satz: string;
}

/**
 * Den nächsten Schritt bestimmen.
 *
 * Gibt `null` zurück, wenn nichts Entscheidungsrelevantes offen ist —
 * das ist der Prüffall B10 und die unbequemste Anforderung von allen:
 * Bei einer vollständigen, widerspruchsfreien, passenden Anzeige muss
 * dieses Produkt schweigen. Eine Warnung, die immer kommt, ist keine
 * Warnung mehr, sondern Hintergrundrauschen.
 */
export function naechsterSchritt(
  kandidaten: readonly Klaerungskandidat[],
): NaechsterSchritt {
  const relevant = kandidaten.filter((k) => k.entscheidungsrelevant);

  if (relevant.length === 0) {
    return {
      vorschlag: null,
      gleichrangig: [],
      spaeter: [],
      satz:
        kandidaten.length === 0
          ? "Es ist nichts offen, was deine Entscheidung ändern würde."
          : "Was offen ist, würde an deiner Entscheidung nichts ändern.",
    };
  }

  const beste = Math.min(...relevant.map((k) => KLAERUNGSRANG[k.art]));
  const gleichrangig = relevant.filter((k) => KLAERUNGSRANG[k.art] === beste);
  const spaeter = relevant.filter((k) => KLAERUNGSRANG[k.art] !== beste);
  const vorschlag = gleichrangig[0]!;

  const satz =
    gleichrangig.length > 1
      ? `${gleichrangig.length} Fragen sind gleich wichtig. Womit möchtest du anfangen?`
      : vorschlag.art === "muss_konflikt"
        ? "Hier steht schon fest, dass eine deiner Bedingungen nicht erfüllt ist."
        : vorschlag.art === "muss_offen"
          ? "Das ist die Frage, die diese Stelle für dich entscheidet."
          : "Ohne diese Angabe lässt sich nicht vergleichen.";

  return { vorschlag, gleichrangig, spaeter, satz };
}
