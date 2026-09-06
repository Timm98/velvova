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
 * Dreieinhalb reichen, um die Zahl laufen zu sehen, und sind kurz
 * genug, dass niemand darauf wartet.
 */
export const ANLAUF_MS = 3500;

export function zaehlerBasis(): number {
  return (typeof performance !== "undefined" ? performance.timeOrigin : Date.now()) + ANLAUF_MS;
}

export function standJetzt(genau: number, proSekunde: number): number {
  const vergangen = Math.max(0, Date.now() - zaehlerBasis()) / 1000;
  return Math.floor(genau + vergangen * proSekunde);
}
