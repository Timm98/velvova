import { geteilt, minus, nichtNegativ, plus, zuEuro } from "../../core/dezimal.ts";
import { registriere, type Berechnung, type Eingabe, type PayrollProvider } from "../../core/types.ts";
import * as R from "./regeln.ts";
import { sozialversicherung } from "./sozialversicherung.ts";
import { steuer } from "./steuer.ts";

/**
 * Der deutsche Rechner für 2026.
 *
 * Er tut drei Dinge, und die Reihenfolge ist wichtig:
 *
 *   1. **Sagen, was er nicht kann.** Vor jeder Rechnung steht die
 *      Prüfung auf Konstellationen, die er nicht zuverlässig abbildet.
 *      Ein Grenzgänger, ein Beamter, ein Minijob — dafür gibt es hier
 *      keine Zahl, sondern einen Satz.
 *
 *   2. **Sozialversicherung rechnen.** Sie liefert nebenbei die
 *      Vorsorgepauschale, ohne die die Steuer viel zu hoch ausfiele.
 *
 *   3. **Steuer rechnen.** Auf dem Brutto abzüglich der Pauschalen.
 *
 * Was er NIE tut: eine Zahl nennen, die nach Gewissheit aussieht. Jedes
 * Ergebnis trägt die Regelwerksfassung, die Annahmen und den Hinweis,
 * dass die tatsächliche Abrechnung abweichen kann. Das ist keine
 * Rechtsabsicherung, sondern die Wahrheit: die Abrechnung hängt an
 * Angaben, die wir nicht kennen und die sich rückwirkend ändern.
 */

/**
 * Konstellationen, die dieser Rechner nicht abbildet.
 *
 * Jede davon würde eine plausible, falsche Zahl ergeben — und eine
 * plausible falsche Zahl über das eigene Einkommen ist schlimmer als
 * gar keine. Wer damit eine Gehaltsverhandlung führt, verhandelt gegen
 * sich selbst.
 */
function nichtAbgedeckt(e: Eingabe): string | null {
  if (e.steuerklasse === 6) {
    return (
      "Steuerklasse VI gilt für ein zweites Arbeitsverhältnis. Was dabei netto bleibt, hängt " +
      "auch am ersten — das kann ich hier nicht zuverlässig rechnen."
    );
  }
  if (e.krankenversicherung === "privat" && e.pkvBeitragMonat === 0) {
    return (
      "Bei privater Krankenversicherung brauche ich deinen tatsächlichen Beitrag. Er hängt an " +
      "Alter und Tarif und lässt sich nicht schätzen."
    );
  }
  const bruttoEuro = zuEuro(e.bruttoJahr);
  if (bruttoEuro > 0 && bruttoEuro < 6_672) {
    return (
      "Bei diesem Jahresbrutto greifen die Regeln für Minijob oder Übergangsbereich. Die " +
      "rechne ich noch nicht — die Beiträge laufen dort anders als im Normalfall."
    );
  }
  if (bruttoEuro > 1_000_000) {
    return "Bei diesem Betrag lohnt eine individuelle Berechnung mehr als eine Schätzung.";
  }
  return null;
}

class DeutschlandRechner2026 implements PayrollProvider {
  readonly land = "DE" as const;
  readonly steuerjahre = [R.STEUERJAHR];
  readonly regelwerkVersion = R.VERSION;
  readonly quellen = R.QUELLEN;
  readonly freigegeben = R.FREIGEGEBEN;

  unterstuetzt(land: string, steuerjahr: number): boolean {
    return land === "DE" && this.steuerjahre.includes(steuerjahr);
  }

  pruefe(e: Eingabe): string[] {
    const fehler: string[] = [];
    if (e.bruttoJahr <= 0) fehler.push("Bitte gib ein Bruttojahresgehalt an.");
    if (![12, 13, 14].includes(e.zahlungen)) fehler.push("Zahlungen müssen 12, 13 oder 14 sein.");
    if (e.zusatzbeitrag < 0 || e.zusatzbeitrag > 0.05) {
      fehler.push("Der Zusatzbeitrag deiner Krankenkasse liegt zwischen 0 und 5 Prozent.");
    }
    if (e.kinderfreibetraege < 0 || e.kinderfreibetraege > 12) {
      fehler.push("Die Zahl der Kinderfreibeträge sieht nicht plausibel aus.");
    }
    return fehler;
  }

  berechne(e: Eingabe): Berechnung {
    const gesperrt = nichtAbgedeckt(e);
    if (gesperrt) return { abgedeckt: false, grund: gesperrt };

    const sv = sozialversicherung(e);
    const st = steuer(e, sv.vorsorgepauschale);

    const bruttoGesamt = plus(e.bruttoJahr, e.sonstigeBezuege);
    const abzuegeJahr = plus(sv.summeJahr, st.summeJahr);
    const nettoJahr = nichtNegativ(minus(bruttoGesamt, abzuegeJahr));

    const annahmen: string[] = [];
    if (e.zusatzbeitrag === 0 && e.krankenversicherung === "gesetzlich") {
      annahmen.push("Zusatzbeitrag der Krankenkasse: 0 % — trag deinen ein, das ändert das Netto spürbar.");
    }
    if (e.geburtsjahr === null && !e.hatKinder) {
      annahmen.push(
        `Kinderlosenzuschlag zur Pflegeversicherung angesetzt (gilt ab ${R.PFLEGE_KINDERLOS_AB_ALTER} Jahren).`,
      );
    }
    if (e.freibetragJahr === 0) annahmen.push("Kein eingetragener Lohnsteuerfreibetrag.");

    const hinweise = [...sv.hinweise];
    /*
     * Der Vorbehalt zur Prüfung steht auf Anweisung nicht mehr in der
     * Oberfläche.
     *
     * Er lautete: „Dieses Regelwerk ist noch nicht gegen die amtlichen
     * Testfälle geprüft." Das ist weiterhin wahr — `R.FREIGEGEBEN`
     * steht auf false, und daran hat sich nichts geändert.
     *
     * Was fehlt, ist also nicht die Prüfung, sondern ihr Hinweis. Wer
     * das Regelwerk gegen die amtlichen Testfälle prüft, setzt danach
     * `FREIGEGEBEN` auf true; bis dahin liefert der Rechner Zahlen
     * ohne diesen Vorbehalt.
     */


    return {
      abgedeckt: true,
      land: "DE",
      steuerjahr: R.STEUERJAHR,
      regelwerkVersion: R.VERSION,

      bruttoJahr: bruttoGesamt,
      bruttoMonat: geteilt(bruttoGesamt, 12),
      nettoJahr,
      nettoMonat: geteilt(nettoJahr, 12),
      nettoJeZahlung: geteilt(nettoJahr, e.zahlungen),

      abzuegeJahr,
      abzugsquote: bruttoGesamt > 0 ? abzuegeJahr / bruttoGesamt : 0,

      steuern: st.abzuege,
      sozialversicherung: sv.abzuege,

      annahmen,
      hinweise,
    };
  }
}

export const deutschland2026 = new DeutschlandRechner2026();
registriere(deutschland2026);
