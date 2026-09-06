import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rechnerFuer } from "./index.ts";
import { STANDARD } from "./angaben.ts";
import { annahmenText, eingabeAus } from "./eingabe.ts";
import { zuEuro } from "./core/dezimal.ts";

/**
 * Eine Zuordnung, drei Seiten, ein Ergebnis.
 *
 * Diese Datei entstand aus einem Befund: dasselbe Bruttogehalt ergab im
 * Produkt bis zu drei verschiedene Nettobeträge, je nachdem, wo man
 * stand. Die Vorschau in den Einstellungen rechnete mit der Kinderzahl,
 * die Jobseite gar nicht mit den Einstellungen, und die
 * Lebenshaltungsseite mit den Einstellungen, aber ohne Kinder.
 *
 * Geprüft wird deshalb beides: dass die Zuordnung stimmt — und dass es
 * sie nur einmal gibt.
 */

describe("Angaben werden vollständig übernommen", () => {
  it("übernimmt die Kinderzahl als Kinderfreibeträge", () => {
    /*
     * Der Fehler, der hier drin steckte.
     *
     * `hatKinder: true` allein senkt nur den Pflege-Grundabschlag. Der
     * Kinderfreibetrag und der weitere Abschlag ab dem zweiten Kind
     * hängen an dieser Zahl — an zwei Stellen stand fest `0`.
     */
    const e = eingabeAus({ ...STANDARD, hatKinder: true, kinderzahl: 3 }, 60_000);
    expect(e.kinderfreibetraege).toBe(3);
    expect(e.hatKinder).toBe(true);
  });

  it("übernimmt Steuerklasse, Bundesland, Kirchensteuer, Kasse und Zahlungen", () => {
    const e = eingabeAus(
      {
        ...STANDARD,
        steuerklasse: 3,
        bundesland: "BY",
        kirchensteuer: true,
        krankenversicherung: "privat",
        zusatzbeitrag: 0.019,
        zahlungen: 13,
      },
      60_000,
    );
    expect(e.steuerklasse).toBe(3);
    expect(e.bundesland).toBe("BY");
    expect(e.kirchensteuer).toBe(true);
    expect(e.krankenversicherung).toBe("privat");
    expect(e.zusatzbeitrag).toBe(0.019);
    expect(e.zahlungen).toBe(13);
  });

  it("nimmt die Voreinstellung, wenn nichts hinterlegt ist", () => {
    // `null` heisst „nichts gespeichert", nicht „alles auf null".
    // Ein `steuerklasse: 0` gäbe es nicht, und der Rechner würde
    // scheitern statt zu schätzen.
    const e = eingabeAus(null, 60_000);
    expect(e.steuerklasse).toBe(STANDARD.steuerklasse);
    expect(e.bundesland).toBe(STANDARD.bundesland);
    expect(e.zahlungen).toBe(STANDARD.zahlungen);
  });

  it("füllt die Felder, die ein Cast früher verschwiegen hat", () => {
    // `geburtsjahr` und `freibetragJahr` fehlten hinter einem
    // `as Eingabe`. Der Rechner bekam `undefined` und gab `NaN` zurück,
    // während er Erfolg meldete.
    const e = eingabeAus(STANDARD, 60_000);
    expect(e).toHaveProperty("geburtsjahr");
    expect(e).toHaveProperty("freibetragJahr");
    expect(e.freibetragJahr).toBe(0);
  });
});

