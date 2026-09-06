import { entfernungKm } from "@paycheck/matching";

/**
 * Wie lange man zu einer Stelle fährt — aus Koordinaten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nötig wurde
 * ══════════════════════════════════════════════════════════════
 *
 * Die Fahrzeit kam bisher aus einer Tabelle mit vier Städten:
 * Hamburg, Berlin, München, Köln. Für alles andere gab sie `null`.
 *
 * Solange die Zahl nur in eine Bewertung einging, fiel das kaum auf.
 * Als sie ein FILTER wurde, war die Folge sofort sichtbar: „höchstens
 * 120 Minuten" liess nichts übrig, weil für fast jede Stelle gar
 * keine Fahrzeit bekannt war — und eine leere Liste sieht aus wie ein
 * leerer Arbeitsmarkt.
 *
 * Die Koordinaten gibt es längst: 90 Prozent der Anzeigen tragen
 * Breite und Länge, seit die Geodaten nachgezogen wurden.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Zahl ist — und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Luftlinie mal einem Umwegfaktor, geteilt durch eine
 * Durchschnittsgeschwindigkeit. Das ist eine Schätzung und keine
 * Routenberechnung: Sie kennt keine Baustelle, keinen Berufsverkehr
 * und keine Fähre.
 *
 * Sie ist trotzdem ehrlicher als die Tabelle mit vier Städten, weil
 * sie für 90 Prozent der Stellen überhaupt eine Antwort hat. Und sie
 * ist konservativ gewählt: lieber etwas zu lang geschätzt als eine
 * Stelle zeigen, für die jemand in Wahrheit länger fährt, als er
 * wollte.
 */

/**
 * Umweg gegenüber der Luftlinie.
 *
 * Strassen fahren nicht geradeaus. 1,3 ist der übliche Wert für
 * deutsche Verhältnisse — bei Autobahnverbindungen weniger, in
 * Mittelgebirgen mehr.
 */
const UMWEG = 1.3;

/**
 * Durchschnittsgeschwindigkeit in km/h, je Verkehrsmittel.
 *
 * Für das Auto bewusst nicht die Autobahngeschwindigkeit: Ein
 * Arbeitsweg beginnt und endet in einer Stadt, und dort sind es
 * dreissig. Über eine Stunde gemittelt kommt man auf etwa siebzig.
 */
const TEMPO: Record<string, number> = {
  car: 70,
  transit: 40,
  bike: 16,
  walk: 5,
};

export interface Punkt {
  latitude: number;
  longitude: number;
}

/**
 * Die geschätzte Fahrzeit in Minuten — oder `null`.
 *
 * `null` heisst: nicht berechenbar, weil eine der beiden Koordinaten
 * fehlt. Das ist eine Auskunft und kein Nullwert; wer sie als „null
 * Minuten" liest, zeigt jede Stelle als um die Ecke.
 */
export function fahrzeitMinuten(
  von: Punkt | null,
  nach: { latitude: number | null; longitude: number | null },
  mittel: string | null,
): number | null {
  if (!von) return null;
  if (nach.latitude === null || nach.longitude === null) return null;

  const km = entfernungKm(von.latitude, von.longitude, nach.latitude, nach.longitude);
  const tempo = TEMPO[mittel ?? "car"] ?? TEMPO.car!;

  /*
   * Mindestens fünf Minuten.
   *
   * Zwei Adressen in derselben Stadt ergeben rechnerisch zwei
   * Minuten. Niemand ist in zwei Minuten bei der Arbeit — und eine
   * Zahl, die offensichtlich nicht stimmt, macht die ganze Angabe
   * unglaubwürdig.
   */
  return Math.max(5, Math.round(((km * UMWEG) / tempo) * 60));
}
