import { describe, expect, it } from "vitest";
import { besteProbe, zulaessigeProben, type Aufgabenprobe } from "./probenauswahl.ts";

const HEIZUNG: Aufgabenprobe = { id: "a", kldbHauptgruppe: "34", art: "reihenfolge" };
const FAHREN: Aufgabenprobe = { id: "b", kldbHauptgruppe: "52", art: "reihenfolge" };
const NEUTRAL: Aufgabenprobe = { id: "c", kldbHauptgruppe: null, art: "text" };

describe("Probenauswahl", () => {
  it("zeigt einem Fahrer keine Heizungsaufgabe", () => {
    /*
     * Der Fall aus der Vorgabe, wörtlich: Bei einer
     * Lieferfahrer-Stelle darf keine Aufgabe über Heizungsdruck oder
     * Warmwasser erscheinen.
     */
    expect(besteProbe([HEIZUNG], "52")).toBeNull();
    expect(besteProbe([HEIZUNG, FAHREN], "52")!.id).toBe("b");
  });

  it("gibt lieber nichts als etwas Falsches", () => {
    /*
     * Eine Aufgabe aus einem fremden Beruf ist keine Hilfe, sondern
     * eine falsche Auskunft über die Stelle.
     */
    expect(besteProbe([HEIZUNG], "81")).toBeNull();
    expect(zulaessigeProben([HEIZUNG], "81")).toEqual([]);
  });

  it("lässt berufsneutrale Aufgaben überall zu", () => {
    expect(besteProbe([NEUTRAL], "52")!.id).toBe("c");
  });

  it("zieht die berufsspezifische der neutralen vor", () => {
    expect(besteProbe([NEUTRAL, FAHREN], "52")!.id).toBe("b");
  });

  it("wählt ohne bekannte Richtung aus allen", () => {
    /* Dann gibt es nichts, wogegen eine Aufgabe verstossen könnte. */
    expect(zulaessigeProben([HEIZUNG, FAHREN, NEUTRAL], null)).toHaveLength(3);
    expect(besteProbe([HEIZUNG, FAHREN, NEUTRAL], null)).not.toBeNull();
  });

  it("wählt wiederholbar", () => {
    /* Ohne feste Reihenfolge liesse sich ein Fehlschlag nicht wiederholen. */
    const a = besteProbe([FAHREN, HEIZUNG], null)!.id;
    const b = besteProbe([HEIZUNG, FAHREN], null)!.id;
    expect(a).toBe(b);
  });
});
