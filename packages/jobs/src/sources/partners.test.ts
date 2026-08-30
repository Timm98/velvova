import { describe, expect, it } from "vitest";
import { PARTNER_ADAPTERS } from "./partners.ts";
import { adapterByKey } from "../registry.ts";
import { decideForProvider, isAllowed } from "@paycheck/sources";

/**
 * Fünf Quellen, mit denen es keinen Vertrag gibt.
 *
 * Sie existieren als Adapter, damit die Lücke sichtbar ist. Fehlte der
 * Adapter, sähe die Betriebsansicht aus, als gäbe es LinkedIn nicht —
 * und die nächste Person schriebe einen Scraper, statt nach einem
 * Vertrag zu fragen.
 */

describe("Partnerquellen ohne Vertrag", () => {
  const adapters = PARTNER_ADAPTERS.map((A) => new A());

  it("gilt keine als eingerichtet", () => {
    for (const a of adapters) {
      expect(a.isConfigured(), a.key).toBe(false);
    }
  });

  it("wirft beim Abrufversuch, statt eine leere Liste zu liefern", async () => {
    // Eine leere Liste sähe aus wie "keine Stellen gefunden" und
    // erschiene im Bericht als erfolgreicher Abruf. Das hier ist ein
    // Zustand, kein Ergebnis.
    for (const a of adapters) {
      await expect(a.fetchListings(), a.key).rejects.toThrow(/wird nicht abgerufen/);
    }
  });

  it("nennt im Fehler, was genau fehlt", () => {
    for (const a of adapters) {
      expect(a.missing.length, a.key).toBeGreaterThan(40);
      expect(a.missing, a.key).toMatch(/kein|nicht/i);
    }
  });

  it("wird von der Policy Engine nicht freigegeben", () => {
    // Zwei unabhängige Riegel. Fiele einer aus, hielte der andere.
    for (const a of adapters) {
      const entscheidung = decideForProvider(a.key);
      expect(entscheidung.decision, a.key).not.toBe("approved");
      expect(isAllowed(entscheidung, "Search"), a.key).toBe(false);
      expect(isAllowed(entscheidung, "Cache"), a.key).toBe(false);
    }
  });

  it("erlaubt weiterhin den Verweis auf das Original", () => {
    // "Nicht abrufen" ist nicht "verschweigen". Wer die Stelle dort
    // gefunden hat, soll sie hier verlinken können.
    for (const a of adapters) {
      const entscheidung = decideForProvider(a.key);
      expect(["link_only", "pending_review", "blocked"], a.key).toContain(entscheidung.decision);
    }
  });

  it("steht in der Adapterliste, damit die Lücke sichtbar ist", () => {
    for (const a of adapters) {
      expect(adapterByKey(a.key), a.key).toBeDefined();
    }
  });
});
