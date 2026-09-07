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
 *
 * Die Vielfalt kommt trotzdem — aber aus dem Server: Jedes Werkzeug,
 * das Monday aufruft, meldet beim Start, was es tut. Diese Sätze
 * wechseln, weil die Arbeit wechselt, nicht weil eine Uhr
 * weiterläuft.
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
  /**
   * Was das Werkzeug meldet, das gerade läuft — oder `null`.
   *
   * Der Server schickt zu jedem Werkzeugaufruf ein `tool_start` mit
   * einem Satz, der beschreibt, was es tut: „Stellen werden
   * durchsucht", „Profil wird ergänzt", „Passung wird berechnet",
   * „Ich denke gründlich darüber nach". Diese Sätze sind nicht
   * erfunden — sie stehen neben dem Werkzeug, das sie ausführt.
   *
   * Ein laufendes Werkzeug ist eines ohne Ergebnis: `ok` ist noch
   * nicht gesetzt.
   */
  werkzeug: string | null;
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
  /*
   * Das laufende Werkzeug schlägt alles Allgemeine.
   *
   * „Denkt nach" ist wahr und sagt wenig. „Stellen werden
   * durchsucht" sagt, WORAN — und genau das trennt eine Seite, die
   * arbeitet, von einer, die hängt.
   */
  if (lage.werkzeug) return lage.werkzeug;
  if (lage.sucht) return "Sucht passende Stellen";
  return "Denkt nach";
}
