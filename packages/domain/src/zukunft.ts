/**
 * Was über die Zukunft eines Berufsfelds bekannt ist.
 *
 * ── Was diese Zahlen sind ─────────────────────────────────────
 *
 * Eine synthetisierte Einschätzung aus veröffentlichten Studien —
 * WEF Future of Jobs 2025, US BLS Employment Projections 2024–2034,
 * Stanford „Canaries in the Coal Mine", ILO GenAI-Index, Eloundou et
 * al. Die Quelle sagt selbst: keine Messwerte.
 *
 * ── Warum das die Darstellung bestimmt ────────────────────────
 *
 * Eine Einschätzung, die wie eine Messung aussieht, ist eine
 * unbelegte Aussage — genau das, wogegen dieses Produkt an jeder
 * anderen Stelle argumentiert. Deshalb trägt jede Ausgabe hier ihre
 * Herkunft, ihren Stand und ihre Konfidenz mit, und deshalb gibt es
 * `zukunftssatz` statt eines frei formulierten Textes.
 *
 * ── Was nie geschrieben wird ──────────────────────────────────
 *
 * „Dieser Beruf verschwindet." — „KI ersetzt diesen Beruf." —
 * „Dieser Beruf ist zukunftssicher."
 *
 * Substituierbarkeit beschreibt Tätigkeiten, die sich technisch
 * automatisieren lassen. Sie ist keine Wahrscheinlichkeit dafür, dass
 * ein Beruf aufhört zu existieren. Die Unterscheidung ist nicht
 * Vorsicht, sondern der Unterschied zwischen einer Auskunft und einer
 * Prophezeiung.
 */

export type Nachfragelage =
  | "stark wachsend" | "wachsend" | "stabil" | "schrumpfend" | "stark schrumpfend";

export interface Zukunftsbild {
  /** Die ISCO-Hauptgruppe, aus der die Einschätzung stammt. */
  hauptgruppe: number;
  bezeichnung: string;
  /** 1 = stark gefährdet … 5 = sehr sicher. Mittel über die Gruppe. */
  sicherheit: number;
  /** Wie viele Berufsgruppen in den Mittelwert eingehen. */
  berufsgruppen: number;
  /** Anteil mit hoher KI-Exposition, 0 bis 1. */
  kiExpositionHoch: number;
  /** Anteil mit wachsender Nachfrage, 0 bis 1. */
  nachfrageWachsend: number;
  /** Anteil mit schrumpfender Nachfrage, 0 bis 1. */
  nachfrageSchrumpfend: number;
  quelle: string;
  stand: string;
}

/**
 * Ab wie vielen Berufsgruppen ein Mittelwert etwas aussagt.
 *
 * Unter fünf schwankt er mit jeder einzelnen Gruppe. Dann steht die
 * Einschätzung nicht da — eine fehlende Auskunft ist besser als eine
 * aus drei Zeilen gemittelte.
 */
export const MIN_GRUPPEN = 5;

/**
 * Der Satz zur Nachfrage.
 *
 * Beschreibt die Lage, nicht das Schicksal. „In dieser Berufsgruppe
 * werden mehr Menschen gesucht" ist eine Auskunft; „dieser Beruf hat
 * Zukunft" wäre ein Versprechen.
 */
export function nachfragesatz(b: Zukunftsbild): string {
  if (b.nachfrageWachsend >= 0.5) {
    return "In dieser Berufsgruppe wird weltweit überwiegend mehr Personal gesucht als heute.";
  }
  if (b.nachfrageSchrumpfend >= 0.4) {
    return "In dieser Berufsgruppe geht die Zahl der Stellen weltweit überwiegend zurück.";
  }
  return "Die Zahl der Stellen in dieser Berufsgruppe bleibt weltweit überwiegend stabil.";
}

/**
 * Der Satz zur Automatisierung.
 *
 * Er nennt Tätigkeiten, nicht Berufe. Was ein Modell heute kann, sind
 * Aufgaben — und ein Beruf besteht aus mehr als seinen automatisierbaren
 * Teilen.
 */
export function automatisierungssatz(b: Zukunftsbild): string {
  if (b.kiExpositionHoch >= 0.5) {
    return (
      "Ein grosser Teil der Tätigkeiten in dieser Gruppe lässt sich mit heutigen KI-Systemen " +
      "beschleunigen oder übernehmen. Das verändert die Arbeit; was davon bleibt, entscheidet " +
      "sich im Betrieb, nicht in der Technik."
    );
  }
  if (b.kiExpositionHoch >= 0.2) {
    return (
      "Einzelne Tätigkeiten in dieser Gruppe lassen sich mit heutigen KI-Systemen beschleunigen. " +
      "Der Kern der Arbeit bleibt davon weitgehend unberührt."
    );
  }
  return (
    "Die Tätigkeiten in dieser Gruppe sind mit heutigen KI-Systemen kaum zu übernehmen — " +
    "sie sind körperlich, situativ oder zwischenmenschlich."
  );
}

/**
 * Wie sicher diese Auskunft ist.
 *
 * Bewusst nie „hoch": Die Zuordnung zur Berufsgruppe ist strukturell
 * abgeleitet, und die Bewertung selbst ist eine Einschätzung aus
 * Studien, keine Messung. Beides zusammen kann nicht mehr als mittel
 * ergeben.
 */
export function zukunftskonfidenz(b: Zukunftsbild): "mittel" | "gering" {
  return b.berufsgruppen >= 20 ? "mittel" : "gering";
}

/** Der Herkunftshinweis, der unter jeder Zukunftsangabe stehen muss. */
export function zukunftsherkunft(b: Zukunftsbild): string {
  return (
    `Gemittelt über ${b.berufsgruppen} Berufsgruppen der ISCO-Hauptgruppe „${b.bezeichnung}“. ` +
    `Synthetisierte Einschätzung aus veröffentlichten Studien, keine Messwerte. Stand ${b.stand}.`
  );
}
