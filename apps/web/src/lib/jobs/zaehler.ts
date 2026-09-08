/*
 * Der gemeinsame Bezugspunkt beider Zähler.
 *
 * Die Zahl steht zweimal im Bild: gross in der Überschrift und klein
 * im Platzhalter der Suche. Beide rechnen dieselbe Formel, aber jeder
 * mit seinem eigenen Startzeitpunkt — und schon standen zwei Werte da,
 * die sich um eins unterschieden. Auf demselben Bildschirm liest das
 * niemand als Rundung, sondern als Fehler.
 *
 * `performance.timeOrigin` ist der Moment, in dem das Dokument
 * angelegt wurde: für alle Komponenten derselbe Wert, unabhängig
 * davon, wann sie eingehängt werden. Plus die zwei Sekunden Anlauf
 * ergibt das eine Zeitbasis, aus der beide dieselbe Zahl ableiten.
 */
/**
 * Wie lange der Anlauf dauert.
 *
 * Zwei Sekunden waren vorbei, bevor die Seite fertig geladen war.
 * Dreieinhalb reichten, um die Zahl laufen zu sehen — und waren zu
 * lang: Solange der Anlauf läuft, steht dort nicht der Bestand,
 * sondern eine Annäherung von unten. Wer in dieser Zeit liest, liest
 * eine Zahl, die noch nicht stimmt.
 *
 * Jetzt 1.600 Millisekunden. Die Bewegung ist weiterhin zu sehen, der
 * echte Stand aber mehr als doppelt so früh erreicht.
 *
 * Was NICHT schneller wird, ist die Rate danach: Die kommt aus dem
 * gemessenen Zulauf. Sie hochzudrehen hiesse, mehr Stellen zu zeigen,
 * als es gibt — der Zähler wäre dann eine Animation und keine Angabe.
 */
export const ANLAUF_MS = 1600;

export function zaehlerBasis(): number {
  return (typeof performance !== "undefined" ? performance.timeOrigin : Date.now()) + ANLAUF_MS;
}

export function standJetzt(genau: number, proSekunde: number): number {
  const vergangen = Math.max(0, Date.now() - zaehlerBasis()) / 1000;
  return Math.floor(genau + vergangen * proSekunde);
}
