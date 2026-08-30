import { describe, expect, it } from "vitest";
import { plural, pluralVerb } from "./plural.ts";

describe("Pluralformen", () => {
  it("nimmt bei eins die Einzahl", () => {
    expect(plural(1, "Gespräch", "Gespräche")).toBe("1 Gespräch");
  });

  it("nimmt sonst die Mehrzahl", () => {
    expect(plural(13, "Bewerbung", "Bewerbungen")).toBe("13 Bewerbungen");
  });

  it("nimmt bei null die Mehrzahl", () => {
    // "0 Gespräch" ist im Deutschen falsch, auch wenn die Logik es
    // nahelegen könnte.
    expect(plural(0, "Gespräch", "Gespräche")).toBe("0 Gespräche");
  });

  it("beugt auch das Verb", () => {
    expect(pluralVerb(1, "fehlt", "fehlen")).toBe("fehlt");
    expect(pluralVerb(2, "fehlt", "fehlen")).toBe("fehlen");
    expect(pluralVerb(0, "fehlt", "fehlen")).toBe("fehlen");
  });
});
