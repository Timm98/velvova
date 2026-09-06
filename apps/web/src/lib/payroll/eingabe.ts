import type { Eingabe } from "./core/types.ts";
import { ausEuro } from "./core/dezimal.ts";
import { STANDARD, type Gehaltsangaben } from "./angaben.ts";

/**
 * Aus gepflegten Steuerangaben eine Rechnereingabe — an genau einer
 * Stelle.
 *
 * ── Warum das zusammengelegt wurde ────────────────────────────
 *
 * Diese Zuordnung stand dreimal im Produkt, und die drei Fassungen
 * waren nicht gleich:
 *
 *   Die Vorschau im Einstellungsformular rechnete mit allem, was
 *   eingetragen war — Kinderzahl eingeschlossen.
 *
 *   Die Nettoschätzung auf der Jobseite rechnete mit festen Annahmen
 *   und las die Einstellungen gar nicht. Darunter stand trotzdem der
 *   Link „Annahmen ändern". Wer ihn benutzte, änderte nichts an der
 *   Zahl darüber.
 *
 *   Die Lebenshaltungsseite las die Einstellungen, setzte aber die
 *   Kinderfreibeträge fest auf null.
 *
 * Damit zeigte dasselbe Produkt für dasselbe Bruttogehalt bis zu drei
 * verschiedene Nettobeträge, je nachdem, auf welcher Seite man stand.
 * Bei zwei Kindern ist der Unterschied kein Rundungsfehler: Der
 * Kinderfreibetrag senkt das zu versteuernde Einkommen, und der
 * Pflegebeitrag sinkt je Kind.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Kein Laden, kein Netz, keine Datenbank. Die Funktion bekommt die
 * Angaben und gibt eine Eingabe zurück — deshalb kann die Vorschau im
 * Browser sie genauso benutzen wie der Server.
 */
export function eingabeAus(
  angaben: Gehaltsangaben | null | undefined,
  bruttoJahr: number,
  land = "DE",
): Eingabe {
  const a = angaben ?? STANDARD;
  return {
    land: land as Eingabe["land"],
    steuerjahr: a.steuerjahr,
    bruttoJahr: ausEuro(bruttoJahr),
    zahlungen: a.zahlungen,
    sonstigeBezuege: 0,
    steuerklasse: a.steuerklasse,
    bundesland: a.bundesland,
    kirchensteuer: a.kirchensteuer,
    /*
     * Die Kinderzahl, nicht null.
     *
     * `hatKinder` allein senkt nur den Pflegebeitrag um den
     * Grundabschlag. Der Kinderfreibetrag und der weitere Abschlag ab
     * dem zweiten Kind hängen an dieser Zahl — und beides zusammen
     * macht bei drei Kindern über tausend Euro im Jahr aus.
     */
    kinderfreibetraege: a.kinderzahl,
    krankenversicherung: a.krankenversicherung,
    zusatzbeitrag: a.zusatzbeitrag,
    pkvBeitragMonat: 0,
    hatKinder: a.hatKinder,
    geburtsjahr: null,
    freibetragJahr: 0,
  };
}

/**
 * Die Annahmen in Worten — für die Pillen unter einer Schätzung.
 *
 * Sie stehen neben der Zahl, nicht im Kleingedruckten: Jede einzelne
 * verschiebt das Ergebnis um hunderte Euro im Jahr, und wer sie nicht
 * sieht, hält die Zahl für seine eigene.
 */
export function annahmenText(angaben: Gehaltsangaben | null | undefined, land = "DE"): string[] {
  const a = angaben ?? STANDARD;
  const klasse = ["", "I", "II", "III", "IV", "V", "VI"][a.steuerklasse] ?? String(a.steuerklasse);
  return [
    land,
    String(a.steuerjahr),
    `Steuerklasse ${klasse}`,
    a.bundesland,
    a.krankenversicherung === "privat" ? "privat versichert" : "gesetzlich versichert",
    a.kirchensteuer ? "mit Kirchensteuer" : "ohne Kirchensteuer",
    a.kinderzahl > 0 ? `${a.kinderzahl} ${a.kinderzahl === 1 ? "Kind" : "Kinder"}` : "kinderlos",
    `${a.zahlungen} Zahlungen`,
  ];
}
