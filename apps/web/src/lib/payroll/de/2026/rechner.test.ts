import { describe, expect, it } from "vitest";
import { ausEuro, zuEuro } from "../../core/dezimal.ts";
import { rechnerFuer, type Eingabe } from "../../core/types.ts";
import { FREIGEGEBEN } from "./regeln.ts";
import { deutschland2026 } from "./provider.ts";
import { solidaritaetszuschlag, tarif } from "./steuer.ts";
import { pflegesatzArbeitnehmer } from "./sozialversicherung.ts";
import * as R from "./regeln.ts";

/**
 * Der Gehaltsrechner.
 *
 * Diese Tests prüfen keine amtlichen Sollwerte — das Regelwerk steht
 * auf `FREIGEGEBEN = false`, und ein Abgleich gegen die Testfälle des
 * Programmablaufplans steht noch aus. Was sie prüfen, ist alles, was
 * auch ohne amtliche Sollwerte falsch sein KANN und in selbstgebauten
 * Rechnern regelmässig falsch ist:
 *
 *   Sprünge an Zonengrenzen, verwechselte Bemessungsgrenzen, ein
 *   vergessener Kinderlosenzuschlag, ein Netto über dem Brutto, eine
 *   Steuer unter dem Grundfreibetrag.
 *
 * Und vor allem: dass der Rechner sagt, was er nicht kann.
 */

function eingabe(over: Partial<Eingabe> = {}): Eingabe {
  return {
    land: "DE",
    steuerjahr: 2026,
    bruttoJahr: ausEuro(45_000),
    zahlungen: 12,
    sonstigeBezuege: 0,
    steuerklasse: 1,
    bundesland: "NW",
    kirchensteuer: false,
    kinderfreibetraege: 0,
    krankenversicherung: "gesetzlich",
    zusatzbeitrag: 0.0245,
    pkvBeitragMonat: 0,
    hatKinder: false,
    geburtsjahr: 1990,
    freibetragJahr: 0,
    ...over,
  };
}

function netto(over: Partial<Eingabe> = {}): number {
  const r = deutschland2026.berechne(eingabe(over));
  if (!r.abgedeckt) throw new Error(`nicht abgedeckt: ${r.grund}`);
  return zuEuro(r.nettoJahr);
}

describe("Einkommensteuertarif §32a", () => {
  it("besteuert bis zum Grundfreibetrag nichts", () => {
    expect(tarif(ausEuro(0))).toBe(0);
    expect(tarif(R.GRUNDFREIBETRAG)).toBe(0);
    expect(tarif(ausEuro(12_000))).toBe(0);
  });

  it("steigt ab dem ersten Euro darüber", () => {
    expect(tarif(ausEuro(13_000))).toBeGreaterThan(0);
  });

  it("springt an keiner Zonengrenze", () => {
    /*
     * Die Eigenschaft, wegen der der Tarif so seltsam aussieht.
     *
     * An jeder der vier Grenzen muss die Steuer stetig übergehen. Ein
     * Sprung dort hiesse, dass ein Euro Mehrverdienst mehrere hundert
     * Euro Steuer auslöst — und wäre ein Zeichen dafür, dass ein
     * Beiwert falsch abgeschrieben wurde.
     */
    for (const grenze of [
      R.TARIF.zone1Ende,
      R.TARIF.zone2Ende,
      R.TARIF.zone3Ende,
      R.TARIF.zone4Ende,
    ]) {
      const davor = zuEuro(tarif(grenze));
      const danach = zuEuro(tarif(grenze + ausEuro(1)));
      /*
       * Zwei Euro Schwelle, nicht null.
       *
       * Der Tarif rundet auf volle Euro ab (`Math.floor`), wie das
       * Gesetz es vorschreibt. Ein Euro Unterschied zwischen zwei
       * benachbarten Einkommen ist deshalb normal und kein Sprung.
       *
       * Die Schwelle ist trotzdem eng genug: der Fehler, den diese
       * Prüfung gefunden hat, war ein Sprung von 60 Euro.
       */
      expect(danach - davor, `Sprung bei ${zuEuro(grenze)} €`).toBeLessThan(2);
      expect(danach).toBeGreaterThanOrEqual(davor);
    }
  });

  it("wächst monoton", () => {
    let vorher = -1;
    for (let euro = 0; euro <= 300_000; euro += 2_500) {
      const s = zuEuro(tarif(ausEuro(euro)));
      expect(s, `${euro} €`).toBeGreaterThanOrEqual(vorher);
      vorher = s;
    }
  });

  it("bleibt unter dem Spitzensteuersatz", () => {
    // Der Durchschnittssteuersatz kann den Grenzsteuersatz nie
    // erreichen. Täte er es, wäre die Progression falsch herum.
    for (const euro of [50_000, 100_000, 500_000]) {
      const quote = zuEuro(tarif(ausEuro(euro))) / euro;
      expect(quote, `${euro} €`).toBeLessThan(0.45);
    }
  });
});

