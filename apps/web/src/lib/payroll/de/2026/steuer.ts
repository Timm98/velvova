import {
  abgerundetAufEuro,
  ausEuro,
  mal,
  minus,
  nichtNegativ,
  plus,
  zuEuro,
  type Betrag,
} from "../../core/dezimal.ts";
import type { Abzug, Eingabe } from "../../core/types.ts";
import * as R from "./regeln.ts";

/**
 * Lohnsteuer, Solidaritätszuschlag, Kirchensteuer.
 *
 * Der Kern ist §32a EStG — eine stückweise definierte Funktion mit vier
 * Knicken. Sie sieht nach willkürlichen Beiwerten aus und ist es nicht:
 * die Zahlen sorgen dafür, dass der Grenzsteuersatz stetig ansteigt,
 * statt an den Zonengrenzen zu springen.
 *
 * Drei Dinge, die eine selbstgebaute Lohnsteuer fast immer falsch macht:
 *
 *   **Die Vorsorgepauschale fehlt.** Dann ist die Steuer um mehrere
 *   tausend Euro im Jahr zu hoch. Sie kommt hier aus der
 *   Sozialversicherung herüber — deshalb sind die beiden getrennt und
 *   trotzdem verbunden.
 *
 *   **Der Soli springt.** Seit 2021 gibt es eine Freigrenze und darüber
 *   eine Milderungszone. Wer nur die Freigrenze kennt, lässt ihn bei
 *   einem Euro Mehrverdienst von null auf mehrere hundert Euro
 *   springen.
 *
 *   **Kinderfreibeträge werden ignoriert.** Sie mindern nicht die
 *   Lohnsteuer, wohl aber die Bemessungsgrundlage von Soli und
 *   Kirchensteuer. Eine Eigenheit, die man nicht errät.
 *
 * ── Zur Genauigkeit ───────────────────────────────────────────
 *
 * Diese Umsetzung folgt dem Aufbau des amtlichen Programmablaufplans,
 * ist aber nicht Zeile für Zeile aus ihm übersetzt. Sie ist deshalb als
 * SCHÄTZUNG gekennzeichnet und das Regelwerk steht auf
 * `FREIGEGEBEN = false`. Was hier fehlt, um das zu ändern, ist kein
 * weiterer Code, sondern ein Abgleich gegen die amtlichen Testfälle.
 */

export interface SteuerErgebnis {
  abzuege: Abzug[];
  summeJahr: Betrag;
  /** Das zu versteuernde Einkommen — für die Aufschlüsselung. */
  bemessungsgrundlage: Betrag;
}

/**
 * Die Einkommensteuer nach §32a EStG.
 *
 * Eingabe ist das zu versteuernde Einkommen, auf volle Euro
 * abgerundet — so schreibt es das Gesetz vor, und die Abrundung ist
 * nicht kosmetisch: sie verschiebt das Ergebnis um bis zu einige Euro.
 */
export function tarif(zvE: Betrag): Betrag {
  const x = zuEuro(abgerundetAufEuro(zvE));

  if (x <= zuEuro(R.TARIF.zone1Ende)) return 0;

  if (x <= zuEuro(R.TARIF.zone2Ende)) {
    // y ist der Anteil oberhalb des Grundfreibetrags, in Zehntausendstel.
    const y = (x - zuEuro(R.TARIF.zone1Ende)) / 10_000;
    return ausEuro(Math.floor((R.TARIF.zone2A * y + R.TARIF.zone2B) * y));
  }

  if (x <= zuEuro(R.TARIF.zone3Ende)) {
    const z = (x - zuEuro(R.TARIF.zone2Ende)) / 10_000;
    return ausEuro(Math.floor((R.TARIF.zone3A * z + R.TARIF.zone3B) * z + R.TARIF.zone3C));
  }

  if (x <= zuEuro(R.TARIF.zone4Ende)) {
    return ausEuro(Math.floor(R.TARIF.zone4Satz * x - R.TARIF.zone4Abzug));
  }

  return ausEuro(Math.floor(R.TARIF.zone5Satz * x - R.TARIF.zone5Abzug));
}

/**
 * Der Splittingtarif für Steuerklasse 3.
 *
 * Die Steuer auf das halbe Einkommen, verdoppelt. Dass das weniger ist
 * als die Steuer auf das ganze, liegt allein an der Progression.
 */
function tarifMitSplitting(zvE: Betrag, steuerklasse: number): Betrag {
  if (steuerklasse === 3) return mal(tarif(Math.round(zvE / 2)), 2);
  return tarif(zvE);
}

