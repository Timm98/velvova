import { createHash } from "node:crypto";

/**
 * Wann sind zwei Aussagen dieselbe Aussage?
 *
 * Die Frage klingt spitzfindig und ist der Kern eines Fehlers, den
 * Menschen als „das Ding kommt immer wieder" erlebt haben.
 *
 * Nina leitet aus jeder Nachricht Vermutungen über den Menschen ab.
 * Lehnt jemand eine davon ab, wurde bisher die ZEILE als abgelehnt
 * markiert. Zwei Sätze später leitet Nina denselben Satz erneut ab —
 * neue Zeile, neue Kennung, kein Vermerk. Die Ablehnung war formal
 * gespeichert und praktisch wirkungslos.
 *
 * Deshalb hängt die Entscheidung jetzt am Inhalt. Normalisiert wird
 * grosszügig, weil es um Wiedererkennung geht und nicht um Gleichheit:
 *
 *   „Du hast Erfahrung in der Disposition."
 *   „du hast erfahrung in der disposition"
 *   „Du hast Erfahrung in der Disposition"
 *
 * sind für einen Menschen offensichtlich derselbe Satz. Ohne
 * Normalisierung wären es drei verschiedene, und die Ablehnung müsste
 * dreimal ausgesprochen werden.
 *
 * Bewusst NICHT normalisiert wird die Wortwahl. „Erfahrung in der
 * Disposition" und „Erfahrung in der Logistik" sind zwei Aussagen, und
 * die zweite darf gestellt werden, auch wenn die erste abgelehnt wurde.
 * Eine unscharfe Ähnlichkeitssuche würde hier Erkenntnisse
 * unterdrücken, die noch niemand beurteilt hat — und das wäre der
 * schlimmere Fehler: die Person merkt nie, dass sie etwas nicht zu
 * sehen bekommt.
 *
 * Dieselbe Normalisierung steht in Migration 0019 als SQL, damit der
 * Bestand zu neu berechneten Werten passt. Ändert sich eine der beiden,
 * muss die andere mit — geprüft in inhaltskennung.test.ts.
 */
export function inhaltskennung(aussage: string): string {
  const normalisiert = aussage
    .toLowerCase()
    // Alles ausser Buchstaben, Ziffern und Leerzeichen zu Leerzeichen.
    // Umlaute bleiben: „Führerschein" und „Fuhrerschein" sind nicht
    // dasselbe Wort, und wir raten hier nicht.
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("md5").update(normalisiert).digest("hex");
}
