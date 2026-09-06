import type { Ampelstufe } from "./befundton";

/**
 * Die Farbe für einen Wert, der gegen DEINE Vorgabe steht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht dieselbe Ampel wie sonst ist
 * ══════════════════════════════════════════════════════════════
 *
 * Passung, Anzeigenqualität und Sicherheit sind Werte von 0 bis 100.
 * Für sie gibt es feste Schwellen — 50 und 75 —, weil die Skala selbst
 * die Bedeutung trägt.
 *
 * Gehalt und Pendelzeit sind anders. 55.000 Euro sind für die eine
 * Person ein Aufstieg und für die andere ein Rückschritt; 40 Minuten
 * sind für die eine unzumutbar und für die andere die halbe bisherige
 * Fahrt. Eine feste Skala gäbe es nur, wenn man beschlösse, was viel
 * ist — und das steht uns nicht zu.
 *
 * Verglichen wird deshalb gegen die eigene Vorgabe. Ohne Vorgabe gibt
 * es keine Farbe: Eine Zahl einzufärben, für die niemand ein Ziel
 * genannt hat, wäre ein Urteil, das wir uns anmassen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Bereich um die Vorgabe herum
 * ══════════════════════════════════════════════════════════════
 *
 * Wer 60.000 nennt, meint nicht, dass 59.500 unzumutbar sind. Eine
 * harte Grenze machte aus jeder knappen Verfehlung ein Rot und aus
 * jeder knappen Erfüllung ein Grün — und der Unterschied zwischen den
 * beiden wäre ein Euro.
 *
 * Deshalb: erfüllt ist grün, knapp verfehlt ist gelb, deutlich
 * verfehlt ist rot. „Knapp" heisst hier zehn Prozent der Vorgabe.
 */

export const TOLERANZ = 0.1;

export type Richtung = "hoeher_besser" | "niedriger_besser";

export function vorgabenampel(
  wert: number | null,
  vorgabe: number | null,
  richtung: Richtung,
): Ampelstufe | null {
  if (wert === null || vorgabe === null || vorgabe <= 0) return null;

  const erfuellt = richtung === "hoeher_besser" ? wert >= vorgabe : wert <= vorgabe;
  if (erfuellt) return "gruen";

  /*
   * Der Abstand relativ zur Vorgabe, nicht absolut.
   *
   * Fünf Minuten über einer Wunschzeit von 20 sind ein Viertel mehr;
   * fünf Minuten über 60 sind ein Zwölftel. Absolut gerechnet wäre
   * beides gleich schlimm.
   */
  const abstand = Math.abs(wert - vorgabe) / vorgabe;
  return abstand <= TOLERANZ ? "gelb" : "rot";
}

/**
 * Ein Satz zum Vergleich — oder `null`.
 *
 * Ohne Vorgabe kein Satz. „Du hast dazu nichts festgelegt" wäre eine
 * Zeile mehr, die nichts über die Stelle sagt, und davon hat diese
 * Seite genug gehabt.
 */
export function vorgabensatz(
  wert: number | null,
  vorgabe: number | null,
  richtung: Richtung,
  einheit: (n: number) => string,
): string | null {
  const stufe = vorgabenampel(wert, vorgabe, richtung);
  if (stufe === null || wert === null || vorgabe === null) return null;

  if (stufe === "gruen") {
    return richtung === "hoeher_besser"
      ? `Liegt bei oder über deiner Vorgabe von ${einheit(vorgabe)}.`
      : `Bleibt unter deiner Grenze von ${einheit(vorgabe)}.`;
  }

  const differenz = Math.abs(wert - vorgabe);
  return richtung === "hoeher_besser"
    ? `${einheit(differenz)} unter deiner Vorgabe von ${einheit(vorgabe)}.`
    : `${einheit(differenz)} über deiner Grenze von ${einheit(vorgabe)}.`;
}