describe("Solidaritätszuschlag", () => {
  it("fällt unter der Freigrenze nicht an", () => {
    expect(solidaritaetszuschlag(R.SOLI.freigrenzeEinzeln, false)).toBe(0);
  });

  it("springt an der Freigrenze nicht", () => {
    /*
     * Der häufigste Fehler in Eigenbau-Rechnern.
     *
     * Ohne Milderungszone springt der Soli bei einem Euro mehr
     * Lohnsteuer von null auf über tausend Euro. Die Zone existiert
     * genau deshalb.
     */
    const knappDarueber = solidaritaetszuschlag(R.SOLI.freigrenzeEinzeln + ausEuro(1), false);
    expect(zuEuro(knappDarueber)).toBeLessThan(1);
  });

  it("nähert sich von unten dem vollen Satz an", () => {
    const hoch = solidaritaetszuschlag(ausEuro(200_000), false);
    expect(zuEuro(hoch)).toBeCloseTo(200_000 * R.SOLI.satz, 0);
  });

  it("hat für Steuerklasse III die doppelte Freigrenze", () => {
    const s = R.SOLI.freigrenzeEinzeln + ausEuro(5_000);
    expect(solidaritaetszuschlag(s, true)).toBe(0);
    expect(solidaritaetszuschlag(s, false)).toBeGreaterThan(0);
  });
});

describe("Pflegeversicherung", () => {
  it("belastet Kinderlose stärker", () => {
    const ohne = pflegesatzArbeitnehmer(eingabe({ hatKinder: false }));
    const mit = pflegesatzArbeitnehmer(eingabe({ hatKinder: true, kinderfreibetraege: 1 }));
    expect(ohne).toBeGreaterThan(mit);
    expect(ohne - mit).toBeCloseTo(R.PFLEGE_KINDERLOS_ZUSCHLAG, 5);
  });

  it("verschont sehr junge Kinderlose", () => {
    // Der Zuschlag greift erst ab 23.
    const jung = pflegesatzArbeitnehmer(eingabe({ hatKinder: false, geburtsjahr: 2006 }));
    const aelter = pflegesatzArbeitnehmer(eingabe({ hatKinder: false, geburtsjahr: 1990 }));
    expect(jung).toBeLessThan(aelter);
  });

  it("rechnet in Sachsen anders", () => {
    /*
     * Sachsen hat den Buss- und Bettag behalten; dafür trägt der
     * Arbeitnehmer dort einen halben Punkt mehr. Für jemanden in
     * Dresden sind das jeden Monat zweistellige Beträge — ein Rechner
     * ohne Bundesland kann das gar nicht abbilden.
     */
    const sn = pflegesatzArbeitnehmer(eingabe({ bundesland: "SN" }));
    const nw = pflegesatzArbeitnehmer(eingabe({ bundesland: "NW" }));
    expect(sn - nw).toBeCloseTo(R.PFLEGE_SACHSEN_MEHRANTEIL, 5);
  });

  it("entlastet ab dem zweiten Kind, nicht ab dem ersten", () => {
    const einKind = pflegesatzArbeitnehmer(eingabe({ hatKinder: true, kinderfreibetraege: 1 }));
    const zweiKinder = pflegesatzArbeitnehmer(eingabe({ hatKinder: true, kinderfreibetraege: 2 }));
    const dreiKinder = pflegesatzArbeitnehmer(eingabe({ hatKinder: true, kinderfreibetraege: 3 }));
    expect(zweiKinder).toBeLessThan(einKind);
    expect(dreiKinder).toBeLessThan(zweiKinder);
  });
});

