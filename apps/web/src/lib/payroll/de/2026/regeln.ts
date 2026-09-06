import { ausEuro, type Betrag } from "../../core/dezimal.ts";
import type { Bundesland } from "../../core/types.ts";

/**
 * Die Zahlen für das Steuerjahr 2026 — an genau einer Stelle.
 *
 * Beitragssätze und Grenzen ändern sich jedes Jahr, oft zum Januar und
 * manchmal mitten im Jahr. Sie über die Codebasis zu verteilen heisst:
 * beim nächsten Wechsel werden drei von fünf Stellen gefunden, die
 * anderen beiden rechnen ein Jahr lang falsch, und niemand merkt es —
 * weil eine falsche Nettozahl genauso plausibel aussieht wie eine
 * richtige.
 *
 * Deshalb hier alles zusammen, mit Gültigkeitszeitraum und Quelle. Und
 * deshalb ein eigenes Verzeichnis je Jahr: das Regelwerk 2025 bleibt
 * unangetastet, wenn 2026 dazukommt. Eine Rechnung für ein
 * zurückliegendes Jahr muss die Regeln von damals benutzen — sonst
 * stimmt die Rückrechnung einer alten Abrechnung nie.
 *
 * ── Wichtig: was diese Zahlen sind und was nicht ──────────────
 *
 * Sie sind nach bestem Wissen eingetragen und für den Betrieb NICHT
 * freigegeben (`FREIGEGEBEN = false`). Bevor jemand sich auf eine
 * Nettozahl verlässt, müssen sie gegen die amtlichen Testfälle des
 * Programmablaufplans geprüft und die Freigabe ausdrücklich gesetzt
 * werden. Bis dahin sagt die Oberfläche, dass es eine Schätzung ist —
 * was sie ohnehin immer sagen wird.
 */

export const STEUERJAHR = 2026;
export const VERSION = "de-2026.1";
export const GUELTIG_AB = "2026-01-01";
export const GUELTIG_BIS = "2026-12-31";

/**
 * Ob dieses Regelwerk für den Betrieb freigegeben ist.
 *
 * `false`, bis die Werte gegen die amtlichen Testfälle geprüft sind.
 * Die Oberfläche zeigt dann einen deutlichen Hinweis — statt eine Zahl
 * zu nennen, die nach Gewissheit aussieht.
 */
export const FREIGEGEBEN = false;

export const QUELLEN = [
  { titel: "Programmablaufplan für die maschinelle Lohnsteuerberechnung (BMF)", stand: "2026" },
  { titel: "Einkommensteuergesetz §32a, §39b", stand: "2026" },
  { titel: "Sozialversicherungs-Rechengrößenverordnung", stand: "2026" },
];

// ── Einkommensteuer ─────────────────────────────────────────

/**
 * Der Grundfreibetrag und die Tarifzonen nach §32a EStG.
 *
 * Der Tarif ist kein Prozentsatz, sondern eine stückweise definierte
 * Funktion mit vier Knicken. Die Beiwerte darin sehen willkürlich aus
 * und sind es nicht — sie sorgen dafür, dass der Grenzsteuersatz
 * stetig ansteigt statt zu springen.
 */
export const GRUNDFREIBETRAG = ausEuro(12_348);

/*
 * Die Zonengrenzen und Beiwerte des Tarifs.
 *
 * Die Anschlusswerte — `zone3C`, `zone4Abzug`, `zone5Abzug` — stehen
 * NICHT als Zahl hier, sondern werden aus der Stetigkeit gerechnet.
 *
 * Das ist kein Trick, sondern eine Eigenschaft des Gesetzes: der Tarif
 * ist an jeder Zonengrenze stetig, sonst löste ein Euro Mehrverdienst
 * mehrere hundert Euro Steuer aus. Die amtlichen Konstanten sind genau
 * die Werte, die diese Stetigkeit herstellen.
 *
 * Der Anlass, es so zu machen: hier stand zuerst `zone3C: 1015.13` —
 * ein Wert aus einem anderen Steuerjahr, den ich abgeschrieben hatte.
 * Er erzeugte an der Grenze bei 17.443 Euro einen Sprung von 60 Euro,
 * und keine Plausibilitätsprüfung eines Nettobetrags hätte das je
 * gezeigt: 60 Euro im Jahr sind fünf Euro im Monat, und die fallen
 * niemandem auf.
 *
 * Gerechnet statt abgeschrieben kann dieser Fehler nicht mehr
 * entstehen. Ein falscher Beiwert in den Progressionszonen fällt
 * weiterhin auf — dafür gibt es die Prüfung in rechner.test.ts.
 */
