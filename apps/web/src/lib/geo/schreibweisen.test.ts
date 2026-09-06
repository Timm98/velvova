import { describe, expect, it } from "vitest";
import { schreibweisen } from "./schreibweisen.ts";

describe("schreibweisen", () => {
  it("kürzt das mittlere Segment weg", () => {
    /*
     * Der gemessene Fall: „Rheinland" ist eine historische
     * Landschaft, keine Verwaltungseinheit — die Kombination findet
     * kein Geokodierer.
     */
    expect(schreibweisen("Meckenheim, Rheinland, Nordrhein-Westfalen")).toEqual([
      "Meckenheim, Rheinland, Nordrhein-Westfalen",
      "Meckenheim, Nordrhein-Westfalen",
      "Meckenheim",
    ]);
  });

  it("versucht die vollständige Angabe zuerst", () => {
    /* Sie unterscheidet gleichnamige Orte — Frankfurt am Main von
       Frankfurt an der Oder. */
    expect(schreibweisen("Frankfurt, Hessen")[0]).toBe("Frankfurt, Hessen");
  });

  it("lässt einen einteiligen Ort in Ruhe", () => {
    expect(schreibweisen("Karlsruhe")).toEqual(["Karlsruhe"]);
  });

  it("stellt dieselbe Anfrage nicht zweimal", () => {
    /* Jede Schreibweise ist ein Netzaufruf an einen fremden Dienst. */
    expect(schreibweisen("Berlin, Berlin")).toEqual(["Berlin, Berlin", "Berlin"]);
  });

  it("zählt leere Segmente nicht mit", () => {
    /*
     * „Köln, , Nordrhein-Westfalen" hat drei Kommateile, aber nur zwei
     * Angaben. Die Kürzung auf „erstes und letztes" wäre hier
     * identisch mit dem Original und damit eine Anfrage umsonst.
     */
    expect(schreibweisen("Köln, , Nordrhein-Westfalen ")).toEqual([
      "Köln, , Nordrhein-Westfalen ",
      "Köln",
    ]);
  });
});
