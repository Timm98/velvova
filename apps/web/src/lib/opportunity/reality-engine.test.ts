import { describe, expect, it } from "vitest";
import { computeFunnel, type FunnelInput } from "./reality-engine.ts";
import type { ScoredJob } from "@/lib/matching";

/**
 * Der Trichter ist die Stelle, an der das Produkt aufhört, mit einer
 * grossen Zahl zu beeindrucken. Deshalb sind hier die Gegenproben
 * wichtiger als die Erfolgsfälle: eine Zahl, die grösser aussieht als
 * die Wirklichkeit, ist genau der Fehler, den er verhindern soll.
 */

const JETZT = new Date("2026-08-30T12:00:00Z");

function job(over: Partial<{
  expiresAt: Date | null;
  lastLinkCheckOk: boolean | null;
  blocked: boolean;
  band: string;
  coverage: number;
  confidence: number;
  listingLevel: string;
}> = {}): ScoredJob {
  return {
    job: {
      expiresAt: over.expiresAt ?? null,
      lastLinkCheckOk: over.lastLinkCheckOk ?? null,
    },
    constraints: { overall: over.blocked ? "blocked" : "ok" },
    fit: { band: over.band ?? "high", coverage: over.coverage ?? 0.8 },
    confidence: { score: over.confidence ?? 70 },
    listingConfidence: { level: over.listingLevel ?? "high" },
  } as unknown as ScoredJob;
}

const funnel = (input: FunnelInput) => computeFunnel(input, JETZT);
const stufe = (f: ReturnType<typeof funnel>, key: string) =>
  f.stufen.find((s) => s.key === key)!.count;

describe("Chancenfunnel", () => {
  it("zählt jede Stufe einzeln herunter", () => {
    const f = funnel({
      rawCount: 100,
      jobs: [
        job(),
        job({ expiresAt: new Date("2026-08-01") }),
        job({ blocked: true }),
        job({ band: "insufficient_data" }),
        job({ coverage: 0.1 }),
        job({ confidence: 20 }),
      ],
    });

    expect(stufe(f, "roh")).toBe(100);
    expect(stufe(f, "dedupliziert")).toBe(6);
    expect(stufe(f, "aktiv")).toBe(5);
    expect(stufe(f, "bedingungen")).toBe(4);
    expect(stufe(f, "erreichbar")).toBe(3);
    expect(stufe(f, "belegt")).toBe(2);
    expect(stufe(f, "entscheidungsbereit")).toBe(1);
  });

  it("gibt Rohtreffer nicht als Chancen aus", () => {
    // Der eigentliche Zweck. 1.000 Treffer, eine echte Möglichkeit.
    const f = funnel({ rawCount: 1000, jobs: [job(), job({ blocked: true })] });
    expect(stufe(f, "roh")).toBe(1000);
    expect(stufe(f, "entscheidungsbereit")).toBe(1);
  });

  it("nennt den Engpass, der am meisten kostet", () => {
    const f = funnel({
      rawCount: 20,
      jobs: [job(), ...Array.from({ length: 15 }, () => job({ blocked: true }))],
    });
    expect(f.engpass?.key).toBe("bedingungen");
    expect(f.engpass?.verlust).toBe(15);
  });

  it("nennt Deduplizierung nicht als Engpass", () => {
    // Zusammengeführte Dubletten sind kein Verlust, sondern Aufräumen.
    // Sie als Engpass zu melden wäre irreführend.
    const f = funnel({ rawCount: 100, jobs: Array.from({ length: 10 }, () => job()) });
    expect(f.engpass?.key).not.toBe("dedupliziert");
  });

  it("empfiehlt nicht, harte Bedingungen aufzugeben", () => {
    // Eine harte Bedingung hat meist einen Grund, den die Person nicht
    // erzählt hat. Sie zu übergehen heisst, den Grund zu übergehen.
    const f = funnel({
      rawCount: 20,
      jobs: Array.from({ length: 15 }, () => job({ blocked: true })),
    });
    const text = `${f.engpass?.erklaerung} ${f.engpass?.handlung}`;
    expect(text).not.toMatch(/aufgeben|lockern|senke|verzichte/i);
    expect(text).toMatch(/entscheidest du/i);
  });

  it("schweigt bei zu kleiner Datenbasis, statt Genauigkeit zu behaupten", () => {
    const f = funnel({ rawCount: 3, jobs: [job()] });
    expect(f.belastbar).toBe(false);
    expect(f.engpass).toBeNull();
    expect(f.hinweis).toMatch(/nicht genügend Daten/i);
  });

  it("sagt bei jeder Stufe, was weggefallen ist", () => {
    const f = funnel({ rawCount: 10, jobs: [job(), job({ blocked: true })] });
    const bedingungen = f.stufen.find((s) => s.key === "bedingungen")!;
    expect(bedingungen.lost).toContain("1");
  });

  it("meldet nichts als weggefallen, wenn nichts wegfiel", () => {
    const f = funnel({ rawCount: 5, jobs: Array.from({ length: 5 }, () => job()) });
    for (const s of f.stufen) {
      if (s.key === "roh") continue;
      expect(s.lost, s.key).toBeNull();
    }
  });
});
