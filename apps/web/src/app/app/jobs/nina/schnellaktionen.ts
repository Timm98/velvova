import type { Ansicht } from "@/lib/nina/steuerung/aktionen";

/**
 * Die Vorschläge im Arbeitsbereich — abhängig von der Lage, nicht fest.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie sich unterscheiden müssen
 * ══════════════════════════════════════════════════════════════
 *
 * Eine feste Reihe von zehn Knöpfen ist ein Menü, kein Vorschlag. Sie
 * steht bei jeder Stelle gleich da, auch wenn die Hälfte nicht
 * beantwortbar ist: „Gehalt prüfen" bei einer Anzeige ohne
 * Gehaltsangabe führt zu einer Ansicht, die „nicht angegeben" sagt —
 * eine Auskunft, die man vorher hätte geben können.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Knopf trotzdem bleiben darf, wenn Daten fehlen
 * ══════════════════════════════════════════════════════════════
 *
 * Zwischen „bieten wir nicht an" und „bieten wir an, als hätten wir
 * Daten" liegt ein dritter Weg: den Knopf anbieten und im Text sagen,
 * was fehlt. „Gehalt nicht angegeben" ist eine Antwort auf die Frage
 * nach dem Gehalt — und zwar die richtige. Deshalb trägt jeder
 * Vorschlag eine eigene Beschriftung für den Fall, dass die Grundlage
 * dünn ist.
 */

export type Lage = {
  hatGehalt: boolean;
  hatUnternehmensdaten: boolean;
  hatVergleichsstelle: boolean;
  /** Ob eine belastbare Passung berechnet werden konnte. */
  hatPassung: boolean;
  /** Ob die Anzeige den Arbeitsalltag beschreibt. */
  hatAufgaben: boolean;
  /** Ob die Anzeige Anforderungen nennt. */
  hatAnforderungen: boolean;
  /** Ob ein Wohnort hinterlegt ist, gegen den sich rechnen lässt. */
  hatWohnort: boolean;
  anzahlDafuer: number;
  anzahlDagegen: number;
  anzahlOffen: number;
};

export type Schnellaktion = {
  label: string;
  ansicht: Ansicht;
  /** Je kleiner, desto weiter oben. */
  rang: number;
};

/** Wie viele Vorschläge höchstens erscheinen. */
export const HOECHSTENS = 6;

/**
 * Die Vorschläge zu einer Lage.
 *
 * Die Reihenfolge folgt dem, was gerade am ehesten die Frage der
 * Person ist — nicht einer festen Wichtigkeit. Wo viel unklar ist,
 * steht das Klären oben; wo alles passt, die Bewerbung.
 */
export function schnellaktionen(lage: Lage): Schnellaktion[] {
  const alle: Schnellaktion[] = [];

  /*
   * Die Passungsfrage steht immer zur Verfügung.
   *
   * Auch ohne belastbare Zahl — dann lautet die Antwort „dazu weiss
   * ich noch zu wenig über dich", und das ist eine Auskunft, die
   * weiterführt. Sie wegzulassen hiesse, die naheliegendste Frage
   * ausgerechnet dann zu verstecken, wenn sie am wichtigsten ist.
   */
  alle.push({
    label: lage.hatPassung ? "Passt der Job zu mir?" : "Was weisst du über mich?",
    ansicht: "passung",
    rang: 1,
  });

  if (lage.anzahlDafuer > 0) {
    alle.push({ label: "Was spricht dafür?", ansicht: "dafuer", rang: 3 });
  }

  /*
   * „Was spricht dagegen" nur, wenn etwas dagegen spricht oder
   * Angaben fehlen.
   *
   * Eine leere Liste unter dieser Überschrift liest sich wie ein
   * Versäumnis — als hätte Nina nicht nachgesehen, statt nichts
   * gefunden zu haben.
   */
  if (lage.anzahlDagegen > 0 || lage.anzahlOffen > 0) {
    alle.push({
      label: lage.anzahlDagegen > 0 ? "Was spricht dagegen?" : "Was ist noch unklar?",
      ansicht: "dagegen",
      rang: 2,
    });
  }

  /*
   * Die Gehaltsfrage behält ihren Rang, auch ohne Angabe.
   *
   * Sie verliert ihre Wichtigkeit nicht dadurch, dass die Antwort
   * „nicht angegeben" lautet — im Gegenteil: Eine Anzeige ohne
   * Gehaltsangabe ist selbst eine Auskunft, und wer sie sucht, findet
   * sie sonst nirgends. Nur die Beschriftung ändert sich, damit der
   * Knopf keine Zahlen verspricht, die wir nicht haben.
   */
  alle.push({
    label: lage.hatGehalt ? "Gehalt prüfen" : "Gehalt nicht angegeben",
    ansicht: "gehalt",
    rang: 4,
  });

  if (lage.hatAnforderungen) {
    alle.push({ label: "Was brauche ich dafür?", ansicht: "anforderungen", rang: 5 });
  }

  if (lage.hatAufgaben) {
    alle.push({ label: "Was macht man dort wirklich?", ansicht: "arbeitsalltag", rang: 6 });
  }

  alle.push({
    label: lage.hatUnternehmensdaten ? "Unternehmen ansehen" : "Was weisst du über die Firma?",
    ansicht: "unternehmen",
    rang: 7,
  });

  if (lage.hatWohnort) {
    alle.push({ label: "Arbeitsweg prüfen", ansicht: "arbeitsweg", rang: 6.5 });
  }

  if (lage.hatVergleichsstelle) {
    alle.push({ label: "Mit anderem Job vergleichen", ansicht: "vergleich", rang: 7.5 });
  }

  /*
   * Ähnliche Stellen sind der Ausweg, nicht der Einstieg.
   *
   * Sie stehen weit oben, wenn vieles dagegen spricht — dann ist
   * „zeig mir etwas Besseres" die naheliegende Frage. Passt die
   * Stelle, sind sie eine Randnotiz.
   */
  alle.push({
    label: "Ähnliche Stellen finden",
    ansicht: "aehnliche",
    rang: lage.anzahlDagegen >= 2 ? 1.5 : 10,
  });

  return alle.sort((a, b) => a.rang - b.rang).slice(0, HOECHSTENS);
}
