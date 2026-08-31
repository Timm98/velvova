import { beforeEach, describe, expect, it } from "vitest";
import { _zurücksetzen, prüfeGrenze } from "./rate-limit.ts";

const GRENZE = { anzahl: 3, fensterMs: 60_000 };

describe("Begrenzung", () => {
  beforeEach(() => _zurücksetzen());

  it("lässt bis zur Grenze durch und dann nicht mehr", () => {
    const t = 1_000_000;
    for (let i = 1; i <= 3; i++) {
      expect(prüfeGrenze("a", GRENZE, t).erlaubt, `Versuch ${i}`).toBe(true);
    }
    expect(prüfeGrenze("a", GRENZE, t).erlaubt, "der vierte nicht mehr").toBe(false);
  });

  it("zählt Absender getrennt", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) prüfeGrenze("a", GRENZE, t);
    expect(prüfeGrenze("b", GRENZE, t).erlaubt, "ein anderer Absender ist unberührt").toBe(true);
  });

  it("öffnet nach dem Fenster wieder", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) prüfeGrenze("a", GRENZE, t);
    expect(prüfeGrenze("a", GRENZE, t + 60_001).erlaubt).toBe(true);
  });

  it("sagt, wie lange es dauert", () => {
    const t = 1_000_000;
    prüfeGrenze("a", GRENZE, t);
    const e = prüfeGrenze("a", GRENZE, t + 30_000);
    expect(e.zurücksetzenIn).toBeGreaterThan(0);
    expect(e.zurücksetzenIn).toBeLessThanOrEqual(30);
  });
});
