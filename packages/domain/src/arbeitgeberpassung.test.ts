import { describe, expect, it } from "vitest";
import {
  BELEG_VERFALL_TAGE,
  MIN_BELEGDICHTE,
  arbeitgeberpassung,
  frischegewicht,
  type Arbeitgeberprofil,
  type FrühereStelle,
  type Suchprofil,
} from "./arbeitgeberpassung.ts";

const JETZT = new Date("2026-09-09T12:00:00Z");
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86_400_000);

const stelle = (teil: Partial<FrühereStelle> = {}): FrühereStelle => ({
  titel: "Projektmanagerin Digitalisierung",
  berufsfeld: "projektmanagement",
  ort: "Reutlingen",
  gesehenAm: vorTagen(240),
  quelle: "job:abc-123",
  ...teil,
});

const AMT: Arbeitgeberprofil = {
  name: "Landratsamt Reutlingen",
  art: "oeffentlich",
  branche: "öffentliche verwaltung",
  ort: "Reutlingen",
  frühereStellen: [stelle()],
};

const SUCHE: Suchprofil = {
  berufsfelder: ["projektmanagement"],
  orte: ["Reutlingen"],
  branchen: ["öffentliche verwaltung"],
  bevorzugteArt: "oeffentlich",
  ausgeschlosseneArten: [],
  ausgeschlosseneNamen: [],
};

const pruefe = (a: Partial<Arbeitgeberprofil> = {}, s: Partial<Suchprofil> = {}) =>
  arbeitgeberpassung({ ...AMT, ...a }, { ...SUCHE, ...s }, JETZT);

describe("Der Beleg kommt aus früheren Anzeigen", () => {
  it("bewertet einen passenden Arbeitgeber hoch und sagt, warum", () => {
    const u = pruefe();
    expect(u.bewertbar).toBe(true);
    if (!u.bewertbar) return;
    expect(u.punkte).toBeGreaterThan(70);
    expect(u.belege.map((b) => b.aussage).join(" ")).toMatch(/Projektmanagerin Digitalisierung/);
  });

  it("führt zu jedem Beleg eine Fundstelle", () => {
    const u = pruefe();
    if (!u.bewertbar) throw new Error("sollte bewertbar sein");
    /* §6: keine wichtige Behauptung ohne Quelle. */
    expect(u.belege.length).toBeGreaterThan(0);
    for (const b of u.belege) expect(b.quelle.length).toBeGreaterThan(0);
  });

  it("zählt mehrere Anzeigen derselben Rolle stärker als eine", () => {
    const eine = pruefe({ frühereStellen: [stelle()] });
    const drei = pruefe({
      frühereStellen: [stelle(), stelle({ quelle: "job:2" }), stelle({ quelle: "job:3" })],
    });
    if (!eine.bewertbar || !drei.bewertbar) throw new Error("beide bewertbar");
    expect(drei.punkte).toBeGreaterThan(eine.punkte);
  });

  it("wertet eine alte Anzeige schwächer als eine frische", () => {
    const frisch = pruefe({ frühereStellen: [stelle({ gesehenAm: vorTagen(30) })] });
    const alt = pruefe({ frühereStellen: [stelle({ gesehenAm: vorTagen(600) })] });
    if (!frisch.bewertbar || !alt.bewertbar) throw new Error("beide bewertbar");
    expect(frisch.punkte).toBeGreaterThan(alt.punkte);
  });

  it("lässt eine Anzeige nach zwei Jahren gar nicht mehr zählen", () => {
    /*
     * Eine Anzeige von vor drei Jahren beweist, dass es die Rolle
     * einmal gab — nicht, dass es sie noch gibt. Abteilungen werden
     * aufgelöst, Bereiche ausgelagert.
     */
    expect(frischegewicht(vorTagen(BELEG_VERFALL_TAGE + 1), JETZT)).toBe(0);
    const u = pruefe({ frühereStellen: [stelle({ gesehenAm: vorTagen(1000) })] });
    if (!u.bewertbar) throw new Error("bewertbar");
    expect(u.punkte).toBeLessThan(60);
  });
});

