import { describe, expect, it } from "vitest";
import {
  type Bedingung,
  bedingungBewerten,
  bedingungenAendern,
  bedingungsbilanz,
} from "./bedingungen.ts";

const wochenende: Bedingung = {
  schluessel: "freie-wochenenden",
  text: "Freie Wochenenden",
  rang: "muss",
  herkunft: "gesagt",
  bestaetigt: true,
};
const radius: Bedingung = {
  schluessel: "radius",
  text: "Höchstens 30 Minuten Weg",
  rang: "muss",
  herkunft: "gesagt",
  bestaetigt: true,
};
const tagschicht: Bedingung = {
  schluessel: "tagschicht",
  text: "Lieber Tagschicht",
  rang: "wunsch",
  herkunft: "gesagt",
  bestaetigt: true,
};

describe("Bedingungen bewerten (Prüffall B03)", () => {
  it("macht aus einer fehlenden Angabe keine Verletzung", () => {
    /*
     * „Wochenenddienste sind nicht genannt" heisst weder, dass es sie
     * gibt, noch, dass es keine gibt.
     */
    const u = bedingungBewerten(wochenende, "unbekannt");
    expect(u.schliesstAus).toBe(false);
    expect(u.satz).toContain("steht nicht in der Anzeige");
  });

  it("schliesst bei einem bestätigten verletzten Muss aus", () => {
    expect(bedingungBewerten(wochenende, "verletzt").schliesstAus).toBe(true);
  });

  it("schliesst nicht wegen eines Wunsches aus", () => {
    const u = bedingungBewerten(tagschicht, "verletzt");
    expect(u.schliesstAus).toBe(false);
    expect(u.satz).toContain("Wunsch");
  });

  it("schliesst nicht wegen einer unbestätigten Vermutung aus", () => {
    /*
     * Aus dem Gespräch verdichtete Bedingungen sind Vermutungen über
     * die Person, bis sie zustimmt.
     */
    const vermutet: Bedingung = { ...wochenende, herkunft: "verdichtet", bestaetigt: false };
    expect(bedingungBewerten(vermutet, "verletzt").schliesstAus).toBe(false);
  });
});

describe("Bilanz", () => {
  it("lässt einen Vorteil den Ausschluss nicht ausgleichen", () => {
    const b = bedingungsbilanz([
      bedingungBewerten(wochenende, "verletzt"),
      bedingungBewerten(radius, "erfuellt"),
      bedingungBewerten(tagschicht, "erfuellt"),
    ]);
    expect(b.trotzVorteilenAusgeschlossen).toBe(true);
    expect(b.ausschluesse).toHaveLength(1);
    /* Der erfüllte Rest verschwindet nicht — er zählt nur nicht dagegen. */
    expect(b.urteile.filter((u) => u.befund === "erfuellt")).toHaveLength(2);
  });

  it("führt offene Muss-Fragen getrennt von Ausschlüssen", () => {
    const b = bedingungsbilanz([
      bedingungBewerten(wochenende, "unbekannt"),
      bedingungBewerten(radius, "erfuellt"),
    ]);
    expect(b.ausschluesse).toHaveLength(0);
    expect(b.offeneMuss.map((u) => u.bedingung.schluessel)).toEqual(["freie-wochenenden"]);
  });
});

describe("Bedingungen ändern (Prüffall B06)", () => {
  it("erhält alle anderen Bedingungen, wenn nur der Radius wächst", () => {
    const vorher = [wochenende, radius, tagschicht];
    const p = bedingungenAendern(vorher, "radius", { text: "Höchstens 45 Minuten Weg" });

    expect(p.geaendert).toBe("radius");
    expect(p.unveraendert).toEqual(["freie-wochenenden", "tagschicht"]);
    expect(p.nachher).toHaveLength(3);

    /* Nicht nur inhaltlich gleich — dieselben Objekte. Ein Neuaufbau,
       bei dem eine Zeile fehlt, sieht aus wie einer, in dem nie eine
       stand; Objektgleichheit schliesst das aus. */
    expect(p.nachher[0]).toBe(wochenende);
    expect(p.nachher[2]).toBe(tagschicht);
    expect(p.nachher[1]).not.toBe(radius);
    expect(p.nachher[1]?.text).toBe("Höchstens 45 Minuten Weg");
  });

  it("legt bei unbekanntem Schlüssel nichts Neues an", () => {
    /*
     * Sonst erzeugt ein Tippfehler eine zweite Zeile, die alte bleibt
     * stehen, und beide gelten.
     */
    const vorher = [wochenende, radius];
    const p = bedingungenAendern(vorher, "radius-tippfehler", { text: "irgendwas" });
    expect(p.geaendert).toBeNull();
    expect(p.nachher).toBe(vorher);
  });

  it("meldet keine Änderung, wenn sich nichts ändert", () => {
    const p = bedingungenAendern([radius], "radius", { text: radius.text });
    expect(p.geaendert).toBeNull();
    expect(p.felder).toEqual([]);
  });

  it("nennt die geänderten Felder", () => {
    const p = bedingungenAendern([radius], "radius", { rang: "wunsch" });
    expect(p.felder).toEqual(["rang"]);
  });
});
