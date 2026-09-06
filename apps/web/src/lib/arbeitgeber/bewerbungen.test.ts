import { describe, expect, it } from "vitest";

/**
 * Die Reihenfolge der Bewerbungen beim Arbeitgeber.
 *
 * ── Was hier geschützt wird ───────────────────────────────────
 *
 * Das Passungsband stammt aus dem privaten Profil des Menschen. Wer es
 * nicht ausdrücklich freigegeben hat, darf dadurch KEINEN Nachteil
 * haben — sonst wäre die Einwilligung keine, sondern eine Erpressung
 * mit Rangplätzen.
 */

const BANDRANG: Record<string, number> = { high: 0, medium: 1, exploratory: 2, insufficient: 3 };

/* Dieselbe Regel wie in `ladeBewerbungen` — hier prüfbar ohne Datenbank. */
function sortieren<T extends { sharedProfile: Record<string, unknown>; createdAt: Date }>(zeilen: T[]): T[] {
  return [...zeilen].sort((a, b) => {
    const ba = (a.sharedProfile as { passungsband?: string })?.passungsband;
    const bb = (b.sharedProfile as { passungsband?: string })?.passungsband;
    if (ba && bb) return (BANDRANG[ba] ?? 9) - (BANDRANG[bb] ?? 9);
    if (ba) return -1;
    if (bb) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

const kandidat = (name: string, band: string | null, tag: number) => ({
  name,
  sharedProfile: band ? { passungsband: band } : {},
  createdAt: new Date(2026, 0, tag),
});

describe("Geteilte Passung ordnet, Schweigen benachteiligt nicht", () => {
  it("stellt gut passende vor teilweise passende", () => {
    const r = sortieren([kandidat("A", "medium", 1), kandidat("B", "high", 2)]);
    expect(r.map((x) => x.name)).toEqual(["B", "A"]);
  });

  it("ordnet ohne Freigabe nach Eingang — neueste zuerst", () => {
    const r = sortieren([kandidat("alt", null, 1), kandidat("neu", null, 5)]);
    expect(r.map((x) => x.name)).toEqual(["neu", "alt"]);
  });

  it("mischt beide Gruppen nicht durcheinander", () => {
    /*
     * Wer geteilt hat, steht in seiner eigenen Ordnung; wer
     * geschwiegen hat, in seiner. Ein Schweigender rutscht nicht
     * zwischen zwei Teilende — sonst liesse sich aus der Position
     * ablesen, wer nichts gesagt hat.
     */
    const r = sortieren([
      kandidat("stumm-neu", null, 9),
      kandidat("geteilt-schwach", "exploratory", 1),
      kandidat("stumm-alt", null, 2),
      kandidat("geteilt-stark", "high", 3),
    ]);
    expect(r.map((x) => x.name)).toEqual([
      "geteilt-stark",
      "geteilt-schwach",
      "stumm-neu",
      "stumm-alt",
    ]);
  });

  it("gibt einem unbekannten Band den letzten Platz seiner Gruppe", () => {
    const r = sortieren([kandidat("unbekannt", "gibtsnicht", 1), kandidat("gut", "high", 2)]);
    expect(r[0]!.name).toBe("gut");
  });
});
