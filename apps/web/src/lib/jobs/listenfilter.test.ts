import { describe, expect, it } from "vitest";
import { FILTER_SCHLUESSEL, nurFilter } from "./listenfilter.ts";

describe("Was als Filter gespeichert wird", () => {
  it("nimmt die Filter", () => {
    expect(nurFilter({ ort: "karlsruhe", gehaltAb: "45000", remote: "hybrid" })).toEqual({
      ort: "karlsruhe",
      gehaltAb: "45000",
      remote: "hybrid",
    });
  });

  it("lässt die geöffnete Stelle draussen", () => {
    /*
     * `job` ist die Stelle, die gerade rechts steht. Sie zu merken
     * und beim nächsten Besuch wiederherzustellen hiesse: Man kommt
     * auf die Seite, und die Anzeige von gestern ist aufgeschlagen.
     */
    expect(nurFilter({ ort: "karlsruhe", job: "abc-123" })).toEqual({ ort: "karlsruhe" });
  });

  it("lässt die Scrolltiefe und die Sortierung draussen", () => {
    /*
     * `anzahl=150` beim nächsten Besuch hiesse: 150 Zeilen bauen,
     * bevor irgendetwas zu sehen ist — für einen Stand, den niemand
     * eingestellt, sondern erscrollt hat.
     */
    expect(nurFilter({ anzahl: "150", sort: "newest", seite: "3" })).toEqual({});
  });

  it("lässt Leeres weg", () => {
    expect(nurFilter({ ort: "", gehaltAb: undefined, q: "lager" })).toEqual({ q: "lager" });
  });

  it("kennt jeden Schlüssel, den die Suche setzen kann", () => {
    /*
     * Die Liste ist geschlossen. Ein neuer Filter, der hier fehlt,
     * wird gesetzt und nie gemerkt — und niemand merkt es, weil die
     * Liste dann einfach ungefiltert aussieht.
     */
    for (const k of ["ort", "umkreisKm", "gehaltAb", "remote", "contract", "arbeitszeit", "schicht", "salary", "q", "nicht"]) {
      expect(FILTER_SCHLUESSEL).toContain(k);
    }
  });
});
