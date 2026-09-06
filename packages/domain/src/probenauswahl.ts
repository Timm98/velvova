/**
 * Welche Aufgabe zu welcher Stelle gehört.
 *
 * ── Der Fehler, den das verhindert ────────────────────────────
 *
 * Bei einer Lieferfahrer-Stelle erschien eine Aufgabe über
 * Warmwasser und Heizungsdruck. Die Aufgaben selbst waren nie das
 * Problem — für die Berufshauptgruppe 52 gibt es „Die Lenkzeit läuft
 * ab", genau richtig. Falsch war die Auswahl: Sie SORTIERTE passende
 * Aufgaben nach vorn und nahm die nächstbeste, wenn keine passte.
 *
 * Sortieren ist keine Bedingung. Diese Datei macht daraus eine.
 *
 * ── Warum lieber gar keine Aufgabe ────────────────────────────
 *
 * Eine Aufgabe aus einem fremden Beruf ist keine Hilfe, sondern eine
 * falsche Auskunft über die Stelle. Wer eine Heizungsfrage zu einer
 * Fahrerstelle bekommt, lernt nichts über die Arbeit und verliert das
 * Vertrauen in alles andere auf der Seite.
 */

export interface Aufgabenprobe {
  id: string;
  /** Die KldB-Berufshauptgruppe. `null` heisst berufsneutral. */
  kldbHauptgruppe: string | null;
  /** `text` sind Aufgaben ohne Bewertung — sie passen überall. */
  art: string;
}

/**
 * Die Aufgaben, die zu einer Berufsrichtung gezeigt werden dürfen.
 *
 * Ohne bekannte Richtung sind alle zulässig — dann gibt es nichts,
 * wogegen sie verstossen könnten.
 */
export function zulaessigeProben<T extends Aufgabenprobe>(
  proben: readonly T[],
  hauptgruppe: string | null,
): T[] {
  if (!hauptgruppe) return [...proben];
  return proben.filter((p) => p.kldbHauptgruppe === hauptgruppe || p.kldbHauptgruppe === null);
}

/**
 * Die beste zulässige Aufgabe.
 *
 * Reihenfolge: die berufsspezifische vor der neutralen, bewertete vor
 * unbewerteter, bei Gleichstand die Kennung — damit ein Lauf
 * wiederholbar ist.
 *
 * `null`, wenn nichts zulässig ist. Das ist ein Ergebnis, kein Fehler.
 */
export function besteProbe<T extends Aufgabenprobe>(
  proben: readonly T[],
  hauptgruppe: string | null,
): T | null {
  const zulaessig = zulaessigeProben(proben, hauptgruppe);
  if (zulaessig.length === 0) return null;
  const rang = (p: T) =>
    (hauptgruppe && p.kldbHauptgruppe === hauptgruppe ? 0 : 2) + (p.art === "text" ? 1 : 0);
  return [...zulaessig].sort((a, b) => rang(a) - rang(b) || a.id.localeCompare(b.id))[0]!;
}
