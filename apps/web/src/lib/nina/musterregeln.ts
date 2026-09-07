/**
 * Wann aus Ablehnungen ein Muster wird — und was daraus folgt.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Aus sieben Ablehnungen wegen Kundenkontakt wird kein Filter.
 *
 * Ein System, das aus beobachtetem Verhalten stillschweigend Regeln
 * macht, erklärt Menschen für festgelegt: Wer im Januar dreimal
 * Vertrieb abgelehnt hat, bekommt im Juni keinen mehr angeboten — und
 * erfährt nie, dass eine Entscheidung für ihn getroffen wurde.
 *
 * Deshalb endet diese Datei bei einem Ereignis und einer Frage.
 * Regel wird daraus erst durch eine Antwort.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum drei von fünf und nicht „die Mehrheit"
 * ══════════════════════════════════════════════════════════════
 *
 * Zwei Ablehnungen sind Zufall. Bei drei aus fünf ist die Frage
 * berechtigt, ohne aufdringlich zu sein — und sie ist eine Frage, kein
 * Befund. Wer sie mit „nein" beantwortet, hat nichts verloren.
 *
 * Die Mindestzahl an Rückmeldungen verhindert den Fall, in dem jemand
 * genau zwei Stellen bewertet hat und daraus eine Aussage über seine
 * Laufbahn gemacht wird.
 */

export type Rueckmeldung = {
  grund: string | null;
  erstelltAm: Date;
};

/** Wie viele Rückmeldungen es mindestens braucht. */
export const MIN_RUECKMELDUNGEN = 5;
/** Wie oft derselbe Grund auftauchen muss. */
export const MIN_TREFFER = 3;
/** Welcher Anteil derselbe Grund sein muss. */
export const MIN_ANTEIL = 0.5;

/**
 * Die Frage zu jedem Grund.
 *
 * Ausformuliert und nicht zusammengesetzt: „Soll ich Stellen mit
 * gehalt künftig niedriger bewerten?" wäre grammatisch und
 * inhaltlich daneben. Jeder Grund braucht seinen eigenen Satz.
 */
/**
 * Die Gründe, aus denen jemand eine Stelle ablegen kann.
 *
 * Eine Liste, zwei Verwender: Die Oberfläche bietet genau diese
 * Auswahl an, und die Mustererkennung versteht genau diese Schlüssel.
 * Zwei getrennte Listen wären der sichere Weg zu einem Grund, den
 * jemand anklicken kann und auf den Monday nie reagiert.
 *
 * `label` steht auf dem Knopf, `frage` stellt Monday, wenn sich der
 * Grund häuft.
 */
export const ABLEHNUNGSGRUENDE: Record<string, { label: string; frage: string }> = {
  gehalt: {
    label: "Gehalt zu niedrig",
    frage:
      "Mir fällt auf, dass du Stellen häufig wegen des Gehalts ablegst. Soll ich schlechter bezahlte künftig gar nicht mehr zeigen?",
  },
  standort: {
    label: "Standort passt nicht",
    frage:
      "Du legst oft Stellen wegen des Standorts ab. Soll ich den Umkreis enger fassen?",
  },
  remote: {
    label: "Zu wenig Homeoffice",
    frage:
      "Der Homeoffice-Anteil ist dir häufig zu gering. Soll ich Stellen mit weniger Remote-Tagen niedriger bewerten?",
  },
  aufgaben: {
    label: "Aufgaben passen nicht",
    frage:
      "Die Aufgaben passen dir oft nicht. Magst du mir sagen, welche Tätigkeiten du eigentlich suchst?",
  },
  /*
   * Kundenkontakt steht eigenständig neben „aufgaben".
   *
   * Er liesse sich als Unterfall davon führen, wäre dann aber
   * unsichtbar: Wer dreimal wegen Kundenkontakt ablehnt und einmal
   * wegen der Fachaufgaben, hätte unter einem gemeinsamen Grund vier
   * Ablehnungen ohne erkennbares Muster — und Monday fragte nach den
   * Tätigkeiten allgemein, statt nach dem, was tatsächlich stört.
   *
   * Er ist ausserdem der Grund, bei dem eine stille Filterregel am
   * meisten schadete: Kundenkontakt kommt in halben Berufsfeldern vor.
   */
  kundenkontakt: {
    label: "Zu viel Kundenkontakt",
    frage:
      "Du legst häufig Stellen mit viel Kundenkontakt ab. Soll ich Stellen mit starkem Kundenkontakt künftig niedriger bewerten?",
  },
  unternehmen: {
    label: "Unternehmen passt nicht",
    frage:
      "Du legst häufig Stellen bestimmter Unternehmen ab. Sollen wir festhalten, welche Art von Arbeitgeber für dich nicht infrage kommt?",
  },
  karrierestufe: {
    label: "Falsche Karrierestufe",
    frage:
      "Die Stufe stimmt oft nicht. Suchst du eher eine Ebene höher oder tiefer, als ich bisher annehme?",
  },
  arbeitszeit: {
    label: "Arbeitszeiten passen nicht",
    frage:
      "Die Arbeitszeiten passen dir häufig nicht. Soll ich deine Bedingung dazu schärfen?",
  },
  branche: {
    label: "Branche passt nicht",
    frage:
      "Du legst häufig Stellen derselben Branche ab. Soll ich diese Branche künftig ausschliessen?",
  },
  anforderungen: {
    label: "Anforderungen passen nicht",
    frage:
      "Die Anforderungen sind dir oft zu hoch oder zu niedrig. Soll ich die Stufe anders ansetzen?",
  },
  kein_interesse: {
    label: "Trifft es einfach nicht",
    frage:
      "Vieles trifft es nicht. Magst du mir in einem Satz sagen, was du eigentlich suchst?",
  },
};

export type Muster = {
  grund: string;
  treffer: number;
  gesamt: number;
  anteil: number;
  frage: string;
};

/**
 * Ein Muster in den Rückmeldungen — oder keins.
 *
 * Gibt höchstens EINES zurück, das stärkste. Zwei Fragen auf einmal
 * sind ein Fragebogen, und der wird weggeklickt.
 */
export function musterErkennen(rueckmeldungen: Rueckmeldung[]): Muster | null {
  const mitGrund = rueckmeldungen.filter(
    (r): r is Rueckmeldung & { grund: string } =>
      typeof r.grund === "string" && r.grund.length > 0 && r.grund !== "sonstiges",
  );
  if (mitGrund.length < MIN_RUECKMELDUNGEN) return null;

  const zaehler = new Map<string, number>();
  for (const r of mitGrund) zaehler.set(r.grund, (zaehler.get(r.grund) ?? 0) + 1);

  let bester: Muster | null = null;
  for (const [grund, treffer] of zaehler) {
    const anteil = treffer / mitGrund.length;
    if (treffer < MIN_TREFFER || anteil < MIN_ANTEIL) continue;
    /* Ohne ausformulierte Frage kein Muster: Ein Ereignis, zu dem
       Monday nichts sagen kann, hilft niemandem. */
    const frage = ABLEHNUNGSGRUENDE[grund]?.frage;
    if (!frage) continue;
    if (!bester || treffer > bester.treffer) {
      bester = { grund, treffer, gesamt: mitGrund.length, anteil, frage };
    }
  }
  return bester;
}
