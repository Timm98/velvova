import { describe, expect, it } from "vitest";
import { deuteSuchintention } from "./suchintention.ts";
import { umkreisStufe } from "./umkreis.ts";

describe("weiter suchen heisst eine Stufe, nicht die Welt", () => {
  it("geht vom gemeldeten Fall aus eine Stufe nach draussen", () => {
    /*
     * Gemeldet am 8. September 2026: 30 km um Karlsruhe, dann
     * „kannst mehr suchen" — und es kamen Stellen aus Köln, 250 km
     * entfernt.
     */
    expect(umkreisStufe(30, "weiter")).toBe(50);
    expect(umkreisStufe(50, "weiter")).toBe(75);
    expect(umkreisStufe(75, "weiter")).toBe(100);
  });

  it("nimmt 25 an, wenn noch kein Umkreis dasteht", () => {
    expect(umkreisStufe(null, "weiter")).toBe(50);
    expect(umkreisStufe(null, "enger")).toBe(10);
  });

  it("hört oben und unten auf", () => {
    expect(umkreisStufe(300, "weiter")).toBe(300);
    expect(umkreisStufe(500, "weiter")).toBe(300);
    expect(umkreisStufe(10, "enger")).toBe(10);
  });

  it("bringt krumme Werte zurück auf die Leiter", () => {
    expect(umkreisStufe(32, "weiter")).toBe(50);
    expect(umkreisStufe(32, "enger")).toBe(25);
  });

  it("geht nach innen zur nächstkleineren Stufe", () => {
    expect(umkreisStufe(100, "enger")).toBe(75);
    expect(umkreisStufe(25, "enger")).toBe(10);
  });
});

describe("die Sätze, die den Umkreis meinen", () => {
  it.each([
    "mach den umkreis größer",
    "kannst mehr suchen",
    "such weiter",
    "erweitere die suche",
    "größerer umkreis",
  ])("weitet: %s", (satz) => {
    const r = deuteSuchintention(satz);
    expect(r.umkreisSchritt).toBe("weiter");
    /* Kein Volltext daneben — sonst sucht die Liste nach „größer". */
    expect(r.filter.q).toBeUndefined();
  });

  it.each(["mach den umkreis kleiner", "näher an zuhause", "engerer umkreis"])(
    "verengt: %s",
    (satz) => {
      expect(deuteSuchintention(satz).umkreisSchritt).toBe("enger");
    },
  );

  it("vergrössern entfernt den Umkreis NICHT mehr", () => {
    /*
     * Der eigentliche Fehler: Das Schlusswort („weg", „raus") war
     * optional, also reichte „mach den umkreis …". Vergrössern wurde
     * damit als Löschen gelesen — und ohne Umkreis war ganz
     * Deutschland dran.
     */
    const r = deuteSuchintention("mach den umkreis größer");
    expect(r.entfernen).not.toContain("umkreisKm");
  });

  it("wegnehmen geht weiterhin, wenn es dasteht", () => {
    expect(deuteSuchintention("mach den umkreis weg").entfernen).toContain("umkreisKm");
    expect(deuteSuchintention("mach den gehaltsfilter weg").entfernen).toContain("gehaltAb");
    expect(deuteSuchintention("lösch den ortsfilter").entfernen).toContain("ort");
  });
});

describe("alle Filter löschen", () => {
  it.each([
    "lösche alle filter",
    "lösch alle filter",
    "alle filter weg",
    "setz alle filter zurück",
    "entferne alle filter",
  ])("%s", (satz) => {
    const r = deuteSuchintention(satz);
    expect(r.allesEntfernen).toBe(true);
    /*
     * Vorher wurde daraus `q = "lösche alle filter"` — der Satz
     * SETZTE also den schlechtestmöglichen Filter, statt alle zu
     * nehmen. Kein Stellentitel enthält diese Wörter.
     */
    expect(r.filter.q).toBeUndefined();
  });

  it("lässt eine gewöhnliche Suche in Ruhe", () => {
    const r = deuteSuchintention("bürokaufmann ab 40k");
    expect(r.allesEntfernen).toBeUndefined();
    expect(r.filter.gehaltAb).toBe(40_000);
    expect(r.filter.q).toBe("bürokaufmann");
  });
});