describe("Gesamtrechnung", () => {
  it("liefert für die üblichen Gehälter ein plausibles Netto", () => {
    /*
     * Keine amtlichen Sollwerte — aber eine Spanne, ausserhalb derer
     * die Rechnung sicher falsch ist. In Deutschland bleiben von einem
     * mittleren Gehalt zwischen 55 und 75 Prozent netto. Liegt ein
     * Ergebnis darunter oder darüber, stimmt etwas Grundsätzliches
     * nicht.
     */
    for (const brutto of [30_000, 45_000, 60_000, 90_000, 120_000]) {
      const n = netto({ bruttoJahr: ausEuro(brutto) });
      const quote = n / brutto;
      expect(quote, `${brutto} € → ${Math.round(n)} €`).toBeGreaterThan(0.5);
      expect(quote, `${brutto} € → ${Math.round(n)} €`).toBeLessThan(0.8);
    }
  });

  it("lässt das Netto niemals über das Brutto steigen", () => {
    for (const brutto of [10_000, 30_000, 200_000]) {
      expect(netto({ bruttoJahr: ausEuro(brutto) })).toBeLessThanOrEqual(brutto);
    }
  });

  it("lässt mehr Brutto nie zu weniger Netto werden", () => {
    // Die Eigenschaft, die eine falsch gesetzte Bemessungsgrenze sofort
    // verrät.
    let vorher = -1;
    for (let brutto = 15_000; brutto <= 200_000; brutto += 5_000) {
      const n = netto({ bruttoJahr: ausEuro(brutto) });
      expect(n, `${brutto} €`).toBeGreaterThan(vorher);
      vorher = n;
    }
  });

  it("mindert das Netto durch Kirchensteuer", () => {
    expect(netto({ kirchensteuer: true })).toBeLessThan(netto({ kirchensteuer: false }));
  });

  it("gibt Steuerklasse III mehr als Steuerklasse I", () => {
    expect(netto({ steuerklasse: 3 })).toBeGreaterThan(netto({ steuerklasse: 1 }));
  });

  it("berücksichtigt den Zusatzbeitrag der Krankenkasse", () => {
    expect(netto({ zusatzbeitrag: 0.04 })).toBeLessThan(netto({ zusatzbeitrag: 0.01 }));
  });

  it("deckelt die Beiträge an den Bemessungsgrenzen", () => {
    /*
     * Oberhalb der Grenzen steigt der Sozialbeitrag nicht mehr. Also
     * muss der ZUWACHS an Netto oberhalb grösser sein als unterhalb —
     * bei gleichem Bruttosprung. Prüft beide Grenzen auf einmal.
     */
    const unten = netto({ bruttoJahr: ausEuro(50_000) }) - netto({ bruttoJahr: ausEuro(40_000) });
    const oben = netto({ bruttoJahr: ausEuro(150_000) }) - netto({ bruttoJahr: ausEuro(140_000) });
    expect(oben).toBeGreaterThan(unten);
  });

  it("verteilt auf die gewählte Zahl der Auszahlungen", () => {
    const r = deutschland2026.berechne(eingabe({ zahlungen: 13 }));
    if (!r.abgedeckt) throw new Error("nicht abgedeckt");
    expect(zuEuro(r.nettoJeZahlung) * 13).toBeCloseTo(zuEuro(r.nettoJahr), 0);
  });

  it("behandelt einen Bonus als steuerpflichtig", () => {
    const ohne = netto({ sonstigeBezuege: 0 });
    const mit = netto({ sonstigeBezuege: ausEuro(5_000) });
    expect(mit).toBeGreaterThan(ohne);
    // Und zwar um weniger als den Bonus — sonst wäre er steuerfrei.
    expect(mit - ohne).toBeLessThan(5_000);
  });

  it("nennt die Regelwerksfassung im Ergebnis", () => {
    const r = deutschland2026.berechne(eingabe());
    if (!r.abgedeckt) throw new Error("nicht abgedeckt");
    expect(r.regelwerkVersion).toBe(R.VERSION);
    expect(r.steuerjahr).toBe(2026);
  });

  it("führt das Regelwerk weiterhin als ungeprüft", () => {
    /*
     * Der Hinweis „nicht gegen die amtlichen Testfälle geprüft" wurde
     * auf Anweisung aus der Oberfläche entfernt. Die Tatsache dahinter
     * ist unverändert: `FREIGEGEBEN` steht auf false.
     *
     * Dieser Test hält genau das fest. Er wird rot, sobald jemand die
     * Freigabe setzt, ohne die Prüfung gemacht zu haben — und er ist
     * die Stelle, an der man beim Prüfen vorbeikommt.
     */
    expect(FREIGEGEBEN).toBe(false);
  });
});