describe("Unwissen wird nicht zu einer mittleren Zuversicht", () => {
  it("gibt gar keine Zahl aus, wenn zu wenig bekannt ist", () => {
    /*
     * Nicht eine niedrige Zahl. Eine 34 mit dem Zusatz "schwach
     * belegt" wird gelesen als "34", und danach steht ein Arbeitgeber
     * in einer Rangliste, über den nichts bekannt ist.
     */
    const u = arbeitgeberpassung(
      { name: "Unbekannt GmbH", art: "privat", branche: null, ort: null, frühereStellen: [] },
      { ...SUCHE, bevorzugteArt: null, branchen: [] },
      JETZT,
    );
    expect(u.bewertbar).toBe(false);
    if (u.bewertbar) return;
    expect(u.grund).toMatch(/zu wenig bekannt/);
  });

  it("meldet Belegdichte unter 1, wenn etwas fehlt", () => {
    const u = pruefe({ ort: null, frühereStellen: [stelle({ ort: null })] });
    if (!u.bewertbar) throw new Error("bewertbar");
    expect(u.belegdichte).toBeLessThan(1);
    expect(u.luecken.join(" ")).toMatch(/Standort/);
  });

  it("meldet Belegdichte 1, wenn alles bekannt ist", () => {
    const u = pruefe();
    if (!u.bewertbar) throw new Error("bewertbar");
    expect(u.belegdichte).toBe(1);
    expect(u.luecken).toEqual([]);
  });

  it("wertet 'unbekannt' besser als 'passt nachweislich nicht'", () => {
    /*
     * Der eigentliche Punkt. Fehlendes Wissen als 0 zu werten wäre
     * eine Behauptung ("passt nicht"), als 0,5 eine Erfindung
     * ("passt mittelmässig"). Es zählt gar nicht — und deshalb muss
     * ein Arbeitgeber mit unbekanntem Standort besser dastehen als
     * einer, dessen Standort nachweislich woanders liegt.
     */
    const unbekannt = pruefe({ ort: null, frühereStellen: [stelle({ ort: null })] });
    const danebenliegend = pruefe({ ort: "Hamburg", frühereStellen: [stelle({ ort: "Hamburg" })] });
    if (!unbekannt.bewertbar || !danebenliegend.bewertbar) throw new Error("bewertbar");

    expect(unbekannt.punkte).toBeGreaterThan(danebenliegend.punkte);
    /* Dafür weiss man beim zweiten mehr — und das steht auch da. */
    expect(unbekannt.belegdichte).toBeLessThan(danebenliegend.belegdichte);
  });

  it("verrechnet eine unbekannte Dimension nicht heimlich als Mittelwert", () => {
    /*
     * Gegenprobe zur Bequemlichkeit: Wäre `null` intern 0,5, läge das
     * Ergebnis zwischen Treffer und Fehltreffer. Es liegt darüber,
     * weil die Dimension gar nicht mitzählt.
     */
    const unbekannt = pruefe({ ort: null, frühereStellen: [stelle({ ort: null })] });
    const treffer = pruefe();
    const fehltreffer = pruefe({ ort: "Hamburg", frühereStellen: [stelle({ ort: "Hamburg" })] });
    if (!unbekannt.bewertbar || !treffer.bewertbar || !fehltreffer.bewertbar) {
      throw new Error("bewertbar");
    }
    const mittelwert = (treffer.punkte + fehltreffer.punkte) / 2;
    expect(unbekannt.punkte).toBeGreaterThan(mittelwert);
  });

  it("hält die Schwelle für unbewertbar fest", () => {
    expect(MIN_BELEGDICHTE).toBeGreaterThan(0.3);
  });
});

describe("Anzeigen ohne Treffer sind eine Auskunft, kein Unwissen", () => {
  it("wertet einen Arbeitgeber ab, der nur andere Rollen ausschreibt", () => {
    const u = pruefe({
      frühereStellen: [stelle({ berufsfeld: "pflege", titel: "Pflegefachkraft" })],
    });
    if (!u.bewertbar) throw new Error("bewertbar");
    expect(u.punkte).toBeLessThan(60);
    /* Und zwar mit voller Belegdichte: Wir wissen es, es passt nur nicht. */
    expect(u.belegdichte).toBe(1);
    expect(u.belege.map((b) => b.aussage).join(" ")).toMatch(/passt keine/);
  });
});

describe("Ausschlüsse sind Filter, keine Abzüge", () => {
  it("verwirft eine ausgeschlossene Arbeitgeberart vollständig", () => {
    /*
     * Ein Ausschluss, der nur Punkte kostet, ist irgendwann durch
     * einen guten Rest ausgleichbar — und dann steht ein Arbeitgeber
     * auf der Liste, den jemand ausdrücklich nicht wollte.
     */
    const u = pruefe({}, { ausgeschlosseneArten: ["oeffentlich"] });
    expect(u.bewertbar).toBe(false);
  });

  it("verwirft einen ausgeschlossenen Namen unabhängig von Gross- und Kleinschreibung", () => {
    const u = pruefe({}, { ausgeschlosseneNamen: ["  landratsamt reutlingen "] });
    expect(u.bewertbar).toBe(false);
    if (u.bewertbar) return;
    expect(u.grund).toMatch(/ausgeschlossen/);
  });

  it("schlägt jede noch so gute Passung", () => {
    const gut = pruefe({
      frühereStellen: [stelle(), stelle({ quelle: "b" }), stelle({ quelle: "c" })],
    });
    expect(gut.bewertbar).toBe(true);
    expect(pruefe(
      { frühereStellen: [stelle(), stelle({ quelle: "b" }), stelle({ quelle: "c" })] },
      { ausgeschlosseneArten: ["oeffentlich"] },
    ).bewertbar).toBe(false);
  });
});

describe("Vorlieben", () => {
  it("wertet die bevorzugte Arbeitgeberart als Treffer", () => {
    const passend = pruefe({}, { bevorzugteArt: "oeffentlich" });
    const unpassend = pruefe({}, { bevorzugteArt: "privat" });
    if (!passend.bewertbar || !unpassend.bewertbar) throw new Error("bewertbar");
    expect(passend.punkte).toBeGreaterThan(unpassend.punkte);
  });

  it("behandelt Gleichgültigkeit nicht als fehlende Angabe", () => {
    /* Keine Vorliebe ist eine Antwort, kein Wissenslücke. */
    const u = pruefe({}, { bevorzugteArt: null, branchen: [] });
    if (!u.bewertbar) throw new Error("bewertbar");
    expect(u.belegdichte).toBe(1);
  });
});
