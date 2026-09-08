/**
 * Welche Adressparameter Filter sind — und welche nicht.
 *
 * Eigene Datei, weil die Liste an beiden Enden gebraucht wird: auf
 * dem Server, um den zuletzt benutzten Stand zu speichern, und im
 * Browser, um bei „lösch alle Filter" zu wissen, was überhaupt
 * gelöscht gehört. Nebenan in `listenfilter.ts` steht der
 * Datenbankzugriff; von dort zu importieren hätte ihn ins
 * Client-Bündel gezogen.
 */
export const FILTER_SCHLUESSEL = [
  "q",
  "nicht",
  "ort",
  "ortGenau",
  "umkreisKm",
  "pendelzeit",
  "remote",
  "contract",
  "arbeitszeit",
  "schicht",
  "gehaltAb",
  "salary",
  "since",
  /* Die Wahl „nur dieses Land" beziehungsweise „überall". */
  "land",
  /*
   * Mehrere Berufe mit eigenem Gehalt — siehe `zweigeLesen`.
   *
   * Er gehört zu den gespeicherten Filtern, weil er genau die Frage
   * beantwortet, um die es hier geht: wonach suche ich. Wer zwei
   * Berufe eingestellt hat, will sie beim nächsten Besuch wiederhaben
   * — nicht den ersten davon.
   */
  "zweige",
] as const;

export type Filterschluessel = (typeof FILTER_SCHLUESSEL)[number];

/*
 * Der Zweig-Codec liegt in `zweige.ts`.
 *
 * Diese Datei greift auf die Datenbank zu — sie lädt und speichert
 * den zuletzt benutzten Stand. Der Composer im Browser braucht aber
 * nur das Umwandeln, und ein Import von hier hätte Drizzle und die
 * Verbindung ins Client-Bündel gezogen.
 */
export { zweigeLesen, zweigeSchreiben, type Suchzweig } from "./zweige.ts";


function istFilter(k: string): k is Filterschluessel {
  return (FILTER_SCHLUESSEL as readonly string[]).includes(k);
}

/** Nur die Filter aus einem Adressobjekt — der Rest bleibt draussen. */
export function nurFilter(params: Record<string, string | undefined>): Record<string, string> {
  const raus: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    if (istFilter(k)) raus[k] = v;
  }
  return raus;
}
