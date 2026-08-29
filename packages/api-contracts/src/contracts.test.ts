import { describe, expect, it } from "vitest";
import { HealthResponse, ROUTES, toOpenApi } from "./index.ts";

describe("API-Vertrag", () => {
  it("beschreibt jeden Endpunkt mit Zusammenfassung und Schema", () => {
    for (const r of ROUTES) {
      expect(r.summary.length, r.path).toBeGreaterThan(10);
      expect(r.response).toBeDefined();
    }
  });

  it("erzeugt eine gueltige OpenAPI-Beschreibung aus denselben Schemata", () => {
    const doc = toOpenApi("Testmarke") as { openapi: string; info: { title: string }; paths: Record<string, unknown> };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Testmarke API");
    expect(Object.keys(doc.paths)).toHaveLength(ROUTES.length);
  });

  it("weist eine Antwort zurueck, die dem Schema widerspricht", () => {
    expect(() => HealthResponse.parse({ status: "unbekannt" })).toThrow();
  });

  it("nimmt eine gueltige Antwort an", () => {
    expect(() =>
      HealthResponse.parse({
        status: "ok",
        datenbank: { erreichbar: true, treiber: "pglite", fehler: null },
        modus: "demo",
      }),
    ).not.toThrow();
  });
});
