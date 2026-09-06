import {
  hoechstens,
  mal,
  plus,
  type Betrag,
} from "../../core/dezimal.ts";
import type { Abzug, Eingabe } from "../../core/types.ts";
import * as R from "./regeln.ts";

/**
 * Die Sozialabgaben — getrennt von der Steuer.
 *
 * Sie sind zwei verschiedene Systeme, die zufällig auf demselben Brutto
 * aufsetzen. Die Steuer kennt Freibeträge, Progression und
 * Familienstand; die Sozialversicherung kennt Beitragssätze und
 * Deckel. Sie in einer Funktion zu vermischen ergibt Code, in dem
 * niemand mehr sagen kann, welche Regel woher kommt — und beim nächsten
 * Jahreswechsel ändert sich genau eine von beiden.
 *
 * Vier Beiträge, und drei Feinheiten, die fast jeder Eigenbau übersieht:
 *
 *   **Zwei verschiedene Deckel.** Rente und Arbeitslosigkeit haben eine
 *   höhere Beitragsbemessungsgrenze als Kranken- und Pflege. Bei einem
 *   Gehalt dazwischen macht die Verwechslung dreistellige Beträge im
 *   Monat aus.
 *
 *   **Der Kinderlosenzuschlag trägt der Arbeitnehmer allein.** Die
 *   einzige Position, die nicht hälftig geteilt wird.
 *
 *   **Sachsen zahlt anders.** Wegen des behaltenen Buss- und Bettags
 *   trägt dort der Arbeitnehmer einen halben Punkt mehr an der
 *   Pflegeversicherung.
 */

export interface SvErgebnis {
  abzuege: Abzug[];
  summeJahr: Betrag;
  /** Was davon die Lohnsteuer mindert (Vorsorgepauschale). */
  vorsorgepauschale: Betrag;
  hinweise: string[];
}

export function sozialversicherung(e: Eingabe): SvErgebnis {
  const abzuege: Abzug[] = [];
  const hinweise: string[] = [];

  /*
   * Die Bemessungsgrundlage ist das Brutto, gedeckelt.
   *
   * Sonderbezüge zählen mit — auch ein Bonus ist beitragspflichtig,
   * solange die Grenze nicht erreicht ist. Das überrascht viele und ist
   * der Grund, warum ein Bonus netto oft weniger bringt als erwartet.
   */
  const gesamtbrutto = plus(e.bruttoJahr, e.sonstigeBezuege);
  const basisRente = hoechstens(gesamtbrutto, R.BBG_RENTE_JAHR);
  const basisKranken = hoechstens(gesamtbrutto, R.BBG_KRANKEN_JAHR);

  // ── Rente ─────────────────────────────────────────────────
  const rente = mal(basisRente, R.SATZ.rente / 2);
  abzuege.push({
    key: "rente",
    label: "Rentenversicherung",
    jahr: rente,
    erklaerung: `${(R.SATZ.rente * 50).toFixed(1)} % deines Bruttos, bis ${grenzeText(R.BBG_RENTE_JAHR)}. Die andere Hälfte zahlt dein Arbeitgeber.`,
  });

  // ── Arbeitslosigkeit ──────────────────────────────────────
  const arbeitslos = mal(basisRente, R.SATZ.arbeitslos / 2);
  abzuege.push({
    key: "arbeitslos",
    label: "Arbeitslosenversicherung",
    jahr: arbeitslos,
    erklaerung: `${(R.SATZ.arbeitslos * 50).toFixed(2)} % deines Bruttos, bis ${grenzeText(R.BBG_RENTE_JAHR)}.`,
  });

  // ── Kranken und Pflege ────────────────────────────────────
  let kranken = 0;
  let pflege = 0;

  if (e.krankenversicherung === "privat") {
    /*
     * Privat versichert: der Beitrag ist eine Vertragssache.
     *
     * Er lässt sich nicht berechnen, nur übernehmen. Ohne Angabe wird
     * hier NICHTS geschätzt — ein erfundener PKV-Beitrag wäre eine
     * Zahl, die je nach Alter und Tarif um mehrere hundert Euro
     * danebenliegt.
     */
    kranken = e.pkvBeitragMonat * 12;
    if (e.pkvBeitragMonat === 0) {
      hinweise.push(
        "Für die private Krankenversicherung habe ich keinen Beitrag. Ohne ihn fehlt er im Netto — trag ihn ein, dann stimmt die Rechnung.",
      );
    }
    abzuege.push({
      key: "pkv",
      label: "Private Krankenversicherung",
      jahr: kranken,
      erklaerung: "Dein eigener Beitrag laut Vertrag. Er wird nicht berechnet, sondern übernommen.",
    });
    if (gesamtbrutto < R.VERSICHERUNGSPFLICHTGRENZE_JAHR) {
      hinweise.push(
        `Mit diesem Gehalt liegst du unter der Versicherungspflichtgrenze von ${grenzeText(R.VERSICHERUNGSPFLICHTGRENZE_JAHR)}. Eine private Vollversicherung ist dann in der Regel nicht möglich.`,
      );
    }
  } else {
    const satzKranken = R.SATZ.krankenAllgemein / 2 + e.zusatzbeitrag / 2;
    kranken = mal(basisKranken, satzKranken);
    abzuege.push({
      key: "kranken",
      label: "Krankenversicherung",
      jahr: kranken,
      erklaerung: `${(R.SATZ.krankenAllgemein * 50).toFixed(1)} % plus dein halber Zusatzbeitrag von ${(e.zusatzbeitrag * 100).toFixed(2)} %, bis ${grenzeText(R.BBG_KRANKEN_JAHR)}.`,
    });

    pflege = mal(basisKranken, pflegesatzArbeitnehmer(e));
    abzuege.push({
      key: "pflege",
      label: "Pflegeversicherung",
      jahr: pflege,
      erklaerung: pflegeErklaerung(e),
    });
  }

  const summeJahr = plus(...abzuege.map((a) => a.jahr));

  return {
    abzuege,
    summeJahr,
    vorsorgepauschale: vorsorgepauschale(e, rente, kranken, pflege),
    hinweise,
  };
}