describe("Was der Rechner nicht kann, sagt er", () => {
  it("lehnt Steuerklasse VI ab", () => {
    const r = deutschland2026.berechne(eingabe({ steuerklasse: 6 }));
    expect(r.abgedeckt).toBe(false);
    if (!r.abgedeckt) expect(r.grund).toMatch(/zweites Arbeitsverhältnis/);
  });

  it("verlangt bei privater Krankenversicherung den echten Beitrag", () => {
    /*
     * Der PKV-Beitrag hängt an Alter, Tarif und Gesundheitsprüfung. Ihn
     * zu schätzen hiesse, um mehrere hundert Euro danebenzuliegen —
     * und zwar in einer Zahl, mit der jemand eine Entscheidung trifft.
     */
    const r = deutschland2026.berechne(
      eingabe({ krankenversicherung: "privat", pkvBeitragMonat: 0 }),
    );
    expect(r.abgedeckt).toBe(false);
  });

  it("lehnt den Minijob-Bereich ab, statt falsch zu rechnen", () => {
    const r = deutschland2026.berechne(eingabe({ bruttoJahr: ausEuro(6_000) }));
    expect(r.abgedeckt).toBe(false);
    if (!r.abgedeckt) expect(r.grund).toMatch(/Minijob|Übergangsbereich/);
  });
});

describe("Landauswahl", () => {
  it("findet den deutschen Rechner", () => {
    expect(rechnerFuer("DE", 2026)?.land).toBe("DE");
  });

  it("gibt für ein unbekanntes Land nichts zurück", () => {
    /*
     * Die Zusage aus der Vorgabe: keine deutsche Berechnung auf einer
     * Schweizer Stelle. `null` zwingt die Aufrufstelle, das zu sagen —
     * ein Rückfall auf Deutschland wäre eine überzeugend aussehende
     * Zahl ohne jede Bedeutung.
     */
    expect(rechnerFuer("CH", 2026)).toBeNull();
    expect(rechnerFuer("AT", 2026)).toBeNull();
  });

  it("gibt für ein unbekanntes Steuerjahr nichts zurück", () => {
    // Beim Jahreswechsel darf nicht stillschweigend das alte Regelwerk
    // weiterlaufen.
    expect(rechnerFuer("DE", 2027)).toBeNull();
    expect(rechnerFuer("DE", 2024)).toBeNull();
  });
});
