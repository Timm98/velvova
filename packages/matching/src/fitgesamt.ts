/**
 * Der Fit Score — die eine Zahl, die Liste und Ansicht teilen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht in der Oberfläche
 * ══════════════════════════════════════════════════════════════
 *
 * Die Zahl wird an zwei Orten gebraucht: Die Oberfläche zeigt sie und
 * färbt danach, die Sortierung ordnet danach.
 *
 * Solange die Sortierung nach `overall.score` ging und die Anzeige nach
 * einer eigenen Formel rechnete, konnten beide auseinanderlaufen —
 * oben in der Liste stand dann eine Stelle mit einer kleineren Zahl als
 * die darunter. Das ist der Fehler, den niemand meldet und dem jeder
 * misstraut.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Gewichte
 * ══════════════════════════════════════════════════════════════
 *
 * Die Passung wiegt am schwersten: Eine tadellos geschriebene Anzeige
 * für einen Beruf, der nicht passt, ist keine gute Stelle.
 *
 * Die Sicherheit wiegt am leichtesten — sie sagt nichts über die
 * Stelle, sondern über unseren Kenntnisstand. Ein dünnes Profil darf
 * eine gute Stelle nicht nach unten ziehen.
 */
export const FIT_GEWICHTE = { passung: 0.5, qualitaet: 0.3, sicherheit: 0.2 } as const;

/**
 * Aus den vorhandenen Werten rechnen.
 *
 * Fehlt einer, verteilt sich sein Gewicht auf die übrigen — eine
 * fehlende Angabe ist kein schlechter Wert. Erst wenn gar nichts
 * vorliegt, gibt es keine Zahl.
 */
export function fitGesamt(
  passung: number | null,
  qualitaet: number | null,
  sicherheit: number | null,
): number | null {
  const teile: [number, number][] = [];
  if (passung !== null) teile.push([passung, FIT_GEWICHTE.passung]);
  if (qualitaet !== null) teile.push([qualitaet, FIT_GEWICHTE.qualitaet]);
  if (sicherheit !== null) teile.push([sicherheit, FIT_GEWICHTE.sicherheit]);

  if (teile.length === 0) return null;

  const summe = teile.reduce((n, [, g]) => n + g, 0);
  return Math.round(teile.reduce((n, [w, g]) => n + w * g, 0) / summe);
}
