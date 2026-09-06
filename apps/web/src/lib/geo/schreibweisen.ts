/**
 * Die Schreibweisen, in denen ein Ort gesucht wird.
 *
 * ── Was das behebt ────────────────────────────────────────────
 *
 * Stellenanzeigen führen den Ort oft dreiteilig: „Meckenheim,
 * Rheinland, Nordrhein-Westfalen". Das mittlere Segment ist eine
 * historische Landschaft, keine Verwaltungseinheit — der Geokodierer
 * findet die Kombination nicht.
 *
 * Gemessen an genau diesem Ort:
 *
 *   Meckenheim, Rheinland, Nordrhein-Westfalen   nicht gefunden
 *   Meckenheim, Nordrhein-Westfalen              gefunden
 *   Meckenheim                                   gefunden
 *
 * Ohne diese Leiter fiel jede solche Anzeige aus dem Arbeitsweg
 * heraus — lautlos, weil eine fehlende Fahrzeit aussieht wie eine
 * Stelle ohne Ort.
 *
 * ── Warum von genau nach grob ─────────────────────────────────
 *
 * Die vollständige Angabe zuerst: Sie unterscheidet gleichnamige Orte.
 * Erst wenn sie nichts ergibt, wird gekürzt — der Ortsname allein
 * steht zuletzt, weil er am ehesten mehrdeutig ist.
 */
export function schreibweisen(ort: string): string[] {
  const teile = ort
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const raus = [ort];
  /* Erstes und letztes Segment: die Stadt und die Verwaltungseinheit. */
  if (teile.length > 2) raus.push(`${teile[0]}, ${teile[teile.length - 1]}`);
  if (teile.length > 1) raus.push(teile[0]!);
  /* Doppelte fallen heraus — sonst wird dieselbe Anfrage zweimal gestellt. */
  return [...new Set(raus)];
}
