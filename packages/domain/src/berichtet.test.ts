import { describe, expect, it } from "vitest";
import { berichteteAussagen, MIN_SPANNE_TAGE, type Profilnennung } from "./berichtet.ts";

const TAG = 24 * 60 * 60 * 1000;
const START = new Date("2026-01-01T10:00:00Z").getTime();
const tag = (n: number) => new Date(START + n * TAG);

function n(p: Partial<Profilnennung> & { erfasstAm: Date }): Profilnennung {
  return { dimension: "teamarbeit", wert: 0.9, herkunft: "gespraech", ...p };
}

describe("berichteteAussagen", () => {
  it("erkennt dieselbe Aussage über Monate", () => {
    const a = berichteteAussagen([
      n({ erfasstAm: tag(0) }),
      n({ erfasstAm: tag(45), herkunft: "selbstauskunft" }),
      n({ erfasstAm: tag(120), herkunft: "probe" }),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]!.nennungen).toBe(3);
    expect(a[0]!.spanneTage).toBe(120);
    expect(a[0]!.aussage).toContain("eng im Team");
  });

  it("zählt dasselbe Gespräch am selben Tag nur einmal", () => {
    /* Wer in einem Gespräch dreimal dasselbe sagt, hat es einmal gesagt. */
    const a = berichteteAussagen([
      n({ erfasstAm: tag(0) }),
      n({ erfasstAm: tag(0) }),
      n({ erfasstAm: tag(0) }),
      n({ erfasstAm: tag(200) }),
    ]);
    expect(a).toEqual([]);
  });

  it("schweigt unterhalb der Frist", () => {
    const a = berichteteAussagen([
      n({ erfasstAm: tag(0) }),
      n({ erfasstAm: tag(10), herkunft: "probe" }),
      n({ erfasstAm: tag(MIN_SPANNE_TAGE - 1), herkunft: "selbstauskunft" }),
    ]);
    expect(a).toEqual([]);
  });

  it("schweigt, wenn jemand die Seite gewechselt hat", () => {
    /*
     * Eine Veränderung ist eine wichtige Auskunft — aber kein Beleg für
     * eine gleichbleibende Eigenschaft. Sie darf nicht zum stärksten
     * Beleg im Profil werden.
     */
    const a = berichteteAussagen([
      n({ erfasstAm: tag(0), wert: 0.9 }),
      n({ erfasstAm: tag(90), wert: 0.9, herkunft: "probe" }),
      n({ erfasstAm: tag(180), wert: 0.1, herkunft: "selbstauskunft" }),
    ]);
    expect(a).toEqual([]);
  });

  it("schweigt bei einer Aussage nahe der Mitte", () => {
    const a = berichteteAussagen([
      n({ erfasstAm: tag(0), wert: 0.55 }),
      n({ erfasstAm: tag(90), wert: 0.58, herkunft: "probe" }),
      n({ erfasstAm: tag(180), wert: 0.52, herkunft: "selbstauskunft" }),
    ]);
    expect(a).toEqual([]);
  });

  it("kennt keine erfundene Dimension", () => {
    const a = berichteteAussagen([
      n({ erfasstAm: tag(0), dimension: "quatsch" }),
      n({ erfasstAm: tag(90), dimension: "quatsch", herkunft: "probe" }),
      n({ erfasstAm: tag(180), dimension: "quatsch", herkunft: "selbstauskunft" }),
    ]);
    expect(a).toEqual([]);
  });
});
