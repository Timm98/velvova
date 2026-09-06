/**
 * Emojis aus Stellentiteln nehmen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 * Sie stehen in den Anzeigen, nicht in unserem Code. Gemessen am
 * 6. September 2026 an den neuesten 400 deutschen Anzeigen: 2 von 400
 * tragen mindestens eines — Raketen, Sterne, Feuer, meist als
 * Blickfang um eine Gehaltsangabe herum.
 *
 * In einer Liste aus fünfundzwanzig Zeilen ist das kein Blickfang,
 * sondern Lärm: Zwei Zeilen schreien, dreiundzwanzig nicht, und die
 * Reihenfolge der Liste sagt bereits, was wichtig ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum beim Anzeigen und nicht beim Import
 * ══════════════════════════════════════════════════════════════
 *
 * Weil der gespeicherte Titel der Titel des Arbeitgebers ist. Ihn zu
 * ändern hiesse, eine fremde Angabe stillschweigend umzuschreiben —
 * und beim nächsten Abgleich sähe es aus, als hätte sich die Anzeige
 * geändert.
 *
 * Was wir zeigen, ist unsere Entscheidung. Was wir speichern, ist
 * ihre Angabe.
 */

/*
 * `Extended_Pictographic` trifft Emojis und nur Emojis.
 *
 * Nicht getroffen werden: Umlaute, das Eurozeichen, Gedankenstriche,
 * „(m/w/d)", römische Ziffern, mathematische Zeichen. Eine Liste
 * einzelner Zeichenbereiche hätte genau daran vorbeigegriffen — die
 * erste Fassung entfernte prompt das ×  aus „3× die Woche".
 */
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}‍]/gu;

/**
 * Trennzeichen, die nach dem Entfernen allein am Rand stehen bleiben.
 *
 * „Pflegefachkraft (m/w/d) ⭐ — 3.500 €" wird sonst zu
 * „Pflegefachkraft (m/w/d)  — 3.500 €": zwei Leerzeichen und ein
 * Gedankenstrich, der ins Leere zeigt.
 *
 * ── Warum nicht `\p{P}` ──────────────────────────────────────
 *
 * Weil Klammern auch Interpunktion sind. Die erste Fassung machte aus
 * „Koch (m/w/d) ⭐" ein „Koch (m/w/d" — sie nahm die schliessende
 * Klammer mit, weil sie am Ende stand.
 *
 * Aufgeräumt wird deshalb nur, was TRENNT: Striche, Punkte, Kommas,
 * Doppelpunkte, Schrägstriche, senkrechte Striche, Mittelpunkte.
 */
const REST = /^[\s\-–—·|,;:.\/]+|[\s\-–—·|,;:.\/]+$/gu;

export function titelOhneEmoji(titel: string): string {
  const ohne = titel.replace(EMOJI, " ");
  /* Nur anfassen, was auch etwas enthielt — sonst kostet es Arbeit
     für 398 von 400 Titeln, die längst in Ordnung sind. */
  if (ohne === titel) return titel;

  const sauber = ohne
    .replace(/\s{2,}/g, " ")
    /* Ein Trennzeichen, das nach dem Entfernen doppelt dasteht. */
    .replace(/\s+([–—-])\s+\1\s+/g, " $1 ")
    .replace(REST, "")
    .trim();

  /*
   * Ein Titel, der nur aus Emojis bestand, bleibt, wie er war.
   *
   * Eine leere Zeile in der Liste wäre schlimmer als eine mit einem
   * Symbol — sie sähe aus wie ein Datenfehler und liesse sich nicht
   * anklicken, ohne zu raten.
   */
  return sauber.length > 0 ? sauber : titel;
}
