/**
 * Mehrere Berufe mit eigenem Mindestgehalt — in der Adresse und zurück.
 *
 * Eigene Datei, weil sie an zwei Orten gebraucht wird, die nichts
 * gemeinsam haben dürfen: die Stellenseite auf dem Server und der
 * Suchcomposer im Browser. Nebenan in `listenfilter.ts` steht der
 * Zugriff auf die Datenbank; von dort zu importieren hätte Drizzle
 * und die Verbindungsdaten ins Client-Bündel gezogen.
 *
 * Hier steht deshalb nur Umwandlung — keine Abfrage, kein Zustand.
 */
/**
 * Ein Suchzweig: ein Beruf mit seinem eigenen Mindestgehalt.
 *
 * Er ist absichtlich klein. Alles, was für die ganze Suche gilt —
 * Ort, Fahrzeit, Arbeitsmodell, Sortierung — steht weiterhin einmal
 * in der Adresse und nicht je Zweig. Sonst müsste man beim Ändern
 * eines gemeinsamen Wunsches jeden Zweig einzeln anfassen, und die
 * Adresse würde bei drei Berufen unlesbar.
 */
export interface Suchzweig {
  q: string;
  gehaltAb?: number;
}

/*
 * ══════════════════════════════════════════════════════════════
 * Warum EIN Parameter und nicht `?zweig=…&zweig=…`
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die ganze Seite Filter als `Record<string, string>` behandelt:
 * die Adresse (`searchParams`), das Blättern (`mehrParams`), das
 * Merken (`filterSpeichern`). Ein wiederholter Parameter kommt bei
 * Next als `string[]` an und hätte diese Kette an vier Stellen
 * aufgebrochen — für eine Schreibweise, die niemand sieht.
 *
 * Trennzeichen sind `;` zwischen den Zweigen und `~` zum Gehalt. Beide
 * kommen in Berufsbezeichnungen nicht vor; ein Komma täte das („Bad
 * Homburg, Hessen"), ein Doppelpunkt auch.
 *
 *   zweige=bürokaufmann~40000;elektriker~50000
 */
const ZWEIG_TRENNER = ";";
const GEHALT_TRENNER = "~";

/** Zweige aus dem Adressparameter — leer, wenn keiner drinsteht. */
export function zweigeLesen(wert: string | undefined | null): Suchzweig[] {
  if (!wert) return [];
  const zweige: Suchzweig[] = [];
  for (const stück of wert.split(ZWEIG_TRENNER)) {
    const [beruf = "", betrag] = stück.split(GEHALT_TRENNER);
    const q = beruf.trim();
    /*
     * Ein Zweig ohne Beruf ist kein Zweig.
     *
     * Er entstünde aus einem doppelten Trennzeichen oder einem
     * abgeschnittenen Link. Ihn als leere Suche durchzulassen hiesse:
     * ein Zweig, der auf alles passt — und der macht die anderen
     * wirkungslos.
     */
    if (q.length === 0) continue;
    const zahl = betrag === undefined ? Number.NaN : Number.parseInt(betrag, 10);
    zweige.push(Number.isFinite(zahl) && zahl > 0 ? { q, gehaltAb: zahl } : { q });
  }
  return zweige;
}

/** Zweige in den Adressparameter — `null`, wenn es weniger als zwei sind. */
export function zweigeSchreiben(zweige: Suchzweig[]): string | null {
  /*
   * Ein einzelner Zweig gehört nicht hierher.
   *
   * Er ist eine gewöhnliche Suche und steht als `q` und `gehaltAb` in
   * der Adresse — dort, wo jeder Filterknopf ihn findet und wieder
   * wegnehmen kann. Ihn zusätzlich als Zweig zu führen hiesse, für
   * dieselbe Sache zwei Wahrheiten zu haben.
   */
  if (zweige.length < 2) return null;
  return zweige
    .map((z) =>
      z.gehaltAb === undefined
        ? z.q
        : `${z.q}${GEHALT_TRENNER}${Math.round(z.gehaltAb)}`,
    )
    .join(ZWEIG_TRENNER);
}
