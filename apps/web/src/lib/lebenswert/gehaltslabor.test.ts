import { describe, expect, it } from "vitest";
import { STANDARD } from "../payroll/angaben.ts";
import { bruttoFuerNetto, erhoehung } from "./gehaltslabor.ts";

/**
 * Zwei Rechnungen, an denen sich Gehaltsverhandlungen entscheiden.
 *
 * Beide sind gefährlich, wenn sie danebenliegen — und beide auf
 * verschiedene Weise:
 *
 *   Ein zu hoher Nettozuwachs lässt jemanden eine Erhöhung annehmen,
 *   die weniger bringt als gedacht. Er merkt es erst auf der
 *   Abrechnung, und dann ist verhandelt.
 *
 *   Ein zu niedriges Zielbrutto lässt jemanden zu wenig fordern. Diesen
 *   Fehler merkt niemand je — er kostet nur jedes Jahr Geld.
 */

const KINDERLOS_KLASSE_I = STANDARD;

describe("Was von einer Erhöhung bleibt", () => {
  it("gibt netto deutlich weniger als brutto zurück", () => {
    const e = erhoehung(60_000, 5_000, KINDERLOS_KLASSE_I)!;
    expect(e.nettoPlusJahr).toBeGreaterThan(0);
    expect(e.nettoPlusJahr).toBeLessThan(5_000);
  });

  it("zeigt den Grenzabgabensatz höher als den Durchschnitt", () => {
    /*
     * Der Kern der Sache, und der Grund, warum beide Zahlen dastehen.
     *
     * Auf den zusätzlichen Euro liegt eine höhere Last als auf dem
     * Durchschnitt des bisherigen Gehalts. Wer nur die
     * Durchschnittsbelastung kennt, überschätzt jede Erhöhung — und
     * zwar systematisch, nie in die andere Richtung.
     */
    const e = erhoehung(60_000, 5_000, KINDERLOS_KLASSE_I)!;
    expect(e.grenzabgaben).toBeGreaterThan(e.durchschnittsabgaben);
  });

  it("bleibt der Grenzabgabensatz zwischen null und eins", () => {
    // Ein Satz über 100 % hiesse: Die Erhöhung kostet Geld. Das ist im
    // deutschen Tarif nicht möglich, und wenn die Rechnung es behauptet,
    // ist die Rechnung kaputt.
    for (const brutto of [20_000, 40_000, 60_000, 90_000, 150_000]) {
      const e = erhoehung(brutto, 5_000, KINDERLOS_KLASSE_I)!;
      expect(e.grenzabgaben, `${brutto}`).toBeGreaterThan(0);
      expect(e.grenzabgaben, `${brutto}`).toBeLessThan(1);
    }
  });

  it("rechnet den Monatsbetrag als Zwölftel des Jahres", () => {
    const e = erhoehung(60_000, 6_000, KINDERLOS_KLASSE_I)!;
    expect(e.nettoPlusMonat).toBe(Math.round(e.nettoPlusJahr / 12));
  });

  it("berücksichtigt die eigenen Angaben", () => {
    // Steuerklasse III lässt von derselben Erhöhung mehr übrig.
    const eins = erhoehung(60_000, 5_000, { ...STANDARD, steuerklasse: 1 })!;
    const drei = erhoehung(60_000, 5_000, { ...STANDARD, steuerklasse: 3 })!;
    expect(drei.nettoPlusJahr).toBeGreaterThan(eins.nettoPlusJahr);
  });

  it("rechnet nicht bei unsinnigen Eingaben", () => {
    expect(erhoehung(0, 5_000, KINDERLOS_KLASSE_I)).toBeNull();
    expect(erhoehung(60_000, 0, KINDERLOS_KLASSE_I)).toBeNull();
    expect(erhoehung(60_000, -5_000, KINDERLOS_KLASSE_I)).toBeNull();
  });

  it("kennt kein Regelwerk für ein Land ohne Rechner", () => {
    expect(erhoehung(60_000, 5_000, KINDERLOS_KLASSE_I, "CH")).toBeNull();
  });
});

