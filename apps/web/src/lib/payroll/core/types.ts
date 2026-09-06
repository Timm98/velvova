import type { Betrag } from "./dezimal.ts";

/**
 * Der Vertrag, an den sich jeder Länder-Rechner hält.
 *
 * Es gibt genau einen Grund für diese Abstraktion, und er ist nicht
 * „vielleicht kommt mal Österreich dazu". Er ist: **eine deutsche
 * Berechnung darf niemals auf eine Schweizer Stelle angewendet
 * werden.** Ohne einen Vertrag, der das Land führt, passiert genau das
 * — irgendwo ruft jemand `berechneNetto(brutto)` auf, und heraus kommt
 * eine Zahl, die überzeugend aussieht und für dieses Land nichts
 * bedeutet.
 *
 * Deshalb beantwortet jeder Rechner zuerst zwei Fragen — welches Land,
 * welches Steuerjahr — und weigert sich, wenn die Antwort nein lautet.
 * Eine Näherung „das wird schon ähnlich sein" gibt es nicht.
 */

export type Land = "DE" | "AT" | "CH";

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

/** Die sechzehn Länder — für Kirchensteuer und Pflegeversicherung. */
export type Bundesland =
  | "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV"
  | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";

export interface Eingabe {
  land: Land;
  steuerjahr: number;
  /** Das Bruttojahresgehalt. */
  bruttoJahr: Betrag;
  /** Wie oft im Jahr ausgezahlt wird: 12, 13 oder 14. */
  zahlungen: 12 | 13 | 14;
  /** Zusätzliche steuerpflichtige Vergütung im Jahr. */
  sonstigeBezuege: Betrag;

  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  kirchensteuer: boolean;
  /** Zahl der Kinderfreibeträge. Wirkt auf Kirchensteuer und Soli. */
  kinderfreibetraege: number;

  /** Gesetzlich oder privat versichert. */
  krankenversicherung: "gesetzlich" | "privat";
  /** Kassenindividueller Zusatzbeitrag, etwa 0.0245 für 2,45 Prozent. */
  zusatzbeitrag: number;
  /** Monatlicher Eigenanteil bei privater Versicherung. */
  pkvBeitragMonat: Betrag;

  /** Für den Kinderlosenzuschlag in der Pflegeversicherung. */
  hatKinder: boolean;
  /** Für den Zuschlag: er entfällt bis 23 und ab dem Rentenalter. */
  geburtsjahr: number | null;

  /** Ein bekannter Lohnsteuerfreibetrag im Jahr. */
  freibetragJahr: Betrag;
}

export interface Abzug {
  key: string;
  label: string;
  jahr: Betrag;
  /** Was ihn erklärt — ein Satz, ohne Fachwort. */
  erklaerung: string;
}

export interface Ergebnis {
  land: Land;
  steuerjahr: number;
  regelwerkVersion: string;

  bruttoJahr: Betrag;
  bruttoMonat: Betrag;
  nettoJahr: Betrag;
  nettoMonat: Betrag;
  /** Was bei 13 oder 14 Zahlungen je Auszahlung bleibt. */
  nettoJeZahlung: Betrag;

  abzuegeJahr: Betrag;
  /** Anteil der Abzüge am Brutto, 0..1. */
  abzugsquote: number;

  steuern: Abzug[];
  sozialversicherung: Abzug[];

  /** Was angenommen wurde, weil es nicht angegeben war. */
  annahmen: string[];
  /** Was an dieser Rechnung unsicher ist. */
  hinweise: string[];
}

export interface Nichtabgedeckt {
  abgedeckt: false;
  /** Warum diese Konstellation nicht gerechnet wird. */
  grund: string;
}

export type Berechnung = ({ abgedeckt: true } & Ergebnis) | Nichtabgedeckt;

/**
 * Was ein Länder-Rechner können muss.
 */
export interface PayrollProvider {
  readonly land: Land;
  /** Welche Steuerjahre er kennt. */
  readonly steuerjahre: number[];
  /** Die Fassung des Regelwerks — gehört in jedes Ergebnis. */
  readonly regelwerkVersion: string;
  /** Worauf sich die Regeln stützen. Für die Fussnote. */
  readonly quellen: { titel: string; stand: string }[];
  /** Ist dieses Regelwerk für den Betrieb freigegeben? */
  readonly freigegeben: boolean;

  unterstuetzt(land: Land, steuerjahr: number): boolean;
  /** Prüft die Eingabe. Leeres Feld heisst: alles in Ordnung. */
  pruefe(eingabe: Eingabe): string[];
  berechne(eingabe: Eingabe): Berechnung;
}

/**
 * Die Registrierung.
 *
 * Absichtlich eine Liste und kein `if (land === "DE")` irgendwo im
 * Code: wer einen zweiten Rechner hinzufügt, trägt ihn hier ein und
 * ändert sonst nichts. Und wer ein Land anfragt, das es nicht gibt,
 * bekommt `null` statt einer deutschen Rechnung.
 */
const REGISTER: PayrollProvider[] = [];

export function registriere(provider: PayrollProvider): void {
  REGISTER.push(provider);
}

export function rechnerFuer(land: Land, steuerjahr: number): PayrollProvider | null {
  return REGISTER.find((p) => p.unterstuetzt(land, steuerjahr)) ?? null;
}

export function bekannteLaender(): Land[] {
  return [...new Set(REGISTER.map((p) => p.land))];
}