export function steuer(e: Eingabe, vorsorgepauschale: Betrag): SteuerErgebnis {
  const abzuege: Abzug[] = [];
  const bruttoGesamt = plus(e.bruttoJahr, e.sonstigeBezuege);

  /*
   * Vom Brutto zum zu versteuernden Einkommen.
   *
   * Abgezogen werden: Arbeitnehmer-Pauschbetrag, Sonderausgaben-
   * pauschbetrag, die Vorsorgepauschale, ein etwaiger Freibetrag und
   * — nur in Steuerklasse 2 — der Entlastungsbetrag für Alleinerziehende.
   */
  let zvE = minus(bruttoGesamt, R.ARBEITNEHMER_PAUSCHBETRAG);
  zvE = minus(zvE, R.SONDERAUSGABEN_PAUSCHBETRAG);
  zvE = minus(zvE, vorsorgepauschale);
  zvE = minus(zvE, e.freibetragJahr);
  if (e.steuerklasse === 2) zvE = minus(zvE, R.ENTLASTUNGSBETRAG_ALLEINERZIEHEND);
  zvE = nichtNegativ(zvE);

  const lohnsteuer = nichtNegativ(tarifMitSplitting(zvE, e.steuerklasse));

  abzuege.push({
    key: "lohnsteuer",
    label: "Lohnsteuer",
    jahr: lohnsteuer,
    erklaerung:
      e.steuerklasse === 3
        ? "Nach dem Splittingtarif der Steuerklasse III berechnet."
        : `Nach dem Einkommensteuertarif für Steuerklasse ${roemisch(e.steuerklasse)}.`,
  });

  /*
   * Soli und Kirchensteuer setzen auf einer ANDEREN Bemessungsgrundlage
   * auf: der Lohnsteuer, die sich mit Kinderfreibeträgen ergäbe.
   *
   * Das ist der Punkt, den man nicht errät. Kinderfreibeträge mindern
   * die Lohnsteuer selbst nicht — wer Kindergeld bekommt, bekommt sie
   * nicht zusätzlich. Für Soli und Kirchensteuer werden sie aber
   * angerechnet.
   */
  const zvEmitKindern = nichtNegativ(
    minus(zvE, mal(R.KINDERFREIBETRAG_VOLL, e.kinderfreibetraege)),
  );
  const bemessungSoliKirche = nichtNegativ(tarifMitSplitting(zvEmitKindern, e.steuerklasse));

  const soli = solidaritaetszuschlag(bemessungSoliKirche, e.steuerklasse === 3);
  if (soli > 0) {
    abzuege.push({
      key: "soli",
      label: "Solidaritätszuschlag",
      jahr: soli,
      erklaerung:
        "Seit 2021 nur noch auf hohe Einkommen. In der Milderungszone steigt er langsam auf 5,5 % an.",
    });
  }

  if (e.kirchensteuer) {
    const satz = R.KIRCHENSTEUERSATZ[e.bundesland];
    const kirche = mal(bemessungSoliKirche, satz);
    abzuege.push({
      key: "kirche",
      label: "Kirchensteuer",
      jahr: kirche,
      erklaerung: `${(satz * 100).toFixed(0)} % der Lohnsteuer — der Satz deines Bundeslandes.`,
    });
  }

  return {
    abzuege,
    summeJahr: plus(...abzuege.map((a) => a.jahr)),
    bemessungsgrundlage: zvE,
  };
}

/**
 * Der Solidaritätszuschlag mit Freigrenze und Milderungszone.
 *
 * Drei Bereiche:
 *   unter der Freigrenze          → null
 *   in der Milderungszone         → 11,9 % des Betrags über der Grenze
 *   darüber                       → 5,5 % der Lohnsteuer
 *
 * Der mittlere Bereich existiert genau deshalb, weil ein Sprung von
 * null auf mehrere hundert Euro bei einem Euro Mehrverdienst absurd
 * wäre. Ihn wegzulassen ist der häufigste Fehler in Eigenbau-Rechnern.
 */
export function solidaritaetszuschlag(lohnsteuer: Betrag, zusammenveranlagt: boolean): Betrag {
  const freigrenze = zusammenveranlagt ? R.SOLI.freigrenzeZusammen : R.SOLI.freigrenzeEinzeln;
  if (lohnsteuer <= freigrenze) return 0;

  const voll = mal(lohnsteuer, R.SOLI.satz);
  const gemildert = mal(minus(lohnsteuer, freigrenze), R.SOLI.milderungssatz);
  // Der kleinere von beiden — so läuft die Milderungszone stetig in den
  // vollen Satz hinein.
  return Math.min(voll, gemildert);
}

function roemisch(n: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI"][n] ?? String(n);
}
