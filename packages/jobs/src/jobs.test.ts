import { describe, expect, it } from "vitest";
import { classifyRequirement, computeContentHash, deduplicate, extractCoreTasks, normalise } from "./adapter.ts";
import { UserTextImportAdapter } from "./sources/userImport.ts";
import { activeAdapters, sourceStatuses } from "./registry.ts";
import { AdzunaAdapter } from "./sources/adzuna.ts";
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
    /*
     * Die Absicht dieses Tests ist unverändert: eine Quelle ohne
     * Zugangsdaten darf nie als aktiv erscheinen. Das Beispiel ist ein
     * anderes.
     *
     * Vorher stand hier `user_private_import` — als Beispiel für „nicht
     * ausgewählt". Seit eingerichtete Quellen von selbst laufen, trifft
     * das auf ihn nicht mehr zu, und zwar zu Recht: der eigene Import
     * braucht keine Zugangsdaten, kostet nichts und schickt nichts an
     * Dritte. Er war nie „nicht eingerichtet", sondern nur nicht
     * aufgezählt.
     *
     * Geprüft wird jetzt an einer Quelle, die wirklich einen Schlüssel
     * braucht.
     */
    const cfg = loadRuntimeConfig({ JOB_SOURCES: "seed" });
    const statuses = sourceStatuses(cfg);
    expect(statuses.find((s) => s.key === "seed")?.active).toBe(true);

    const adzuna = statuses.find((s) => s.key === "adzuna_de");
    expect(adzuna).toBeDefined();
    if (!process.env.ADZUNA_APP_ID) {
      expect(adzuna!.active).toBe(false);
      expect(adzuna!.reason).toMatch(/Zugangsdaten/);
    }
  });

  it("schaltet eine Quelle frei, sobald ihre Zugangsdaten da sind", () => {
    /*
     * Die andere Richtung, und der Grund für die Umstellung.
     *
     * Vorher musste eine Quelle zusätzlich in `JOB_SOURCES` stehen.
     * `JOB_SOURCES=arbeitnow` stand seit Monaten in der Konfiguration,
     * und jeder neu eingetragene Schlüssel blieb wirkungslos — ohne
     * Fehlermeldung, ohne Hinweis. Wer einen Schlüssel einträgt und
     * danach nichts sieht, sucht beim Anbieter.
     */
    const cfg = loadRuntimeConfig({ JOB_SOURCES: "seed" });
    const adapter = new AdzunaAdapter({ appId: "x", appKey: "y" });
    expect(adapter.isConfigured()).toBe(true);
    expect(activeAdapters(cfg).some((a) => a.key === "seed")).toBe(false);
  });

  it("schaltet eine Quelle über JOB_SOURCES_EXCLUDE wieder ab", () => {
    // Der Notausgang: Schlüssel hinterlegt, Quelle trotzdem aus —
    // wegen Kosten, Kontingent oder einer Störung beim Anbieter.
    const vorher = process.env.JOB_SOURCES_EXCLUDE;
    process.env.JOB_SOURCES_EXCLUDE = "user_private_import";
    try {
      const cfg = loadRuntimeConfig({ JOB_SOURCES: "seed" });
      const zeile = sourceStatuses(cfg).find((s) => s.key === "user_private_import");
      expect(zeile?.active).toBe(false);
      expect(zeile?.reason).toMatch(/JOB_SOURCES_EXCLUDE/);
    } finally {
      if (vorher === undefined) delete process.env.JOB_SOURCES_EXCLUDE;
      else process.env.JOB_SOURCES_EXCLUDE = vorher;
    }
  });
});