const Z1 = 12_348;
const Z2 = 17_443;
const Z3 = 68_480;
const Z4 = 277_825;
const A2 = 932.3;
const B2 = 1400;
const A3 = 176.64;
const B3 = 2397;

/** Der Wert der zweiten Zone an ihrem oberen Ende. */
const C3 = ((A2 * ((Z2 - Z1) / 10_000) + B2) * (Z2 - Z1)) / 10_000;
/** Der Wert der dritten Zone an ihrem oberen Ende. */
const STEUER_BEI_Z3 = ((A3 * ((Z3 - Z2) / 10_000) + B3) * (Z3 - Z2)) / 10_000 + C3;

export const TARIF = {
  /** Bis hierher steuerfrei. */
  zone1Ende: ausEuro(Z1),
  /** Erste Progressionszone. */
  zone2Ende: ausEuro(Z2),
  zone2A: A2,
  zone2B: B2,
  /** Zweite Progressionszone. */
  zone3Ende: ausEuro(Z3),
  zone3A: A3,
  zone3B: B3,
  zone3C: C3,
  /** Erste Proportionalzone: 42 Prozent. */
  zone4Ende: ausEuro(Z4),
  zone4Satz: 0.42,
  zone4Abzug: 0.42 * Z3 - STEUER_BEI_Z3,
  /** Reichensteuer: 45 Prozent. */
  zone5Satz: 0.45,
  zone5Abzug: 0.45 * Z4 - (0.42 * Z4 - (0.42 * Z3 - STEUER_BEI_Z3)),
} as const;

/** Arbeitnehmer-Pauschbetrag und Sonderausgabenpauschbetrag. */
export const ARBEITNEHMER_PAUSCHBETRAG = ausEuro(1_230);
export const SONDERAUSGABEN_PAUSCHBETRAG = ausEuro(36);

/**
 * Der Entlastungsbetrag für Alleinerziehende (Steuerklasse 2).
 */
export const ENTLASTUNGSBETRAG_ALLEINERZIEHEND = ausEuro(4_260);

/**
 * Kinderfreibetrag samt Betreuungsfreibetrag, je Kind und Jahr.
 *
 * Er mindert nicht die Lohnsteuer selbst, wohl aber die
 * Bemessungsgrundlage für Solidaritätszuschlag und Kirchensteuer —
 * eine Eigenheit, die in fast jeder selbstgebauten Berechnung fehlt.
 */
export const KINDERFREIBETRAG_VOLL = ausEuro(9_600);

// ── Solidaritätszuschlag ────────────────────────────────────

/**
 * Der Soli wird seit 2021 nur noch von hohen Einkommen erhoben.
 *
 * Unterhalb der Freigrenze null, darüber eine Milderungszone, in der er
 * langsam auf 5,5 Prozent ansteigt. Die Milderungszone zu vergessen ist
 * der häufigste Fehler in Eigenbau-Rechnern: sie lassen ihn bei der
 * Freigrenze auf einen Schlag von null auf den vollen Satz springen.
 */
export const SOLI = {
  freigrenzeEinzeln: ausEuro(20_350),
  freigrenzeZusammen: ausEuro(40_700),
  satz: 0.055,
  /** In der Milderungszone: 11,9 Prozent des Betrags über der Grenze. */
  milderungssatz: 0.119,
} as const;

