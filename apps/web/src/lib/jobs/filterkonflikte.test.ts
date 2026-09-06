import { describe, expect, it } from "vitest";
import {
  darfEntfernen,
  filterkonflikte,
  gepruefteEntfernungen,
} from "./filterkonflikte.ts";

describe("Löschschutz", () => {
  it("lässt löschen, wenn die Person etwas wegnimmt", () => {
    for (const satz of [
      "egal wo",
      "ohne Gehaltsfilter",
      "keine Vorgabe mehr beim Ort",
      "nicht mehr nur Teilzeit",
      "den Umkreis bitte löschen",
      "überall",
    ]) {
      expect(darfEntfernen(satz), satz).toBe(true);
    }
  });

  it("löscht nichts, wenn die Person nur etwas Neues sagt", () => {
    /*
     * Der Fehler, den das behebt: Nach zwei, drei Eingaben verschwand
     * ein Filter, den niemand weggenommen hatte. Das Modell hielt die
     * neue Eingabe für eine Korrektur der alten.
     */
    for (const satz of ["karlsruhe", "ab 45.000 €", "Lagerhelfer", "Teilzeit"]) {
      expect(darfEntfernen(satz), satz).toBe(false);
    }
  });

  it("verwirft die Löschwünsche des Modells ohne Wegnahme-Wort", () => {
    expect(gepruefteEntfernungen("karlsruhe", [], ["gehaltAb", "remote"])).toEqual([]);
  });

  it("lässt sie durch, wenn die Eingabe danach klingt", () => {
    expect(gepruefteEntfernungen("ohne Gehaltsfilter", [], ["gehaltAb"])).toEqual(["gehaltAb"]);
  });

  it("vertraut dem Regelabgleich immer", () => {
    /* Er löscht nur nach demselben Muster — ihn hier ein zweites Mal
       zu prüfen hiesse, seinem eigenen Treffer zu misstrauen. */
    expect(gepruefteEntfernungen("karlsruhe", ["ortGenau"], [])).toEqual(["ortGenau"]);
  });
});

describe("Filter, die einander widersprechen", () => {
  it("erkennt Umkreis neben vollständig remote", () => {
    const k = filterkonflikte({ remote: "remote", umkreisKm: "30" });
    expect(k).toHaveLength(1);
    expect(k[0]!.felder).toEqual(["remote", "umkreisKm"]);
    expect(k[0]!.frage).toContain("?");
  });

  it("erkennt einen Umkreis um ein Bundesland", () => {
    expect(filterkonflikte({ ort: "Bayern", umkreisKm: "30" })).toHaveLength(1);
    /* Um eine Stadt ist er richtig. */
    expect(filterkonflikte({ ort: "Karlsruhe", umkreisKm: "30" })).toHaveLength(0);
  });

  it("erkennt dasselbe Wort in Suche und Ausschluss", () => {
    const k = filterkonflikte({ q: "vertrieb aussendienst", nicht: "vertrieb" });
    expect(k[0]!.felder).toEqual(["q", "nicht"]);
    /* Er wiegt am schwersten: die Liste bleibt sonst garantiert leer. */
    expect(k[0]!.gewicht).toBeGreaterThan(3);
  });

  it("erkennt ein Praktikum mit Vollzeitgehalt", () => {
    expect(filterkonflikte({ contract: "internship", gehaltAb: "45000" })).toHaveLength(1);
  });

  it("erkennt Teilzeit mit einem Gehalt, das Vollzeit voraussetzt", () => {
    expect(filterkonflikte({ arbeitszeit: "teilzeit", gehaltAb: "60000" })).toHaveLength(1);
    expect(filterkonflikte({ arbeitszeit: "teilzeit", gehaltAb: "30000" })).toHaveLength(0);
  });

  it("schweigt bei Filtern, die zusammenpassen", () => {
    expect(
      filterkonflikte({ ort: "Karlsruhe", umkreisKm: "30", gehaltAb: "45000", remote: "hybrid" }),
    ).toHaveLength(0);
  });

  it("stellt den schwersten Widerspruch nach vorn", () => {
    const k = filterkonflikte({
      q: "vertrieb",
      nicht: "vertrieb",
      remote: "remote",
      umkreisKm: "30",
    });
    expect(k[0]!.felder).toEqual(["q", "nicht"]);
  });
});
