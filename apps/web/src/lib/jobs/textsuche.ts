import { FÜLLWÖRTER } from "./suchintention.ts";

/**
 * Der Wortvergleich der Stellenliste.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Datei gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Suche wurde an zwei Stellen entschieden, und sie waren sich
 * nicht einig.
 *
 * In der Datenbank steht `plainto_tsquery('german', …)`. Das wirft
 * Füllwörter weg und führt Beugungen zusammen: „Pflegekräfte" findet
 * „Pflegekraft".
 *
 * Danach filterte die Stellenseite noch einmal nach — mit
 * `words.every(w => text.includes(w))` über die ROHEN Wörter des
 * Satzes. Gemeldet am 8. September 2026: „landratsamt karlsruhe
 * sozialen bereich" verlangte damit, dass jedes dieser vier Wörter
 * buchstäblich in der Anzeige steht. „bereich" ist ein Füllwort, und
 * „sozialen" schreibt keine Anzeige — sie schreibt „Sozialarbeiter"
 * oder „Sozialer Dienst". Der Nachfilter leerte, was die Datenbank
 * gefunden hatte.
 *
 * Zwei Regeln für eine Frage sind eine Regel zu viel. Diese Datei ist
 * die zweite Regel — nachgezogen, damit sie dasselbe meint wie die
 * erste, und ausgelagert, damit sie prüfbar ist, ohne eine Datenbank
 * zu brauchen.
 */

/**
 * Der Wortstamm, grob.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum abschneiden und nicht nachschlagen
 * ══════════════════════════════════════════════════════════════
 *
 * Ein richtiger Stemmer steht schon in Postgres. Ihn im Browser
 * nachzubauen hiesse, ein deutsches Wörterbuch mitzuliefern — für
 * einen Nachfilter, der nur noch entscheidet, was von einer bereits
 * gefundenen Menge übrig bleibt.
 *
 * Abgeschnitten wird deshalb nur die häufigste deutsche Beugung, und
 * auch die nur bei Wörtern, die danach noch tragen. Vier Buchstaben
 * ist die Grenze: „sozialen" wird zu „sozial" und trifft
 * „Sozialarbeiter"; „alle" bliebe „all" und träfe alles.
 *
 * Der Vergleich ist bewusst grosszügiger als die Datenbank. Er soll
 * nichts hinzufügen, was sie nicht gefunden hat — er soll nur nichts
 * wegwerfen, was sie behalten wollte.
 */
export function wortstamm(wort: string): string {
  const klein = wort.toLowerCase();
  if (klein.length < 6) return klein;
  for (const endung of ["innen", "enden", "ende", "ern", "en", "er", "es", "em", "e", "n", "s"]) {
    if (klein.endsWith(endung)) {
      const stamm = klein.slice(0, -endung.length);
      if (stamm.length >= 4) return stamm;
    }
  }
  return klein;
}

/**
 * Die Suchwörter eines Satzes — ohne Füllwörter, auf den Stamm gekürzt.
 *
 * Ein leeres Ergebnis heisst: Der Satz sagt nichts über den Beruf.
 * Dann darf NICHT gefiltert werden — ein Filter ohne Inhalt, der
 * trotzdem greift, leert die Liste aus einem Grund, den niemand
 * sehen kann.
 */
export function suchwoerter(eingabe: string): string[] {
  return eingabe
    .toLowerCase()
    .replace(/[.,;:!?„“"'()/-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !FÜLLWÖRTER.has(w))
    .map(wortstamm);
}

/**
 * Trifft dieser Text die Suche?
 *
 * UND zwischen den Wörtern, wie `plainto_tsquery` es auch tut: Wer
 * zwei Wörter nennt, meint beide. Weggefallen ist nur, was gar kein
 * Wort war.
 */
export function trifftSuche(text: string, eingabe: string): boolean {
  const woerter = suchwoerter(eingabe);
  if (woerter.length === 0) return true;
  const heuhaufen = text.toLowerCase();
  return woerter.every((w) => heuhaufen.includes(w));
}
