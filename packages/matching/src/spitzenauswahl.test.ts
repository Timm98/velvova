import { describe, expect, it } from "vitest";
import {
  FITBAND,
  SPITZE_V1,
  grundlage,
  grundlagenSatz,
  spitzenauswahl,
  spitzenreihenfolge,
  type Spitzenkandidat,
} from "./spitzenauswahl.ts";

let zaehler = 0;
const K = (teil: Partial<Spitzenkandidat> = {}): Spitzenkandidat => ({
  trefferId: `t${String(++zaehler).padStart(3, "0")}`,
  arbeitgeberId: `a${zaehler}`,
  fitScore: 80,
  gehaltJahr: null,
  anzeigenqualitaet: null,
  arbeitgeberurteil: null,
  berufsgruppePasst: null,
  ...teil,
});

describe("Das Passungsband", () => {
  it("lässt das Gehalt innerhalb eines Bandes entscheiden", () => {
    /*
     * Ohne Bänder entschiede ein Punkt Fit über zwölftausend Euro im
     * Jahr. Der Fit ist auf fünf Punkte genau ehrlich, nicht auf einen.
     */
    const schlechterFitMehrGeld = K({ fitScore: 81, gehaltJahr: 62_000 });
    const besserFitWenigerGeld = K({ fitScore: 84, gehaltJahr: 50_000 });
    const sortiert = [besserFitWenigerGeld, schlechterFitMehrGeld].sort(spitzenreihenfolge);
    expect(sortiert[0]).toBe(schlechterFitMehrGeld);
  });

  it("lässt einen echten Passungsunterschied gewinnen", () => {
    /* Ein Band Unterschied ist kein Rundungsfehler mehr. */
    const hoch = K({ fitScore: 90, gehaltJahr: 45_000 });
    const niedrig = K({ fitScore: 70, gehaltJahr: 80_000 });
    expect([niedrig, hoch].sort(spitzenreihenfolge)[0]).toBe(hoch);
  });

  it("bündelt in Schritten der vereinbarten Breite", () => {
    const a = K({ fitScore: 80, gehaltJahr: 50_000 });
    const b = K({ fitScore: 80 + FITBAND - 1, gehaltJahr: 60_000 });
    expect([a, b].sort(spitzenreihenfolge)[0]).toBe(b);
  });
});

describe("Unbekanntes entscheidet nicht", () => {
  it("stellt eine Anzeige ohne Gehalt nicht nach hinten", () => {
    /*
     * 77 Prozent der deutschen Anzeigen nennen kein Gehalt. Eine
     * Sortierung, die Unbekanntes wie „null Euro" behandelt, liefert
     * morgens die Stellen der gesprächigsten Arbeitgeber statt der
     * besten.
     */
    const ohneGehalt = K({ fitScore: 84, gehaltJahr: null });
    const mitGehalt = K({ fitScore: 81, gehaltJahr: 70_000 });
    const sortiert = [mitGehalt, ohneGehalt].sort(spitzenreihenfolge);
    expect(sortiert[0]).toBe(ohneGehalt);
  });

  it("geht zum nächsten Kriterium, wenn eines fehlt", () => {
    const a = K({ fitScore: 80, gehaltJahr: null, anzeigenqualitaet: 90 });
    const b = K({ fitScore: 80, gehaltJahr: 70_000, anzeigenqualitaet: 40 });
    /* Gehalt kann nicht entscheiden — nur eine Seite hat eines. */
    expect([b, a].sort(spitzenreihenfolge)[0]).toBe(a);
  });

  it("bleibt bei völlig gleicher Lage stabil", () => {
    /*
     * Ohne stabile Ordnung erzeugt ein zweiter Lauf eine andere Liste
     * als der erste, und kein Test darauf wäre schreibbar.
     */
    const a = K({ trefferId: "t-a", fitScore: 80 });
    const b = K({ trefferId: "t-b", fitScore: 80 });
    expect([b, a].sort(spitzenreihenfolge)[0]!.trefferId).toBe("t-a");
    expect([a, b].sort(spitzenreihenfolge)[0]!.trefferId).toBe("t-a");
  });
});

describe("spitzenauswahl", () => {
  it("nimmt höchstens die vereinbarte Zahl", () => {
    const viele = Array.from({ length: 20 }, (_, i) => K({ fitScore: 90 - i }));
    expect(spitzenauswahl(viele).gewaehlt).toHaveLength(SPITZE_V1.anzahl);
  });

  it("füllt nicht auf", () => {
    /*
     * „Fünf sollten es schon sein" füllt Platz vier und fünf mit
     * etwas, das niemand empfohlen hätte.
     */
    expect(spitzenauswahl([K(), K()]).gewaehlt).toHaveLength(2);
    expect(spitzenauswahl([]).gewaehlt).toHaveLength(0);
  });

  it("begrenzt je Arbeitgeber", () => {
    const gleiche = Array.from({ length: 6 }, (_, i) =>
      K({ arbeitgeberId: "eine-firma", fitScore: 90 - i }),
    );
    const e = spitzenauswahl(gleiche);
    expect(e.gewaehlt).toHaveLength(SPITZE_V1.jeArbeitgeber);
  });

  it("lässt andere Arbeitgeber nachrücken", () => {
    const kandidaten = [
      K({ arbeitgeberId: "x", fitScore: 95 }),
      K({ arbeitgeberId: "x", fitScore: 94 }),
      K({ arbeitgeberId: "x", fitScore: 93 }),
      K({ arbeitgeberId: "y", fitScore: 60 }),
    ];
    const e = spitzenauswahl(kandidaten);
    expect(e.gewaehlt.map((k) => k.arbeitgeberId)).toEqual(["x", "x", "y"]);
  });
});