/**
 * Was der Arbeitnehmer an der Pflegeversicherung trägt.
 *
 * Die verwickeltste Zahl im ganzen deutschen Beitragsrecht:
 *
 *   die Hälfte des Grundsatzes
 *   + in Sachsen ein halber Punkt mehr
 *   + ohne Kinder ein Zuschlag, den er ALLEIN trägt
 *   − ab dem zweiten Kind ein Abschlag je Kind, bis zum fünften
 */
export function pflegesatzArbeitnehmer(e: Eingabe): number {
  let satz = R.SATZ.pflege / 2;

  if (e.bundesland === "SN") satz += R.PFLEGE_SACHSEN_MEHRANTEIL;

  const alter = e.geburtsjahr ? R.STEUERJAHR - e.geburtsjahr : null;
  const zuschlagFaellig =
    !e.hatKinder && (alter === null || alter >= R.PFLEGE_KINDERLOS_AB_ALTER);
  if (zuschlagFaellig) satz += R.PFLEGE_KINDERLOS_ZUSCHLAG;

  if (e.hatKinder) {
    // Der Abschlag gilt ab dem ZWEITEN Kind — das erste zählt nicht.
    const zusaetzliche = Math.max(0, Math.min(R.PFLEGE_KINDERABSCHLAG_MAX_KINDER, e.kinderfreibetraege - 1));
    satz -= zusaetzliche * R.PFLEGE_KINDERABSCHLAG_JE_KIND;
  }

  return Math.max(0, satz);
}

function pflegeErklaerung(e: Eingabe): string {
  const teile = [`${(R.SATZ.pflege * 50).toFixed(2)} % Grundanteil`];
  if (e.bundesland === "SN") teile.push("in Sachsen ein halber Punkt mehr");
  const alter = e.geburtsjahr ? R.STEUERJAHR - e.geburtsjahr : null;
  if (!e.hatKinder && (alter === null || alter >= R.PFLEGE_KINDERLOS_AB_ALTER)) {
    teile.push(`${(R.PFLEGE_KINDERLOS_ZUSCHLAG * 100).toFixed(1)} % Zuschlag für Kinderlose, den du allein trägst`);
  }
  if (e.hatKinder && e.kinderfreibetraege > 1) {
    teile.push(`Abschlag ab dem zweiten Kind`);
  }
  return `${teile.join(", ")}.`;
}

/**
 * Die Vorsorgepauschale.
 *
 * Sie mindert die Bemessungsgrundlage der Lohnsteuer — aber nicht um
 * den vollen Sozialbeitrag. Der Gesetzgeber lässt den Rentenanteil ganz
 * zu und die Kranken- und Pflegebeiträge nur bis zu einem Höchstbetrag,
 * mindestens aber einen pauschalen Anteil des Bruttos.
 *
 * Sie wegzulassen wäre der grösste Einzelfehler in einer selbstgebauten
 * Lohnsteuer: die Steuer fiele um mehrere tausend Euro im Jahr zu hoch
 * aus.
 */
function vorsorgepauschale(
  e: Eingabe,
  rente: Betrag,
  kranken: Betrag,
  pflege: Betrag,
): Betrag {
  const ausRente = mal(rente, R.VORSORGEPAUSCHALE.renteAnteil);

  const hoechst =
    e.steuerklasse === 3
      ? R.VORSORGEPAUSCHALE.hoechstbetragKlasse3
      : R.VORSORGEPAUSCHALE.hoechstbetragSonst;
  const mindest = mal(e.bruttoJahr, R.VORSORGEPAUSCHALE.mindestKrankenAnteil);

  const tatsaechlich = plus(kranken, pflege);
  // Der günstigere Weg gilt: entweder die tatsächlichen Beiträge oder
  // die Mindestpauschale, gedeckelt auf den Höchstbetrag.
  const ausKranken = Math.max(hoechstens(tatsaechlich, hoechst), hoechstens(mindest, hoechst));

  return plus(ausRente, ausKranken);
}

function grenzeText(b: Betrag): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(b / 10_000);
}
