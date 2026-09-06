import { describe, expect, it } from "vitest";
import { materielleFassung, type MaterielleAngaben } from "./materiellefassung.ts";

const BASIS: MaterielleAngaben = {
  titel: "Lagerist (m/w/d)",
  arbeitgeber: "Muster GmbH",
  ort: "Karlsruhe",
  arbeitsmodell: "onsite",
  vertragsform: "vollzeit",
  wochenstunden: 40,
  gehaltMin: 32_000,
  gehaltMax: 38_000,
  gehaltWaehrung: "EUR",
  gehaltZeitraum: "year",
  gehaltAngegeben: true,
};

describe("Materielle Fassung", () => {
  it("bleibt bei kosmetischen Unterschieden gleich", () => {
    expect(materielleFassung({ ...BASIS, titel: "  Lagerist   (m/w/d) " })).toBe(materielleFassung(BASIS));
  });

  it("ändert sich beim Gehalt", () => {
    expect(materielleFassung({ ...BASIS, gehaltMin: 36_000 })).not.toBe(materielleFassung(BASIS));
  });

  it("ändert sich beim Vertrag", () => {
    expect(materielleFassung({ ...BASIS, vertragsform: "teilzeit" })).not.toBe(materielleFassung(BASIS));
  });

  it("ändert sich beim Arbeitsort", () => {
    expect(materielleFassung({ ...BASIS, ort: "Stuttgart" })).not.toBe(materielleFassung(BASIS));
  });

  it("hängt nicht von der Schlüsselreihenfolge ab", () => {
    const andersHerum: MaterielleAngaben = {
      gehaltAngegeben: true,
      gehaltZeitraum: "year",
      gehaltWaehrung: "EUR",
      gehaltMax: 38_000,
      gehaltMin: 32_000,
      wochenstunden: 40,
      vertragsform: "vollzeit",
      arbeitsmodell: "onsite",
      ort: "Karlsruhe",
      arbeitgeber: "Muster GmbH",
      titel: "Lagerist (m/w/d)",
    };
    expect(materielleFassung(andersHerum)).toBe(materielleFassung(BASIS));
  });
});
