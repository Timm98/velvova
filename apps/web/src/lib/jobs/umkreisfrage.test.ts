import { describe, expect, it } from "vitest";
import { umkreisfrage } from "@/app/api/jobs/deutung/route";

/**
 * Die Rückfrage nach dem Umkreis — ohne Modell.
 *
 * Sie ist der Fall, der den schnellen Weg stumm gemacht hat:
 * „karlsruhe" versteht der Regelabgleich vollständig, und genau
 * deshalb endete die Anfrage ohne Rückfrage. Die Person gab einen Ort
 * ein und bekam nur diesen Ort — ohne Umkreis, ohne gefragt zu werden.
 */
describe("Wann nach dem Umkreis gefragt wird", () => {
  it("fragt bei einer Stadt ohne Umkreis", () => {
    const f = umkreisfrage({ ort: "karlsruhe" }, {});
    expect(f).toContain("30 km um Karlsruhe");
    expect(f).toContain("?");
  });

  it("fragt nicht, wenn der Umkreis mitkommt", () => {
    expect(umkreisfrage({ ort: "karlsruhe", umkreisKm: 40 }, {})).toBeNull();
  });

  it("fragt nicht, wenn schon einer eingestellt ist", () => {
    /* Eine Frage zu etwas, das schon gilt, liest sich wie ein System,
       das nicht mitbekommt, was gerade passiert ist. */
    expect(umkreisfrage({ ort: "karlsruhe" }, { umkreisKm: "25" })).toBeNull();
  });

  it("fragt nicht bei einem Bundesland", () => {
    /* „30 km um Bayern" ist keine Frage, sondern ein Missverständnis. */
    for (const region of ["bayern", "Nordrhein-Westfalen", "NRW", "Deutschland", "Ruhrgebiet"]) {
      expect(umkreisfrage({ ort: region }, {}), region).toBeNull();
    }
  });

  it("fragt nicht ohne Ort", () => {
    expect(umkreisfrage({}, {})).toBeNull();
    expect(umkreisfrage({ ort: "  " }, {})).toBeNull();
  });

  it("unterscheidet Bayern von Bayreuth", () => {
    expect(umkreisfrage({ ort: "bayreuth" }, {})).toContain("Bayreuth");
  });
});
