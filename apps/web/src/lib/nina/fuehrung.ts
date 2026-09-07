/**
 * Wann das Gespräch von selbst zur Stellenseite führt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht im Bauteil
 * ══════════════════════════════════════════════════════════════
 *
 * Die Entscheidung stand als vier `if` in einem `useEffect`. Sie ist
 * die einzige Stelle im Produkt, an der die Anwendung jemanden
 * ungefragt woanders hinbringt — und sie war die einzige, für die
 * kein Test schreibbar war, weil sie einen laufenden Browser, ein
 * echtes Gespräch und eine Antwort mit Treffern gebraucht hätte.
 *
 * Als Funktion ohne Umgebung ist sie prüfbar. Das Bauteil ruft sie
 * auf und tut, was sie sagt.
 *
 * ══════════════════════════════════════════════════════════════
 * Die vier Riegel
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Nur beim ERSTEN Mal. Wer zurückkommt, wird nicht wieder
 *      weggeschoben.
 *   2. Es muss etwas zu zeigen geben. Ohne Treffer führt der Weg auf
 *      eine leere Liste, und das ist schlimmer als kein Weg.
 *   3. Nicht, solange Monday noch schreibt. Mitten im Satz
 *      wegzufahren nimmt einem das Ende der Antwort.
 *   4. Nicht, solange ein angefangener Text im Feld steht. Er würde
 *      mit der Seite verschwinden.
 *
 * Ein leeres Feld mit Cursor zählt ausdrücklich NICHT als
 * angefangener Text: Das Feld nimmt beim Laden den Fokus, und mit der
 * strengeren Lesart wäre die Führung nie möglich gewesen.
 */
export interface Fuehrungslage {
  /** Wurde in diesem Gespräch schon einmal geführt? */
  schonGefuehrt: boolean;
  /** Wie viele Treffer Monday gerade anbietet. */
  treffer: number;
  /** Schreibt Monday gerade? */
  schreibtGerade: boolean;
  /** Was im Eingabefeld steht — `null`, wenn keines den Fokus hat. */
  feldinhalt: string | null;
}

export function darfFuehren(lage: Fuehrungslage): boolean {
  if (lage.schonGefuehrt) return false;
  if (lage.treffer <= 0) return false;
  if (lage.schreibtGerade) return false;
  if ((lage.feldinhalt ?? "").trim().length > 0) return false;
  return true;
}

/**
 * Wie lange gewartet wird, bevor geführt wird.
 *
 * 1,6 Sekunden. Man soll den Satz lesen können, mit dem Monday die
 * Treffer ankündigt — sonst wirkt es, als hätte die Seite einen
 * Fehler. Länger, und es fühlt sich an, als hinge sie.
 */
export const FUEHRUNG_WARTEN_MS = 1600;
