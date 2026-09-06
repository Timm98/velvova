/**
 * Aus „45 Minuten" wird „zwölf Stunden im Monat".
 *
 * ── Warum diese Umrechnung ein eigenes Stück ist ──────────────
 *
 * „45 Minuten Arbeitsweg" klingt erträglich. Zweimal täglich, zwei Tage
 * die Woche, das ganze Jahr — das sind rund 78 Stunden, also fast zehn
 * Arbeitstage. Dieselbe Zahl, zwei völlig verschiedene Auskünfte.
 *
 * Die erste beantwortet „wie weit ist das". Die zweite beantwortet
 * „was kostet mich das", und danach entscheidet man.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Keine Fahrzeit wird geschätzt. Diese Datei bekommt eine Dauer und
 * rechnet; woher die Dauer kommt, ist ihre Sache nicht. Luftlinie in
 * Fahrzeit umzurechnen wäre der naheliegende Fehler — zwischen zwei
 * Punkten in derselben Stadt liegt je nach Verbindung eine
 * Viertelstunde oder eine Dreiviertelstunde, und beide Zahlen sähen
 * gleich seriös aus.
 *
 * Solange kein Routingdienst angebunden ist, gibt es hier schlicht
 * nichts zu rechnen — und das ist ein ehrlicherer Zustand als eine
 * erfundene Minutenzahl.
 */

/**
 * Wochen je Monat.
 *
 * 52 durch 12, nicht 4. Der Unterschied sind knapp zwei Wochen im Jahr
 * — bei einem Arbeitsweg von einer Stunde also gut vier Stunden, die
 * sonst unter den Tisch fielen.
 */
export const WOCHEN_JE_MONAT = 52 / 12;

/**
 * Arbeitswochen je Jahr.
 *
 * 52 minus Urlaub und Feiertage, grob gerechnet. Wer 46 Wochen
 * arbeitet, pendelt nicht 52 — die Jahreszahl wäre sonst systematisch
 * zu hoch, und zwar in die Richtung, die dramatischer klingt.
 */
const ARBEITSWOCHEN_JE_JAHR = 46;

export interface Pendelrechnung {
  /** Eine Richtung, in Minuten. */
  einfachMinuten: number;
  /** Hin und zurück, in Minuten. */
  taeglichMinuten: number;
  buerotageJeWoche: number;
  woechentlichStunden: number;
  monatlichStunden: number;
  jaehrlichStunden: number;
  /**
   * Die Jahreszeit in Arbeitstagen zu acht Stunden.
   *
   * Der Satz, der die Zahl greifbar macht: „184 Stunden" sagt wenig,
   * „23 Arbeitstage" sagt alles.
   */
  jaehrlichArbeitstage: number;
}

/**
 * Wie viel Zeit dieser Weg tatsächlich kostet.
 *
 * `buerotageJeWoche` ist der Punkt, an dem sich Hybrid von Vor Ort
 * unterscheidet. Ein Arbeitsweg von einer Stunde ist bei zwei Bürotagen
 * eine andere Grösse als bei fünf — und genau diese Unterscheidung
 * fehlt, wenn nur „60 Minuten" dasteht.
 */
export function pendelrechnung(
  einfachMinuten: number,
  buerotageJeWoche: number,
): Pendelrechnung {
  const taeglich = einfachMinuten * 2;
  const woechentlichMinuten = taeglich * buerotageJeWoche;
  const woechentlich = woechentlichMinuten / 60;

  return {
    einfachMinuten,
    taeglichMinuten: taeglich,
    buerotageJeWoche,
    woechentlichStunden: runde(woechentlich),
    monatlichStunden: runde(woechentlich * WOCHEN_JE_MONAT),
    jaehrlichStunden: runde(woechentlich * ARBEITSWOCHEN_JE_JAHR),
    jaehrlichArbeitstage: runde((woechentlich * ARBEITSWOCHEN_JE_JAHR) / 8),
  };
}

/**
 * Dieselbe Rechnung für mehrere Bürotage nebeneinander.
 *
 * Bei einer Hybridstelle steht in der Anzeige oft „ein bis drei Tage".
 * Welcher es wird, verhandelt man — und dafür hilft es zu sehen, was
 * jeder einzelne kostet.
 */
export function beiBuerotagen(
  einfachMinuten: number,
  tage: number[] = [1, 2, 3],
): Pendelrechnung[] {
  return tage.map((t) => pendelrechnung(einfachMinuten, t));
}

/**
 * Pendelkosten je Monat, wenn der Mensch Kosten je Kilometer genannt hat.
 *
 * Ohne diese Angabe wird nichts gerechnet: Was ein Kilometer kostet,
 * hängt am Fahrzeug, am Verbrauch und am Spritpreis. Eine
 * Standardannahme wäre hier eine Zahl, die niemand geprüft hat und auf
 * die sich jemand verlässt.
 */
export function pendelkostenMonat(
  entfernungKm: number | null,
  buerotageJeWoche: number,
  kostenJeKm: number | null,
): number | null {
  if (entfernungKm === null || kostenJeKm === null) return null;
  const kmJeMonat = entfernungKm * 2 * buerotageJeWoche * WOCHEN_JE_MONAT;
  return runde(kmJeMonat * kostenJeKm);
}

function runde(n: number): number {
  return Math.round(n * 10) / 10;
}
