import { describe, expect, it } from "vitest";
import { arbeitswegBelastbar, ortslage, szenario, type Ortsangabe } from "./ortsrolle.ts";

const beleg = ["fundstelle-1"];

describe("Ortsrollen (Prüffall B01)", () => {
  it("erkennt zwei verschiedene Einsatzorte als Widerspruch", () => {
    /*
     * Der Fall aus der Wettbewerbsprüfung: Kopf sagt Stuttgart, Text
     * sagt Freiburg. Welcher stimmt, ist nicht feststellbar — und genau
     * das muss herauskommen.
     */
    const lage = ortslage([
      { ort: "Stuttgart", rolle: "einsatzort", belege: beleg },
      { ort: "Freiburg", rolle: "einsatzort", belege: beleg },
    ]);
    expect(lage.befund).toBe("widerspruch");
    expect(lage.einsatzort).toBeNull();
    expect(lage.auswahl).toEqual(["Stuttgart", "Freiburg"]);
  });

  it("behauptet bei einem Widerspruch keine Pendelwertung", () => {
    const lage = ortslage([
      { ort: "Halle", rolle: "einsatzort", belege: beleg },
      { ort: "Magdeburg", rolle: "einsatzort", belege: beleg },
    ]);
    expect(arbeitswegBelastbar(lage)).toBe(false);
    expect(lage.satz).toContain("Bevor ich deinen Arbeitsweg vergleiche");
  });

  it("hält Firmensitz und Suchregion aus dem Konflikt heraus", () => {
    /*
     * Ein Unternehmen mit Sitz in München, das in Nürnberg beschäftigt,
     * ist der Normalfall — kein Datenfehler.
     */
    const lage = ortslage([
      { ort: "Nürnberg", rolle: "einsatzort", belege: beleg },
      { ort: "München", rolle: "firmensitz", belege: beleg },
      { ort: "Bayern", rolle: "recruiting_region", belege: beleg },
    ]);
    expect(lage.befund).toBe("eindeutig");
    expect(lage.einsatzort).toBe("Nürnberg");
    expect(arbeitswegBelastbar(lage)).toBe(true);
  });

  it("zählt einen belegten Ortsteil nicht als Konflikt", () => {
    const lage = ortslage([
      { ort: "Dornstedt", rolle: "einsatzort", belege: beleg, teilVon: "Teutschenthal" },
      { ort: "Teutschenthal", rolle: "einsatzort", belege: beleg },
    ]);
    expect(lage.befund).toBe("eindeutig");
  });

  it("löst einen Mehrstandort-Hinweis nicht automatisch auf", () => {
    /*
     * Der Bericht ist hier ausdrücklich: Mehrere Standorte erklären den
     * Befund, sie klären ihn nicht. Welcher Ort für diese Person gilt,
     * bleibt offen.
     */
    const lage = ortslage(
      [
        { ort: "Freiburg", rolle: "einsatzort", belege: beleg },
        { ort: "Stuttgart", rolle: "einsatzort", belege: beleg },
      ],
      { mehrstandortBelegt: true },
    );
    expect(lage.befund).toBe("mehrere_belegt");
    expect(arbeitswegBelastbar(lage)).toBe(false);
  });

  it("geocodiert nicht still den ersten Treffer", () => {
    const lage = ortslage([{ ort: "Berlin", rolle: "unklar", belege: beleg }]);
    expect(lage.befund).toBe("unbekannt");
    expect(lage.einsatzort).toBeNull();
  });

  it("verlangt einen Beleg, bevor eine Rolle zählt", () => {
    const ohneBeleg: Ortsangabe = { ort: "Köln", rolle: "einsatzort", belege: [] };
    expect(ortslage([ohneBeleg]).befund).toBe("unbekannt");
  });

  it("kennt belegte Arbeit ohne festen Einsatzort", () => {
    const lage = ortslage([], { ohneEinsatzortBelegt: true });
    expect(lage.befund).toBe("ohne_einsatzort");
    expect(arbeitswegBelastbar(lage)).toBe(false);
  });
});

describe("Szenario", () => {
  it("zeigt einen Ort, ohne ihn als geklärt zu speichern", () => {
    const lage = ortslage([
      { ort: "Stuttgart", rolle: "einsatzort", belege: beleg },
      { ort: "Freiburg", rolle: "einsatzort", belege: beleg },
    ]);
    const gewaehlt = szenario(lage, "Freiburg");
    expect(gewaehlt.einsatzort).toBe("Freiburg");
    expect(gewaehlt.nurSzenario).toBe(true);
    /* Und es erfüllt weiterhin keine Pendelbedingung. */
    expect(arbeitswegBelastbar(gewaehlt)).toBe(false);
    expect(gewaehlt.befund).toBe("widerspruch");
  });

  it("nimmt keinen Ort an, der nicht zur Auswahl stand", () => {
    /*
     * Sonst entstünde über den Umweg „Szenario" doch wieder ein frei
     * gewählter Arbeitsort.
     */
    const lage = ortslage([
      { ort: "Stuttgart", rolle: "einsatzort", belege: beleg },
      { ort: "Freiburg", rolle: "einsatzort", belege: beleg },
    ]);
    expect(szenario(lage, "Hamburg").einsatzort).toBeNull();
  });
});
