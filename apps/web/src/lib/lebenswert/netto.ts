import { rechnerFuer, zuEuro, type Eingabe } from "../payroll";
import { eingabeAus } from "../payroll/eingabe.ts";
import { ladeGehaltsangaben } from "../payroll/einstellungen";

/**
 * Das Netto der aktuellen Stelle — als Ausgangspunkt jeder Rechnung.
 *
 * ── Warum das hier steht und nicht im Formular ────────────────
 *
 * Steuern gehören in ein Regelwerk mit Jahreszahl, nicht in eine
 * Haushaltsrechnung. `rechnung.ts` bekommt deshalb einen fertigen
 * Nettobetrag und rechnet nur noch Kosten ab — sie kennt keine
 * Steuerklasse und soll keine kennen.
 *
 * Diese Datei ist die Brücke: Brutto und Steuerangaben hinein,
 * Nettobetrag heraus, und `null`, wenn eines von beidem fehlt.
 *
 * ── Warum `null` und keine Annahme ────────────────────────────
 *
 * Ohne Bruttoangabe liesse sich mit einem Durchschnittsgehalt rechnen.
 * Das Ergebnis sähe aus wie eine Auskunft über das eigene Leben und
 * wäre eine über ein statistisches Mittel — und niemand prüft eine
 * Zahl nach, die plausibel aussieht.
 */

export interface Nettobefund {
  nettoMonat: number | null;
  /** Warum es keine Zahl gibt. `null`, wenn es eine gibt. */
  grund: string | null;
}

/**
 * Aus einem Bruttojahresgehalt ein monatliches Netto.
 *
 * Die Steuerangaben kommen aus dem Gehaltsprofil, soweit gepflegt.
 * Fehlen sie, gelten dieselben Standardannahmen wie in der
 * Jobansicht — sichtbar gemacht, nicht versteckt.
 */
export async function nettoAusBrutto(
  bruttoJahr: number | null,
  land = "DE",
): Promise<Nettobefund> {
  if (bruttoJahr === null || bruttoJahr <= 0) {
    return {
      nettoMonat: null,
      grund: "Für eine Nettorechnung fehlt das Bruttogehalt deiner aktuellen Stelle.",
    };
  }

  const rechner = rechnerFuer(land as Eingabe["land"], 2026);
  if (!rechner) {
    return {
      nettoMonat: null,
      grund: `Für ${land} habe ich noch kein Steuerregelwerk.`,
    };
  }

  const a = await ladeGehaltsangaben().catch(() => null);

  /*
   * Dieselbe Zuordnung wie überall sonst.
   *
   * Hier stand sie einmal ausgeschrieben — und setzte die Zahl der
   * Kinderfreibeträge fest auf null. Die Lebenshaltungsseite rechnete
   * deshalb für jemanden mit Kindern ein anderes Netto als die
   * Jobseite für dasselbe Gehalt. Seit `eingabeAus` gibt es nur noch
   * eine Fassung.
   *
   * Und kein `as Eingabe` mehr: Der Cast hatte zwei fehlende Felder
   * verschwiegen — `geburtsjahr` und `freibetragJahr`. Der Rechner
   * bekam `undefined`, rechnete weiter und gab `NaN` zurück, während
   * `abgedeckt` auf `true` stand. Die Rechnung meldete Erfolg und
   * lieferte keine Zahl.
   */
  const ergebnis = rechner.berechne(eingabeAus(a, bruttoJahr, land));

  if (!ergebnis.abgedeckt) {
    return {
      nettoMonat: null,
      grund: ergebnis.grund ?? "Diese Konstellation kann ich nicht zuverlässig rechnen.",
    };
  }

  return { nettoMonat: Math.round(zuEuro(ergebnis.nettoMonat)), grund: null };
}
