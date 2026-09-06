import { describe, expect, it } from "vitest";
import { deutungZusammenfuehren } from "./deutungsmerge.ts";

describe("Regeln und Modell zusammenführen", () => {
  it("nimmt das `q` der Regeln weg, wenn das Modell den Rest untergebracht hat", () => {
    /*
     * Der Fehler, der zweimal aufgetreten ist: „bayern" stand als
     * Plättchen doppelt da — einmal als Suchwort aus den Regeln,
     * einmal als Ort aus dem Modell.
     */
    const f = deutungZusammenfuehren({
      regeln: { q: "bayern" },
      modell: { ort: "bayern" },
      entfernen: [],
    });
    expect(f).toEqual({ ort: "bayern" });
  });

  it("behält `q`, wenn das Modell nichts gefunden hat", () => {
    const f = deutungZusammenfuehren({
      regeln: { q: "kommissionierer" },
      modell: {},
      entfernen: [],
    });
    expect(f).toEqual({ q: "kommissionierer" });
  });

  it("verliert das Suchwort nicht, wenn das Modell es selbst setzt", () => {
    /* „Lagerhelfer in Bayern" — der Ort ist erkannt, der Beruf bleibt. */
    const f = deutungZusammenfuehren({
      regeln: { q: "lagerhelfer bayern" },
      modell: { ort: "bayern", q: "lagerhelfer" },
      entfernen: [],
    });
    expect(f).toEqual({ ort: "bayern", q: "lagerhelfer" });
  });

  it("lässt die Regeln über das Modell gewinnen", () => {
    /* „ab 45.000 €" ist eine Zahl, kein Deutungsproblem. */
    const f = deutungZusammenfuehren({
      regeln: { gehaltAb: 45000 },
      modell: { gehaltAb: 45, ort: "karlsruhe" },
      entfernen: [],
    });
    expect(f.gehaltAb).toBe(45000);
    expect(f.ort).toBe("karlsruhe");
  });

  it("entfernt zuletzt", () => {
    const f = deutungZusammenfuehren({
      regeln: {},
      modell: { ort: "karlsruhe" },
      entfernen: ["ort"],
    });
    expect(f).toEqual({});
  });

  it("übernimmt keine leeren Werte", () => {
    const f = deutungZusammenfuehren({
      regeln: { ort: "" },
      modell: { q: null, remote: undefined, contract: "permanent" },
      entfernen: [],
    });
    expect(f).toEqual({ contract: "permanent" });
  });
});

describe("Zeit ist keine Entfernung", () => {
  it("wirft einen Umkreis weg, von dem niemand gesprochen hat", () => {
    /*
     * „Will höchstens 2 Stunden Auto fahren" ergab `pendelzeit=120`
     * UND `umkreisKm=120` — das Modell hatte richtig umgerechnet und
     * die Zahl danach in beide Felder gelegt.
     */
    const f = deutungZusammenfuehren({
      eingabe: "will höchstens 2 stunden auto fahren",
      regeln: { pendelzeit: 120 },
      modell: { pendelzeit: 120, umkreisKm: 120 },
      entfernen: [],
    });
    expect(f).toEqual({ pendelzeit: 120 });
  });

  it("lässt den Umkreis stehen, wenn er im Satz vorkommt", () => {
    const f = deutungZusammenfuehren({
      eingabe: "30 km umkreis um karlsruhe",
      regeln: {},
      modell: { umkreisKm: 30, ort: "karlsruhe" },
      entfernen: [],
    });
    expect(f.umkreisKm).toBe(30);
  });

  it("lässt ihn stehen, wenn die Regeln ihn gefunden haben", () => {
    /* Der Regelabgleich hat eine Zahl mit Einheit gelesen — daran
       gibt es nichts zu deuten. */
    const f = deutungZusammenfuehren({
      eingabe: "25 kilometer",
      regeln: { umkreisKm: 25 },
      modell: {},
      entfernen: [],
    });
    expect(f.umkreisKm).toBe(25);
  });
});