describe("Die Angaben wirken auf das Ergebnis", () => {
  const rechner = rechnerFuer("DE", 2026)!;
  const netto = (a: Parameters<typeof eingabeAus>[0]) => {
    const r = rechner.berechne(eingabeAus(a, 60_000));
    expect(r.abgedeckt, r.abgedeckt ? "" : (r.grund ?? "")).toBe(true);
    return r.abgedeckt ? zuEuro(r.nettoJahr) : 0;
  };

  it("ergibt für Steuerklasse III mehr netto als für I", () => {
    // Sonst wäre die Zuordnung zwar vollständig, käme aber nie an.
    expect(netto({ ...STANDARD, steuerklasse: 3 })).toBeGreaterThan(
      netto({ ...STANDARD, steuerklasse: 1 }),
    );
  });

  it("ergibt mit Kindern mehr netto als ohne", () => {
    /*
     * Der Test, der den Befund festhält.
     *
     * Vor der Zusammenlegung war diese Differenz auf der Jobseite und
     * der Lebenshaltungsseite null — die Kinderzahl stand im Profil und
     * ging nie in die Rechnung ein.
     */
    const ohne = netto({ ...STANDARD, hatKinder: false, kinderzahl: 0 });
    const mit = netto({ ...STANDARD, hatKinder: true, kinderzahl: 2 });
    expect(mit).toBeGreaterThan(ohne);
  });

  it("ergibt mit Kirchensteuer weniger netto", () => {
    expect(netto({ ...STANDARD, kirchensteuer: true })).toBeLessThan(netto(STANDARD));
  });

  it("liefert für keine Konstellation NaN", () => {
    for (const klasse of [1, 2, 3, 4, 5, 6] as const) {
      for (const kinder of [0, 1, 3]) {
        const r = rechner.berechne(
          eingabeAus({ ...STANDARD, steuerklasse: klasse, hatKinder: kinder > 0, kinderzahl: kinder }, 60_000),
        );
        const wert = r.abgedeckt ? zuEuro(r.nettoJahr) : 0;
        expect(Number.isFinite(wert), `Klasse ${klasse}, ${kinder} Kinder`).toBe(true);
      }
    }
  });
});

describe("Die Annahmen werden benannt", () => {
  it("nennt die tatsächlichen Werte, nicht die Voreinstellung", () => {
    // Die Pillen unter der Schätzung standen fest auf „Steuerklasse I,
    // kinderlos, ohne Kirchensteuer" — auch für jemanden mit
    // Steuerklasse III und zwei Kindern. Das war nicht bloss unpräzise:
    // die Zahl daneben war ebenfalls die für Klasse I.
    const t = annahmenText({
      ...STANDARD,
      steuerklasse: 3,
      kirchensteuer: true,
      hatKinder: true,
      kinderzahl: 2,
    });
    expect(t).toContain("Steuerklasse III");
    expect(t).toContain("mit Kirchensteuer");
    expect(t).toContain("2 Kinder");
  });

  it("schreibt ein Kind im Singular", () => {
    expect(annahmenText({ ...STANDARD, hatKinder: true, kinderzahl: 1 })).toContain("1 Kind");
  });
});

describe("Es gibt sie nur einmal", () => {
  /*
   * Der Strukturtest.
   *
   * Die inhaltlichen Tests oben prüfen `eingabeAus`. Sie bleiben grün,
   * wenn jemand daneben eine zweite Zuordnung schreibt — genau so ist
   * der Befund entstanden. Deshalb hier: wer ein `Eingabe`-Objekt von
   * Hand baut, muss diesen Test rot machen.
   */
  const WURZEL = new URL("../../", import.meta.url).pathname;
  const ERLAUBT = new Set(["lib/payroll/eingabe.ts"]);

  function dateien(ordner: string): string[] {
    const raus: string[] = [];
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name);
      if (statSync(pfad).isDirectory()) {
        if (name === "node_modules" || name === ".next") continue;
        raus.push(...dateien(pfad));
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        raus.push(pfad);
      }
    }
    return raus;
  }

  it("baut nirgends sonst eine Rechnereingabe von Hand", () => {
    const treffer = dateien(WURZEL)
      .filter((p) => /kinderfreibetraege\s*:/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(WURZEL.length))
      // Der Rechenkern selbst liest das Feld — er baut es nicht.
      .filter((p) => !p.startsWith("lib/payroll/de/") && !p.startsWith("lib/payroll/core/"));

    expect(treffer.filter((p) => !ERLAUBT.has(p))).toEqual([]);
  });
});