// ── Kirchensteuer ───────────────────────────────────────────

/**
 * Acht Prozent in Bayern und Baden-Württemberg, sonst neun.
 */
export const KIRCHENSTEUERSATZ: Record<Bundesland, number> = {
  BW: 0.08, BY: 0.08,
  BE: 0.09, BB: 0.09, HB: 0.09, HH: 0.09, HE: 0.09, MV: 0.09,
  NI: 0.09, NW: 0.09, RP: 0.09, SL: 0.09, SN: 0.09, ST: 0.09,
  SH: 0.09, TH: 0.09,
};

// ── Sozialversicherung ──────────────────────────────────────

/**
 * Beitragsbemessungsgrenzen — die Deckel, ab denen nichts mehr steigt.
 *
 * Zwei verschiedene: Renten- und Arbeitslosenversicherung haben eine
 * höhere als Kranken- und Pflegeversicherung. Beide zu verwechseln
 * ergibt bei hohen Gehältern hunderte Euro Unterschied im Monat.
 */
export const BBG_RENTE_JAHR = ausEuro(96_600);
export const BBG_KRANKEN_JAHR = ausEuro(66_150);

/** Ab diesem Einkommen darf man die gesetzliche Kasse verlassen. */
export const VERSICHERUNGSPFLICHTGRENZE_JAHR = ausEuro(73_800);

/**
 * Die Beitragssätze. Angegeben ist jeweils der GESAMTsatz.
 *
 * Arbeitnehmer und Arbeitgeber teilen sich alles hälftig — mit einer
 * Ausnahme, die unten steht.
 */
export const SATZ = {
  rente: 0.186,
  arbeitslos: 0.026,
  krankenAllgemein: 0.146,
  pflege: 0.036,
} as const;

/**
 * Der Kinderlosenzuschlag in der Pflegeversicherung.
 *
 * Trägt der Arbeitnehmer ALLEIN — die einzige Ausnahme von der
 * hälftigen Teilung. Er entfällt bis zum vollendeten 23. Lebensjahr.
 */
export const PFLEGE_KINDERLOS_ZUSCHLAG = 0.006;
export const PFLEGE_KINDERLOS_AB_ALTER = 23;

/**
 * Sachsen zahlt anders.
 *
 * Dort trägt der Arbeitnehmer einen Punkt mehr an der
 * Pflegeversicherung, weil das Land den Buss- und Bettag als Feiertag
 * behalten hat. Eine Sonderregel, die ein Rechner ohne Bundesland gar
 * nicht abbilden kann — und die für jemanden in Dresden jeden Monat
 * einen zweistelligen Betrag ausmacht.
 */
export const PFLEGE_SACHSEN_MEHRANTEIL = 0.005;

/** Abschläge für Eltern ab dem zweiten Kind, bis zum fünften. */
export const PFLEGE_KINDERABSCHLAG_JE_KIND = 0.0025;
export const PFLEGE_KINDERABSCHLAG_MAX_KINDER = 4;

/**
 * Die Vorsorgepauschale — was von der Sozialversicherung die
 * Lohnsteuer mindert.
 *
 * Nicht der volle Beitrag: der Gesetzgeber lässt nur einen Teil zu,
 * und die Regel dafür ist eigen. Sie hier zu vereinfachen hiesse, die
 * Lohnsteuer systematisch zu hoch anzusetzen.
 */
export const VORSORGEPAUSCHALE = {
  /** Anteil des Rentenbeitrags, der angesetzt werden darf. */
  renteAnteil: 1.0,
  /** Mindestansatz für Kranken- und Pflegeversicherung. */
  mindestKrankenAnteil: 0.12,
  hoechstbetragKlasse3: ausEuro(3_000),
  hoechstbetragSonst: ausEuro(1_900),
} as const;

/** Was ein Betrag ist, damit die Typen stimmen. */
export type { Betrag };
