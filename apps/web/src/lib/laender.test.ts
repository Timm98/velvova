import { describe, expect, it } from "vitest";
import { istLandescode, LAENDERCODES, laender, landName } from "./laender";

describe("Länderliste", () => {
  it("umfasst die Welt und nicht nur den deutschsprachigen Raum", () => {
    expect(LAENDERCODES.length).toBeGreaterThan(200);
    for (const c of ["DE", "AT", "CH", "US", "JP", "BR", "ZA", "IN", "AU", "NG"]) {
      expect(LAENDERCODES).toContain(c);
    }
  });

  it("enthält keine Sondercodes", () => {
    for (const c of ["EU", "UN", "XA", "ZZ", "QO"]) {
      expect(LAENDERCODES).not.toContain(c);
    }
  });

  it("benennt Länder auf Deutsch", () => {
    expect(landName("FR", "de")).toBe("Frankreich");
    expect(landName("IT", "de")).toBe("Italien");
  });

  it("benennt sie auf Englisch, wenn die Oberfläche englisch ist", () => {
    expect(landName("DE", "en")).toBe("Germany");
  });

  it("sortiert nach Namen und nicht nach Codepunkt", () => {
    const namen = laender("de").map((l) => l.name);
    const oesterreich = namen.indexOf("Österreich");
    const zypern = namen.indexOf("Zypern");
    expect(oesterreich).toBeGreaterThan(-1);
    /* Ohne `localeCompare` stünde Österreich hinter Zypern. */
    expect(oesterreich).toBeLessThan(zypern);
  });

  it("erkennt gültige Codes", () => {
    expect(istLandescode("de")).toBe(true);
    expect(istLandescode("DE")).toBe(true);
    expect(istLandescode("XX")).toBe(false);
    expect(istLandescode(42)).toBe(false);
  });
});
