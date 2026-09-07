/**
 * Was Monday gerade tut — in einem Satzfragment.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum überhaupt eine Zeile
 * ══════════════════════════════════════════════════════════════
 *
 * Zwischen dem Absenden und dem ersten Wort der Antwort liegen
 * Sekunden, in denen nichts passiert — jedenfalls nichts Sichtbares.
 * Ohne Zeichen dafür wirkt das wie ein Aussetzer, und man drückt noch
 * einmal.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum kein Ladekringel
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Kringel sagt „warte", ein Satz sagt „woran". Der Unterschied
 * ist nicht Höflichkeit, sondern Auskunft: Wer liest, dass gerade
 * Stellen gesucht werden, weiss auch, warum es diesmal länger
 * dauert.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT stehen darf
 * ══════════════════════════════════════════════════════════════
 *
 * Erfundene Tätigkeiten. „Analysiert deinen Lebenslauf", „Prüft
 * 3 Millionen Stellen" — solche Zeilen liest man als Auskunft und
 * sind Behauptung. Jede Zeile hier hat eine technische Ursache im
 * Zustand, den der Provider meldet, und keine ist geraten.
 *
 * Deshalb auch keine Abfolge von Phasen, die nur die Uhr weiterstellt.
 * Was wir nicht wissen, sagen wir nicht.
 */
export interface Taetigkeitslage {
  /** Läuft gerade eine Anfrage? */
  busy: boolean;
  /** Hört das Mikrofon zu? */
  hoert: boolean;
  /** Wird gerade vorgelesen? */
  spricht: boolean;
  /** Hat Monday angekündigt, Stellen zu zeigen? */
  sucht: boolean;
  /** Steht schon Text der laufenden Antwort auf dem Schirm? */
  schreibtSchon: boolean;
}

export function taetigkeit(lage: Taetigkeitslage): string | null {
  if (lage.hoert) return "Hört zu";
  if (lage.spricht) return "Liest vor";
  if (!lage.busy) return null;
  /*
   * Sobald das erste Wort steht, ist die Zeile überflüssig: Der Text
   * selbst ist der bessere Beweis, dass etwas passiert.
   */
  if (lage.schreibtSchon) return null;
  if (lage.sucht) return "Sucht passende Stellen";
  return "Denkt nach";
}
