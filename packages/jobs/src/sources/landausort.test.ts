import { describe, expect, it } from "vitest";
import { landAusOrt } from "./landausort.ts";

describe("Das Land aus einer Ortsangabe", () => {
  it("liest ausgeschriebene Ländernamen", () => {
    expect(landAusOrt("Berlin, Germany")).toBe("DE");
    expect(landAusOrt("London, United Kingdom")).toBe("GB");
    expect(landAusOrt("Wien, Österreich")).toBe("AT");
    expect(landAusOrt("Zürich, Switzerland")).toBe("CH");
    expect(landAusOrt("Toronto, Canada")).toBe("CA");
  });

  it("liest das Kürzel am Ende", () => {
    expect(landAusOrt("Watford, England, GB")).toBe("GB");
    expect(landAusOrt("Toronto, ON, CA")).toBe("CA");
  });

  it("verwechselt eine Region nicht mit einem Land", () => {
    /* „NRW" ist zwei Grossbuchstaben am Ende und trotzdem kein Land. */
    expect(landAusOrt("Aachen, NRW")).toBeNull();
  });

  it("rät nicht aus einem blossen Stadtnamen", () => {
    /*
     * Es gibt ein Berlin in Maryland. Aus einem Stadtnamen ein Land
     * zu schliessen ist genau die Vermutung, die den Fehler in
     * `arbeitnow.ts` erzeugt hat — dort ergaben beide Zweige eines
     * Ternärs „DE".
     */
    expect(landAusOrt("Berlin")).toBeNull();
    expect(landAusOrt("Hamburg")).toBeNull();
  });

  it("kommt mit Leerem zurecht", () => {
    expect(landAusOrt(null)).toBeNull();
    expect(landAusOrt("")).toBeNull();
    expect(landAusOrt(" ")).toBeNull();
  });

  it("nimmt England und Schottland als Grossbritannien", () => {
    expect(landAusOrt("Edinburgh, Scotland")).toBe("GB");
    expect(landAusOrt("Manchester, England")).toBe("GB");
  });
});

describe("Mehrere Länder in einer Angabe", () => {
  it("nimmt das erste im Text, nicht das erste in unserer Liste", () => {
    /*
     * „Deutschland, Österreich, Schweiz und Italien" ist eine Anzeige
     * für den deutschsprachigen Raum. Die erste Nennung ist der
     * Schwerpunkt — die Reihenfolge unserer Liste wäre willkürlich
     * und ergab hier „AT".
     */
    expect(landAusOrt("Deutschland, Österreich, Schweiz und Italien")).toBe("DE");
    expect(landAusOrt("Österreich und Deutschland")).toBe("AT");
  });
});

