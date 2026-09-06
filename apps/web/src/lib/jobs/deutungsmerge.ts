/**
 * Regeln und Modell zu einem Filterstand zusammenführen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine eigene Datei mit Tests ist
 * ══════════════════════════════════════════════════════════════
 *
 * Weil derselbe Fehler hier zweimal aufgetreten ist: „bayern" stand
 * als Plättchen doppelt da — einmal als Suchwort, einmal als Ort.
 *
 * Beide Male lag es an derselben Sache. `deuteSuchintention` legt
 * alles, was es nicht kennt, ZUSÄTZLICH nach `q`. Das ist als
 * Rückfall richtig und wird falsch, sobald danach noch jemand
 * hinsieht — und genau dafür ist das Modell da.
 *
 * In der Route stand die Regel als vier Zeilen zwischen zwanzig
 * anderen. Hier steht sie allein und ist geprüft.
 */

/**
 * Ob im Satz von Entfernung die Rede ist.
 *
 * ── Warum das geprüft wird ────────────────────────────────────
 *
 * „Will höchstens 2 Stunden Auto fahren" ergab `pendelzeit=120` UND
 * `umkreisKm=120`. Das Modell hatte die Stunden richtig umgerechnet
 * und die Zahl danach in beide Felder gelegt — zwei Plättchen, von
 * denen die Person nur eines gemeint hat.
 *
 * Wo keine Entfernung steht, wird auch keine gesetzt. Die Prüfung
 * ist billiger und sicherer als jede Ermahnung im Prompt.
 */
const ENTFERNUNG = /\b(km|kilometer|meilen|umkreis|radius|entfernung|weit weg|nähe)\b/i;

export interface Deutungsteile {
  /** Der ganze Satz — für Prüfungen, die den Wortlaut brauchen. */
  eingabe?: string;
  /** Was der Regelabgleich sicher erkannt hat. */
  regeln: Record<string, unknown>;
  /** Was das Modell aus dem Rest gemacht hat. `null` heisst: nichts. */
  modell: Record<string, unknown>;
  /** Die Filter, die weg sollen — bereits auf Wegnahme geprüft. */
  entfernen: readonly string[];
}

/**
 * Der zusammengeführte Filterstand.
 *
 * ── Die Reihenfolge, und warum sie so ist ─────────────────────
 *
 *   1. Das Modell legt vor
 *   2. Die Regeln überschreiben — sie sind sicher
 *   3. `q` aus den Regeln nur, wenn das Modell nichts fand
 *   4. Was entfernt wird, fällt zuletzt heraus
 *
 * Schritt 2 überschreibt, statt zu prüfen. Eine Prüfung müsste
 * entscheiden, welche der beiden Zahlen stimmt; diese Reihenfolge
 * muss nichts entscheiden.
 */
export function deutungZusammenfuehren({
  eingabe,
  regeln,
  modell,
  entfernen,
}: Deutungsteile): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(modell)) {
    if (v !== null && v !== undefined && v !== "") filter[k] = v;
  }

  const { q: regelQ, ...regelOhneQ } = regeln;
  for (const [k, v] of Object.entries(regelOhneQ)) {
    if (v !== null && v !== undefined && v !== "") filter[k] = v;
  }

  /*
   * Der Rückfall greift nur, wenn das Modell gar nichts gefunden hat.
   *
   * Sonst verlöre „Lagerhelfer in Bayern" das Wort „Lagerhelfer",
   * sobald der Ort erkannt ist — und die Liste zeigte alles in Bayern.
   * Findet das Modell etwas, legt es den übrigen Text selbst nach `q`.
   */
  const modellHatEtwasGefunden = Object.entries(modell).some(
    ([k, v]) => k !== "q" && v !== null && v !== undefined && v !== "",
  );
  if (filter.q === undefined && !modellHatEtwasGefunden && regelQ) {
    filter.q = regelQ;
  }

  /*
   * Eine Entfernung, von der niemand gesprochen hat.
   *
   * Der Fall: „Höchstens 2 Stunden Auto" wurde zu `pendelzeit=120`
   * und `umkreisKm=120`. Steht im Satz kein Wort für Entfernung und
   * hat der Regelabgleich keine gefunden, dann gibt es keine.
   */
  if (
    eingabe !== undefined &&
    filter.umkreisKm !== undefined &&
    regeln.umkreisKm === undefined &&
    !ENTFERNUNG.test(eingabe)
  ) {
    delete filter.umkreisKm;
  }

  for (const k of entfernen) delete filter[k];
  return filter;
}
