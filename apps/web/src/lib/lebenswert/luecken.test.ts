import { describe, expect, it } from "vitest";
import { anzeigenqualitaet } from "./luecken.ts";
import type { Job } from "@paycheck/domain";

/**
 * Eine Stellenanzeige ohne Urlaubsangabe ist keine schlechte Anzeige.
 * Sie ist eine Anzeige, in der etwas fehlt, das für eine Entscheidung
 * zählt — und der Unterschied muss im Ton durchgehalten werden.
 */

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: "1",
    title: "Sachbearbeitung",
    companyName: "Beispiel GmbH",
    location: "Karlsruhe",
    country: "DE",
    workModel: "on_site",
    contractType: "permanent",
    weeklyHours: 40,
    coreTasks: ["Belege prüfen"],
    salary: { min: 45000, max: 55000, currency: "EUR", period: "year", disclosed: true, provenance: "provider", evidence: null },
    ...over,
  }) as unknown as Job;

describe("Lücken finden", () => {
  it("findet bei einer vollständigen Anzeige nichts", () => {
    const q = anzeigenqualitaet(job(), 3);
    expect(q.luecken).toHaveLength(0);
    expect(q.einordnung).toBe("gut");
  });

  it("nennt das fehlende Gehalt zuerst", () => {
    /*
     * Die Reihenfolge ist eine Produktentscheidung. Ohne Gehalt lässt
     * sich nicht beurteilen, ob eine Stelle passt — ohne Vertragsart
     * schon.
     */
    const q = anzeigenqualitaet(
      job({
        salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null },
        contractType: null,
      } as Partial<Job>),
    );
    expect(q.luecken[0]!.luecke).toBe("gehalt");
    expect(q.luecken[0]!.gewicht).toBe("hoch");
  });

  it("macht aus jeder Lücke eine Frage fürs Gespräch", () => {
    // Aus „fehlt: Gehalt" wird etwas, das man aussprechen kann.
    const q = anzeigenqualitaet(
      job({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null } } as Partial<Job>),
    );
    expect(q.luecken[0]!.frage).toContain("Gehaltsspanne");
    expect(q.luecken[0]!.frage.endsWith("?")).toBe(true);
  });

  it("stellt höchstens fünf Fragen", () => {
    // Wer mit zehn Fragen ins Gespräch geht, stellt keine.
    const leer = anzeigenqualitaet(
      job({
        salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null },
        contractType: null,
        weeklyHours: null,
        coreTasks: [],
      } as Partial<Job>),
    );
    expect(leer.luecken.length).toBeLessThanOrEqual(5);
  });
});

describe("Keine Note für den Arbeitgeber", () => {
  it("ordnet in Worten ein, nicht in Prozent", () => {
    /*
     * Eine Prozentzahl über eine Stellenanzeige lädt zum Vergleichen
     * ein („73 % gegen 68 %"), und dafür ist die Grundlage zu dünn:
     * Sechs geprüfte Felder ergeben keine Rangfolge zwischen
     * Arbeitgebern.
     */
    const q = anzeigenqualitaet(job());
    expect(["gut", "mittel", "dünn"]).toContain(q.einordnung);
    expect(q.vollstaendigkeit.moeglich).toBeGreaterThan(3);
  });

  it("zählt Anforderungen aus einer eigenen Quelle", () => {
    // Sie liegen in einer eigenen Tabelle, nicht am Job-Objekt — und
    // werden deshalb übergeben statt nachgeladen.
    const ohne = anzeigenqualitaet(job(), 0);
    expect(ohne.luecken.some((l) => l.luecke === "anforderungen")).toBe(true);
    const mit = anzeigenqualitaet(job(), 4);
    expect(mit.luecken.some((l) => l.luecke === "anforderungen")).toBe(false);
  });
});
