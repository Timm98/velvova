import { describe, expect, it } from "vitest";
import { isPublishableEmail, missingImprintFields, team } from "@/lib/content/company";
import { launchBlockers, legalDocument, legalDocuments } from "./document-registry.ts";

/**
 * Ein Entwurf, der aussieht wie ein fertiges Impressum, ist schlimmer
 * als eine leere Seite: er suggeriert eine Prüfung, die nicht
 * stattgefunden hat, und niemand sieht ihn sich noch einmal an.
 */

describe("Kontaktadressen", () => {
  it("lehnt unvollständige Adressen ab", () => {
    // "tim.enseling@....com" sieht aus wie fertig und ist es nicht.
    expect(isPublishableEmail("tim.enseling@....com")).toBe(false);
    expect(isPublishableEmail("finn.feja@....com")).toBe(false);
  });

  it("lehnt Fehlendes ab, statt etwas zu erfinden", () => {
    expect(isPublishableEmail(null)).toBe(false);
    expect(isPublishableEmail("")).toBe(false);
    expect(isPublishableEmail("keine-adresse")).toBe(false);
  });

  it("nimmt eine vollständige Adresse an", () => {
    expect(isPublishableEmail("support@paycheck.example")).toBe(true);
  });
});

describe("Team", () => {
  it("veröffentlicht keine Rolle ohne Bestätigung", () => {
    // Eine falsche Rollenangabe im Impressum ist ein Rechtsfehler,
    // keine Ungenauigkeit.
    for (const m of team) {
      expect(m.roleConfirmed, m.name).toBe(false);
    }
  });

  it("trägt keine erfundene Kontaktadresse", () => {
    for (const m of team) {
      expect(isPublishableEmail(m.email), m.name).toBe(false);
    }
  });
});

describe("Pflichtangaben", () => {
  it("nennt, was im Impressum noch fehlt", () => {
    const fehlt = missingImprintFields();
    expect(fehlt.length).toBeGreaterThan(0);
    expect(fehlt.join(" ")).toMatch(/Anschrift/);
    expect(fehlt.join(" ")).toMatch(/Registergericht/);
  });
});

describe("Freigabezustand", () => {
  it("hält Impressum und Datenschutz für nicht veröffentlichbar", () => {
    expect(legalDocument("impressum")!.publishable).toBe(false);
    expect(legalDocument("datenschutz")!.publishable).toBe(false);
  });

  it("lässt Selbstauskünfte durch", () => {
    // KI-Transparenz und Quellenrichtlinie beschreiben, was das Produkt
    // tut. Das können wir belegen — es sind keine Rechtsaussagen.
    expect(legalDocument("ai-transparency")!.publishable).toBe(true);
    expect(legalDocument("source-policy")!.publishable).toBe(true);
  });

  it("nennt zu jedem Entwurf, was ihm fehlt", () => {
    for (const d of legalDocuments()) {
      if (!d.publishable) {
        expect(d.missingFields.length, d.slug).toBeGreaterThan(0);
      }
    }
  });

  it("blockiert den Produktivbetrieb, solange Pflichtseiten fehlen", () => {
    const blocker = launchBlockers();
    expect(blocker.length).toBeGreaterThan(0);
    expect(blocker.join(" ")).toMatch(/Impressum|Datenschutz/);
  });

  it("berechnet den Zustand, statt ihn zu pflegen", () => {
    // Eine Liste, die jemand von Hand aktualisieren müsste, stünde
    // eines Tages falsch da.
    const vorher = legalDocument("impressum")!;
    expect(vorher.missingFields).toEqual(missingImprintFields());
  });
});
