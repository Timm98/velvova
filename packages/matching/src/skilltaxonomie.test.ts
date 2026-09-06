import { describe, expect, it } from "vitest";
import {
  OHNE_SKILLDATEN,
  tabellenadapter,
  transferEinstufen,
  zuordnen,
  type Zuordnung,
} from "./skilltaxonomie.ts";

const UNMAPPED: Zuordnung = { art: "unmapped", grund: "keine_daten", text: "x" };

describe("Adapter ohne Daten", () => {
  it("ordnet nichts zu und sagt warum", () => {
    /*
     * Der gegenwärtige Zustand: `skills` und `profile_skills` sind
     * leer. Ein Adapter, der hier raten würde, wäre schlimmer als
     * keiner — man sähe seinen Ergebnissen nicht an, dass sie geraten
     * sind.
     */
    const z = OHNE_SKILLDATEN.zuordnen("Kommissionierung");
    expect(z).toEqual({ art: "unmapped", grund: "keine_daten", text: "Kommissionierung" });
  });
});

describe("Tabellenadapter", () => {
  const adapter = tabellenadapter(
    "probe",
    "esco",
    new Map([["kommissionierung", { kennung: "S1.2.3", bezeichnung: "Kommissionieren" }]]),
  );

  it("ordnet zu, was in der Tabelle steht", () => {
    expect(adapter.zuordnen("Kommissionierung")).toEqual({
      art: "mapped",
      taxonomie: "esco",
      kennung: "S1.2.3",
      bezeichnung: "Kommissionieren",
    });
  });

  it("erfindet keine Kennung für Unbekanntes", () => {
    const z = adapter.zuordnen("Hufeisenschmieden");
    expect(z).not.toBeNull();
    expect(z).toEqual({ art: "unmapped", grund: "kein_treffer", text: "Hufeisenschmieden" });
  });
});

describe("Mehrere Adapter", () => {
  const leer = tabellenadapter("leer", "esco", new Map());
  const voll = tabellenadapter(
    "voll",
    "kldb",
    new Map([["staplerschein", { kennung: "51302", bezeichnung: "Lagerwirtschaft" }]]),
  );

  it("nimmt den ersten Treffer", () => {
    const z = zuordnen([leer, voll], "Staplerschein");
    expect(z.art === "mapped" && z.kennung).toBe("51302");
  });

  it("unterscheidet „keine Daten“ von „kein Treffer“", () => {
    /*
     * Für den Betrieb ist das ein Unterschied: Das eine behebt eine
     * Datenlieferung, das andere nicht.
     */
    expect(zuordnen([OHNE_SKILLDATEN], "irgendwas")).toMatchObject({ grund: "keine_daten" });
    expect(zuordnen([leer], "irgendwas")).toMatchObject({ grund: "kein_treffer" });
  });
});

describe("Einstufung eines Transfers", () => {
  it("macht ohne belegte Erfahrung eine Vermutung daraus", () => {
    /* „Gastronomie" beweist keine Kundenbetreuungskompetenz. */
    const b = transferEinstufen({
      belegt: false,
      identisch: false,
      profilZuordnung: UNMAPPED,
      jobZuordnung: UNMAPPED,
    });
    expect(b.art).toBe("unverified_possible_transfer");
  });

  it("erkennt dieselbe Fähigkeit als direkten Treffer", () => {
    const b = transferEinstufen({
      belegt: true,
      identisch: true,
      profilZuordnung: UNMAPPED,
      jobZuordnung: UNMAPPED,
    });
    expect(b.art).toBe("direct_skill_match");
    expect(b.ueberTaxonomie).toBe(false);
  });

  it("erkennt einen belegten Übergang", () => {
    const b = transferEinstufen({
      belegt: true,
      identisch: false,
      profilZuordnung: UNMAPPED,
      jobZuordnung: UNMAPPED,
    });
    expect(b.art).toBe("transferable_skill_match");
    expect(b.begruendung).toContain("bestätigte Erfahrung");
  });

  it("vermerkt, wenn eine Taxonomie im Spiel war", () => {
    const gemappt: Zuordnung = {
      art: "mapped",
      taxonomie: "esco",
      kennung: "S1",
      bezeichnung: "x",
    };
    const b = transferEinstufen({
      belegt: true,
      identisch: false,
      profilZuordnung: gemappt,
      jobZuordnung: gemappt,
    });
    expect(b.ueberTaxonomie).toBe(true);
  });
});