describe("Welches Brutto zu einem Zielnetto führt", () => {
  it("trifft das Ziel auf wenige Euro genau", () => {
    const z = bruttoFuerNetto(2_800, KINDERLOS_KLASSE_I).ergebnis!;
    expect(Math.abs(z.erreichtesNettoMonat - 2_800)).toBeLessThanOrEqual(20);
  });

  it("liefert ein Brutto, das deutlich über dem Zielnetto liegt", () => {
    const z = bruttoFuerNetto(2_800, KINDERLOS_KLASSE_I).ergebnis!;
    expect(z.bruttoJahr).toBeGreaterThan(2_800 * 12);
  });

  it("steigt monoton mit dem Ziel", () => {
    /*
     * Der Test, der eine kaputte Suche entlarvt.
     *
     * Eine binäre Suche mit vertauschten Grenzen liefert einzelne
     * plausible Werte und wird an anderer Stelle falsch. Monotonie
     * prüft die Suche als Ganzes und nicht einen Punkt.
     */
    let vorher = 0;
    for (const ziel of [1_500, 2_000, 2_500, 3_000, 4_000, 6_000]) {
      const z = bruttoFuerNetto(ziel, KINDERLOS_KLASSE_I).ergebnis!;
      expect(z.bruttoJahr, `Ziel ${ziel}`).toBeGreaterThan(vorher);
      vorher = z.bruttoJahr;
    }
  });

  it("passt sich den eigenen Angaben an", () => {
    // Wer in Steuerklasse III ist, braucht für dasselbe Netto weniger
    // brutto. Wenn die Angaben nicht ankämen, wären beide Zahlen gleich.
    const eins = bruttoFuerNetto(2_800, { ...STANDARD, steuerklasse: 1 }).ergebnis!;
    const drei = bruttoFuerNetto(2_800, { ...STANDARD, steuerklasse: 3 }).ergebnis!;
    expect(drei.bruttoJahr).toBeLessThan(eins.bruttoJahr);
  });

  it("stimmt mit dem Rechner überein, den es benutzt", () => {
    /*
     * Die Probe.
     *
     * Die Suche darf keine eigene, vereinfachte Steuerformel haben —
     * sonst driften die beiden Zahlen im Produkt auseinander, und
     * niemand kann sagen, welche recht hat. Deshalb ist das errechnete
     * Netto Teil des Ergebnisses und wird hier gegen das Ziel geprüft.
     */
    for (const ziel of [1_800, 2_400, 3_200]) {
      const z = bruttoFuerNetto(ziel, KINDERLOS_KLASSE_I).ergebnis!;
      expect(Math.abs(z.erreichtesNettoMonat - ziel), `Ziel ${ziel}`).toBeLessThanOrEqual(20);
    }
  });

  it("gibt nichts zurück, statt einen Randwert auszugeben", () => {
    /*
     * Der Randwert ist hier die verführerischste falsche Antwort.
     *
     * Er sieht aus wie ein Ergebnis und ist die Kante des Suchfensters.
     * Wer seine Forderung danach richtet, fordert zu wenig — und dieser
     * Fehler fällt nie auf.
     */
    const zuHoch = bruttoFuerNetto(10_000_000, KINDERLOS_KLASSE_I);
    expect(zuHoch.ergebnis).toBeNull();
    expect(zuHoch.grund).toBeTruthy();

    expect(bruttoFuerNetto(0, KINDERLOS_KLASSE_I).ergebnis).toBeNull();
    expect(bruttoFuerNetto(-100, KINDERLOS_KLASSE_I).ergebnis).toBeNull();
  });

  it("sagt beim Minijob-Bereich, woran es liegt", () => {
    // 200 € netto im Monat liegen unterhalb dessen, was das Regelwerk
    // abdeckt. Der Grund muss das benennen, sonst sieht es nach einem
    // Fehler aus.
    const zuNiedrig = bruttoFuerNetto(200, KINDERLOS_KLASSE_I);
    expect(zuNiedrig.ergebnis).toBeNull();
    expect(zuNiedrig.grund).toMatch(/Übergangsbereich|Minijob/);
  });

  it("kennt kein Regelwerk für ein Land ohne Rechner", () => {
    const r = bruttoFuerNetto(2_800, KINDERLOS_KLASSE_I, "CH");
    expect(r.ergebnis).toBeNull();
    expect(r.grund).toMatch(/CH/);
  });
});
