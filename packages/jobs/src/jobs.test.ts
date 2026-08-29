import { describe, expect, it } from "vitest";
import { classifyRequirement, computeContentHash, deduplicate, extractCoreTasks, normalise } from "./adapter.ts";
import { UserTextImportAdapter } from "./sources/userImport.ts";
import { sourceStatuses } from "./registry.ts";
import { loadRuntimeConfig } from "@paycheck/config";

describe("Normalisierung", () => {
  it("behandelt ein fehlendes Gehalt als 'nicht angegeben', nicht als null", () => {
    const n = normalise({
      externalId: "1", title: "Test", companyName: "Demo GmbH", location: "Hamburg",
      description: "Du betreust Kunden.",
    });
    expect(n.job.salary.disclosed).toBe(false);
    expect(n.job.salary.min).toBeNull();
  });

  it("erkennt eine offengelegte Gehaltsangabe", () => {
    const n = normalise({
      externalId: "1", title: "Test", companyName: "Demo GmbH", location: "Hamburg",
      description: "Du betreust Kunden.", salaryMin: 40000, salaryMax: 50000,
    });
    expect(n.job.salary.disclosed).toBe(true);
  });

  it("stuft eine Anforderung ohne Signal als Muss ein", () => {
    expect(classifyRequirement("Erfahrung in der Kundenbetreuung")).toBe("must");
  });

  it("erkennt Kann-Anforderungen an ihrer Formulierung", () => {
    expect(classifyRequirement("Erfahrung mit CRM von Vorteil")).toBe("nice");
    expect(classifyRequirement("Idealerweise erste Berufserfahrung")).toBe("nice");
  });

  it("zieht Aufgaben aus dem Fließtext", () => {
    const tasks = extractCoreTasks(
      "Du betreust unsere Kundinnen und Kunden nach dem Start.\n" +
        "Du erstellst monatliche Auswertungen für das Team.\n" +
        "Kurz.",
    );
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.every((t) => t.length > 15)).toBe(true);
  });
});

describe("Reposts", () => {
  it("erkennt inhaltsgleiche Anzeigen unabhängig vom Datum", () => {
    const a = computeContentHash({ title: "X", companyName: "Y", location: "Z", description: "Text  hier" });
    const b = computeContentHash({ title: "X", companyName: "Y", location: "Z", description: "TEXT hier" });
    expect(a).toBe(b);
  });

  it("behält die neueste Anzeige und merkt sich die frueheren", () => {
    const items = [
      { contentHash: "h1", publishedAt: new Date("2026-01-01"), id: "alt" },
      { contentHash: "h1", publishedAt: new Date("2026-08-01"), id: "neu" },
      { contentHash: "h2", publishedAt: new Date("2026-05-01"), id: "andere" },
    ];
    const r = deduplicate(items);
    expect(r.keep.map((k) => k.id).sort()).toEqual(["andere", "neu"]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0]!.earlier[0]!.id).toBe("alt");
  });
});

describe("Quellen", () => {
  it("nimmt eingefuegte Stellenbeschreibungen entgegen", () => {
    const adapter = new UserTextImportAdapter();
    const listing = adapter.parse({ text: "Customer Success Manager\n\nDu betreust Kunden." });
    expect(listing.title).toContain("Customer Success");
    expect(adapter.licenseStatus).toBe("user_provided");
  });

  it("meldet nicht eingerichtete Quellen ehrlich als inaktiv", () => {
    const cfg = loadRuntimeConfig({ JOB_SOURCES: "seed" });
    const statuses = sourceStatuses(cfg);
    expect(statuses.find((s) => s.key === "seed")?.active).toBe(true);
    expect(statuses.find((s) => s.key === "user_text")?.active).toBe(false);
  });
});
