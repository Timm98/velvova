import { describe, expect, it } from "vitest";
import { arbeitgeberartRaten, hauptgruppe } from "./quellen.ts";

/*
 * Geprüft wird, was ohne Datenbank prüfbar ist: die beiden
 * Entscheidungen, die aus Rohdaten eine Aussage machen. Die Abfragen
 * selbst sind Drizzle und werden vom Typprüfer getragen.
 */

describe("Die Berufshauptgruppe", () => {
  it("nimmt die ersten zwei Ziffern", () => {
    /*
     * `71304` und `71399` sind verschiedene Tätigkeiten in derselben
     * Gruppe. Für die Frage „beschäftigt dieser Arbeitgeber Menschen
     * wie dich" ist die Gruppe die richtige Ebene — auf voller Länge
     * fände man fast nie einen Treffer.
     */
    expect(hauptgruppe("71304")).toBe("71");
    expect(hauptgruppe("71399")).toBe("71");
    expect(hauptgruppe("71")).toBe("71");
  });

  it("gibt null zurück, wenn keine Kennung dasteht", () => {
    for (const wert of [null, undefined, "", "  ", "7"]) {
      expect(hauptgruppe(wert), String(wert)).toBeNull();
    }
  });
});

describe("Öffentlich oder privat", () => {
  it("erkennt die Arbeitgeber, um die es in diesem System geht", () => {
    for (const name of [
      "Landratsamt Reutlingen",
      "Landkreis Tübingen",
      "Stadtverwaltung Metzingen",
      "Universitätsklinikum Tübingen",
      "Hochschule Reutlingen",
      "Kreissparkasse Reutlingen",
      "Stadtwerke Reutlingen GmbH",
    ]) {
      expect(arbeitgeberartRaten(name, null), name).toBe("oeffentlich");
    }
  });

  it("nimmt auch die Branche als Hinweis", () => {
    expect(arbeitgeberartRaten("Verwaltung Süd", "öffentliche verwaltung")).toBe("oeffentlich");
  });

  it("hält 'Verwaltung' allein nicht für öffentlich", () => {
    /* Hausverwaltung und Vermögensverwaltung sind privat. */
    expect(arbeitgeberartRaten("Hausverwaltung Süd", "immobilien")).toBe("privat");
    expect(arbeitgeberartRaten("Vermögensverwaltung Keller", null)).toBe("privat");
  });

  it("hält eine gewöhnliche Firma für privat", () => {
    for (const name of ["Bosch GmbH", "Müller Logistik", "Frontline Recruitment Group"]) {
      expect(arbeitgeberartRaten(name, "industrie"), name).toBe("privat");
    }
  });

  it("irrt in die richtige Richtung", () => {
    /*
     * Es gibt keine Spalte dafür, also wird geraten. Wer fälschlich
     * als öffentlich gilt, bekommt eine vorsichtigere Nachricht als
     * nötig — eine Anfrage nach geplanten Ausschreibungen statt einer
     * Initiativbewerbung. Wer fälschlich als privat gilt, bekommt die
     * falsche.
     *
     * Deshalb ist die Liste grosszügig, und dieser Fall hält fest,
     * dass „Stadt" darin vorkommt, obwohl es auch in Firmennamen
     * steht.
     */
    expect(arbeitgeberartRaten("Stadt Reutlingen", null)).toBe("oeffentlich");
  });
});