describe("grundlage", () => {
  it("zählt ein Kriterium erst ab zwei Kandidaten", () => {
    /*
     * Eines allein kann nichts entscheiden. Wer liest „sortiert nach
     * Gehalt", während genau eine Anzeige eines nennt, ist belogen.
     */
    const g = grundlage([K({ gehaltJahr: 60_000 }), K({ gehaltJahr: null })]);
    expect(g.grundlage).toContain("passung");
    expect(g.grundlage).not.toContain("gehalt");
    expect(g.fehlend).toContain("gehalt");
  });

  it("nimmt das Gehalt auf, sobald zwei es haben", () => {
    const g = grundlage([K({ gehaltJahr: 60_000 }), K({ gehaltJahr: 50_000 })]);
    expect(g.grundlage).toContain("gehalt");
  });

  it("führt Arbeitgeberbewertungen heute immer als fehlend", () => {
    /* `review_aggregates` hat am 10.09.2026 null Zeilen. */
    expect(grundlage([K(), K(), K()]).fehlend).toContain("arbeitgeberurteil");
  });
});

describe("grundlagenSatz", () => {
  it("nennt nur, was entschieden hat", () => {
    const e = spitzenauswahl([K({ gehaltJahr: null }), K({ gehaltJahr: null })]);
    const satz = grundlagenSatz(e);
    expect(satz).toContain("Passung");
    expect(satz).not.toContain("Bewertungen der Arbeitgeber.");
  });

  it("sagt, wenn zu viele Anzeigen zum Gehalt schweigen", () => {
    const e = spitzenauswahl([K({ gehaltJahr: 60_000 }), K({ gehaltJahr: null })]);
    expect(grundlagenSatz(e)).toContain("schweigen");
  });

  it("behauptet ohne Datenlage keine Reihenfolge", () => {
    const e = spitzenauswahl([K({ fitScore: null })]);
    expect(grundlagenSatz(e)).toContain("reichte die Datenlage nicht");
  });
});

describe("Die Berufsgruppe", () => {
  it("entscheidet vor dem Gehalt", () => {
    /*
     * Der gemessene Fall: „Sachbearbeiter Debitorenbuchhaltung" kam
     * über den Fliesstext in eine Suche nach „Lager, Logistik" — und
     * nennt ein Gehalt, das die passende Stelle nicht nennt. Ohne
     * diese Stufe stünde sie morgens auf Platz eins.
     */
    const falscheGruppeMitGeld = K({ berufsgruppePasst: false, gehaltJahr: 44_000 });
    const richtigeGruppeOhneGeld = K({ berufsgruppePasst: true, gehaltJahr: null });
    const sortiert = [falscheGruppeMitGeld, richtigeGruppeOhneGeld].sort(spitzenreihenfolge);
    expect(sortiert[0]).toBe(richtigeGruppeOhneGeld);
  });

  it("entscheidet nicht über ein Passungsband hinweg", () => {
    const falscheGruppeBesserFit = K({ berufsgruppePasst: false, fitScore: 90 });
    const richtigeGruppeSchlechterFit = K({ berufsgruppePasst: true, fitScore: 60 });
    const sortiert = [richtigeGruppeSchlechterFit, falscheGruppeBesserFit].sort(spitzenreihenfolge);
    expect(sortiert[0]).toBe(falscheGruppeBesserFit);
  });

  it("entscheidet nur, wenn beide Seiten bekannt sind", () => {
    /*
     * 928.242 von 1,24 Millionen deutschen Anzeigen tragen eine
     * Berufskennung. Die übrigen dürfen nicht dafür büssen, dass
     * niemand sie zugeordnet hat — sie fallen auf das nächste
     * Kriterium durch.
     */
    const ohneKennungMehrGeld = K({ berufsgruppePasst: null, gehaltJahr: 60_000 });
    const mitKennungWenigerGeld = K({ berufsgruppePasst: true, gehaltJahr: 40_000 });
    const sortiert = [mitKennungWenigerGeld, ohneKennungMehrGeld].sort(spitzenreihenfolge);
    expect(sortiert[0]).toBe(ohneKennungMehrGeld);
  });

  it("zählt als Grundlage erst ab zwei bekannten Werten", () => {
    expect(grundlage([K({ berufsgruppePasst: true }), K(), K()]).fehlend).toContain("berufsgruppe");
    const zwei = grundlage([K({ berufsgruppePasst: true }), K({ berufsgruppePasst: false }), K()]);
    expect(zwei.grundlage).toContain("berufsgruppe");
  });

  it("kommt im Satz vor, wenn sie mitentschieden hat", () => {
    const e = spitzenauswahl([K({ berufsgruppePasst: true }), K({ berufsgruppePasst: false })]);
    expect(grundlagenSatz(e)).toContain("Berufsgruppe");
  });
});
