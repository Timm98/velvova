import { describe, expect, it } from "vitest";
import { zielTaugt } from "./projektsuche";

/**
 * Die Grenze entscheidet, ob ein Modellaufruf stattfindet. Zu niedrig
 * gesetzt fragt sie bei jedem Halbsatz nach und bekommt eine erfundene
 * Eingrenzung zurück; zu hoch gesetzt bleibt ein brauchbares Ziel
 * liegen und das Vorhaben ohne Suche.
 */
describe("zielTaugt", () => {
  it("lehnt ab, was kein Ziel ist", () => {
    expect(zielTaugt(null)).toBe(false);
    expect(zielTaugt(undefined)).toBe(false);
    expect(zielTaugt("")).toBe(false);
    expect(zielTaugt("Jobsuche")).toBe(false);
  });

  it("zählt nur, was übrig bleibt", () => {
    /* Sonst wäre ein Feld voller Leerzeichen ein gültiges Ziel — und
       das Modell bekäme eine leere Zeichenkette zu deuten. */
    expect(zielTaugt("            ")).toBe(false);
    expect(zielTaugt("   Lager Karlsruhe   ")).toBe(true);
  });

  it("nimmt an, was sich eingrenzen lässt", () => {
    expect(zielTaugt("Projektleitung in Zürich, ab 90k")).toBe(true);
    expect(zielTaugt("Lagerarbeit in Karlsruhe")).toBe(true);
  });
});
