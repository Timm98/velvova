import federal from "../../../../../../../tax-data/2026/federal.json" with { type: "json" };
import zh from "../../../../../../../tax-data/2026/cantons/ZH.json" with { type: "json" };
import { satzFuer, STEUERFUESSE_JAHR, type Kantonssatz } from "./steuerfuesse.ts";

/**
 * Die Schweizer Einkommenssteuer — Bund und Kanton, laufendes Jahr.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier gerechnet wird und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Eingabe ist das STEUERBARE Einkommen, nicht der Bruttolohn. Der
 * Unterschied ist gross und diese Datei überbrückt ihn nicht: Zwischen
 * beiden liegen Sozialabgaben, Berufsauslagen, Säule 3a, Kinder- und
 * Versicherungsabzüge — je Kanton verschieden. Wer hier einen
 * Bruttolohn einsetzt, bekommt eine zu hohe Steuer.
 *
 * Gerechnet werden:
 *
 *   einfache Kantonssteuer  nach dem Tarif des Kantons
 *   × Kantonssteuerfuss     aus `steuerfuesse.ts`
 *   + direkte Bundessteuer  nach dem Bundestarif
 *
 * Gemeinde- und Kirchensteuer bleiben in dieser Ausbaustufe aussen
 * vor — so verlangt es die Vorgabe. Die Füsse dafür liegen bereits in
 * `steuerfuesse.ts`; es fehlt nur der Aufruf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Bundestarif nur einmal existiert
 * ══════════════════════════════════════════════════════════════
 *
 * Er gilt schweizweit. Ihn je Kanton abzulegen hiesse, sechsundzwanzig
 * Kopien derselben Zahlen zu führen — und beim nächsten Ausgleich der
 * kalten Progression sechsundzwanzig Stellen zu ändern, von denen eine
 * vergessen wird. Er steht deshalb einmal je Jahr in
 * `tax-data/<jahr>/federal.json`.
 */

/**
 * Das Steuerjahr, mit dem gerechnet wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Das laufende Jahr, nicht ein festes
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Gehaltsrechner soll zeigen, was JETZT übrig bleibt. Die
 * Tarifdaten liegen deshalb nach Jahr abgelegt, und hier steht, welches
 * davon benutzt wird.
 *
 * ── Warum nicht `new Date().getFullYear()` ──────────────────
 *
 * Weil am 1. Januar sonst eine Datei fehlte, die es noch gar nicht
 * geben kann: Die Kantone veröffentlichen ihre Tarife im Herbst, und
 * ein Rechner, der zum Jahreswechsel wortlos ausfällt, ist schlimmer
 * als einer, der ein Jahr hinterherhinkt und es sagt.
 *
 * Das Jahr wird deshalb gesetzt, wenn die Daten dafür da sind — und
 * das ist eine Änderung von einer Zeile.
 */
export const STEUERJAHR: number = 2026;

export type Tarifart = "single" | "married" | "parent";

export interface Steuerbescheid {
  taxYear: number;
  canton: string;
  taxableIncome: number;
  tariffType: Tarifart;
  simpleCantonalTax: number;
  cantonalMultiplier: number;
  cantonalStateTax: number;
  directFederalTax: number;
  totalTax: number;
  effectiveTaxRate: number;
  /** Aus welchem Jahr der verwendete Steuerfuss stammt. */
  multiplierYear: number;
  /**
   * Ob Tarif und Steuerfuss aus demselben Jahr stammen.
   *
   * `false` heisst nicht „falsch", sondern „gemischt" — und der
   * Aufrufer muss es zeigen, statt die Zahl als Jahresergebnis
   * auszugeben.
   */
  multiplierMatchesTaxYear: boolean;
}

interface Stufe {
  from: number;
  baseTax: number;
  ratePer100: number;
}

interface Tarif {
  brackets: Stufe[];
  flatAbove?: { from: number; rateOfTotalIncome: number };
  basedOn?: string;
  deductionPerChild?: number;
}

/**
 * Ein Schweizer Stufentarif, ausgewertet.
 *
 * ══════════════════════════════════════════════════════════════
 * Je angefangene 100 Franken — und warum abgerundet wird
 * ══════════════════════════════════════════════════════════════
 *
 * Der Tarif nennt einen Betrag „für je weitere 100 Franken". Die
 * Praxis rechnet mit VOLLEN Hundertern: Wer 105'550 versteuert, zahlt
 * wie bei 105'500. Aufgerundet ergäbe das eine Steuer, die niemand
 * schuldet.
 *
 * ── Die Maximalbelastung ────────────────────────────────────
 *
 * Oberhalb der letzten Stufe gilt nicht der Grenzsatz auf den
 * Überschuss, sondern ein fester Satz auf das GANZE Einkommen — 11,5
 * Prozent. Das ist die Deckelung nach Art. 36 DBG.
 *
 * Der Übergang ist stetig, und das ist nachgerechnet: Der Grundtarif
 * 2026 erreicht bei 793'900 genau 91'298.15, und 794'000 mal 11,5
 * Prozent sind 91'310.00. Wer die Deckelung vergisst, verlangt von
 * einem Einkommen von zwei Millionen rund 34'000 Franken zu viel.
 */
export function tarifAnwenden(tarif: Tarif, steuerbaresEinkommen: number): number {
  const e = Math.max(0, Math.floor(steuerbaresEinkommen));

  if (tarif.flatAbove && e > tarif.flatAbove.from) {
    return runde(e * tarif.flatAbove.rateOfTotalIncome);
  }

  /* Die höchste Stufe, deren Untergrenze noch erreicht ist. */
  let stufe: Stufe | null = null;
  for (const s of tarif.brackets) {
    if (e >= s.from) stufe = s;
    else break;
  }
  if (stufe === null) return 0;

  const hunderter = Math.floor((e - stufe.from) / 100);
  return runde(stufe.baseTax + hunderter * stufe.ratePer100);
}

/** Auf Rappen, kaufmännisch. Steuerbeträge werden in Rappen geführt. */
function runde(betrag: number): number {
  return Math.round(betrag * 100) / 100;
}

/**
 * Die direkte Bundessteuer.
 *
 * `kinder` wirkt nur beim Elterntarif und mindert die STEUER, nicht
 * das Einkommen — 263 Franken je Kind für 2026. Der Unterschied wird
 * regelmässig verwechselt und ändert das Ergebnis um ein Vielfaches.
 */
export function bundessteuer(
  steuerbaresEinkommen: number,
  art: Tarifart,
  kinder = 0,
): number {
  const tarife = federal.tariffs as unknown as Record<string, Tarif>;
  const gewaehlt = art === "parent" ? tarife.married! : tarife[art]!;
  const roh = tarifAnwenden(gewaehlt, steuerbaresEinkommen);

  if (art !== "parent") return roh;

  const abzug = (tarife.parent?.deductionPerChild ?? 0) * Math.max(0, Math.floor(kinder));
  /* Nie unter null: Ein Kinderabzug erstattet keine Steuer. */
  return runde(Math.max(0, roh - abzug));
}

/**
 * Ob für einen Kanton gerechnet werden kann.
 *
 * Zwei Bedingungen, und beide müssen erfüllt sein: Der Steuerfuss muss
 * bekannt sein (bei BL und VS steht in der ESTV-Tabelle eine Fussnote
 * statt einer Zahl), und der Tarif der einfachen Steuer muss abgelegt
 * sein.
 *
 * Solange einer davon fehlt, wird NICHT gerechnet. Ein fehlender Tarif
 * mit einem Standardwert zu überbrücken ergäbe eine Zahl, die
 * überzeugend aussieht und nichts bedeutet — genau das, wogegen die
 * Vorgabe ausdrücklich schreibt: keine geschätzten Steuersätze, keine
 * erfundenen Tarifstufen.
 */
export function kantonRechenbar(kanton: string): { moeglich: boolean; grund?: string } {
  const satz = satzFuer(kanton);
  if (satz === null) return { moeglich: false, grund: `${kanton} ist kein Schweizer Kanton.` };
  if (satz.kanton_fuss === null) {
    return {
      moeglich: false,
      grund: `Für ${satz.hauptort} steht in der ESTV-Tabelle eine Fussnote statt eines Steuerfusses (${satz.fussnoten ?? ""}).`,
    };
  }
  if (!KANTONSTARIFE[satz.kanton]) {
    return {
      moeglich: false,
      grund: `Der Tarif der einfachen Steuer für ${satz.hauptort} ist noch nicht abgelegt.`,
    };
  }
  return { moeglich: true };
}

/**
 * Die abgelegten Kantonstarife.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier erst einer steht
 * ══════════════════════════════════════════════════════════════
 *
 * Der Bundestarif ist ein Gesetzesartikel und war in einem Zug zu
 * holen und nachzurechnen. Die sechsundzwanzig Kantonstarife stehen in
 * sechsundzwanzig kantonalen Steuergesetzen, jedes mit eigenem Aufbau,
 * eigenen Tarifarten und eigenen Sonderregeln.
 *
 * Sie hier reihenweise einzutragen, ohne jede Stufe gegen die Quelle
 * und gegen den ESTV-Rechner geprüft zu haben, wäre genau das, was die
 * Vorgabe verbietet — und der Fehler wäre unsichtbar: Eine falsche
 * Stufe ergibt keine Fehlermeldung, sondern einen falschen Betrag.
 *
 * Die Struktur steht. Jeder Kanton, der dazukommt, ist eine Datei und
 * ein Eintrag hier — und `kantonRechenbar` sagt bis dahin ehrlich,
 * dass er fehlt.
 */
const KANTONSTARIFE: Record<string, Record<string, Tarif>> = {
  ZH: zh.tariffs as unknown as Record<string, Tarif>,
};

/**
 * Die Steuer für ein steuerbares Einkommen.
 *
 * `null`, wenn der Kanton nicht rechenbar ist — mit dem Grund in
 * `kantonRechenbar`.
 */
export function steuerBerechnen(
  kanton: string,
  steuerbaresEinkommen: number,
  art: Tarifart = "single",
  kinder = 0,
): Steuerbescheid | null {
  const satz: Kantonssatz | null = satzFuer(kanton);
  if (satz === null || satz.kanton_fuss === null) return null;

  const tarife = KANTONSTARIFE[satz.kanton];
  if (!tarife) return null;

  const gewaehlt = tarife[art === "parent" ? (tarife.parent ? "parent" : "married") : art];
  if (!gewaehlt) return null;

  const einfach = tarifAnwenden(gewaehlt, steuerbaresEinkommen);

  /*
   * ══════════════════════════════════════════════════════════════
   * Tarif und Steuerfuss müssen aus demselben Jahr stammen
   * ══════════════════════════════════════════════════════════════
   *
   * Der Tarif liegt für 2026 vor, die Steuerfüsse in
   * `steuerfuesse.ts` für 2025. Beide zu multiplizieren ergäbe eine
   * Zahl, die es in keinem Jahr gibt — und sie sähe aus wie ein
   * Ergebnis.
   *
   * Ein Steuerfuss ändert sich seltener als ein Tarif, und die
   * Versuchung ist deshalb gross, den vorjährigen einfach zu
   * benutzen. Genau daran ist in dieser Sitzung dreimal ein
   * Jahresirrtum entstanden — zweimal beim Bund, einmal bei Zürich.
   *
   * `multiplierYear` steht deshalb im Bescheid, und der Aufrufer
   * sieht, dass er nicht zum Steuerjahr passt.
   */
  const kantonal = runde(einfach * satz.kanton_fuss);
  const bund = bundessteuer(steuerbaresEinkommen, art, kinder);
  const gesamt = runde(kantonal + bund);

  return {
    taxYear: STEUERJAHR,
    canton: satz.kanton,
    taxableIncome: steuerbaresEinkommen,
    tariffType: art,
    simpleCantonalTax: einfach,
    cantonalMultiplier: satz.kanton_fuss,
    multiplierYear: STEUERFUESSE_JAHR,
    multiplierMatchesTaxYear: STEUERFUESSE_JAHR === STEUERJAHR,
    cantonalStateTax: kantonal,
    directFederalTax: bund,
    totalTax: gesamt,
    /* Null Einkommen hat keinen Satz — nicht null Prozent. */
    effectiveTaxRate: steuerbaresEinkommen > 0 ? runde(gesamt / steuerbaresEinkommen) : 0,
  };
}
