import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations } from "@paycheck/db";
import { ingestFromAdapter } from "./ingest.ts";
import type { JobSourceAdapter } from "./adapter.ts";

/**
 * Der Not-Aus.
 *
 * §24B verlangt den Nachweis, dass ein abgeschalteter Anbieter einen
 * bereits laufenden Abruf tatsächlich stoppt — und zwar bevor das erste
 * Byte über die Leitung geht. Ein Abruf, der erst hinterher als
 * unzulässig erkannt wird, hat stattgefunden; die Daten liegen dann
 * schon da, und die Rechtsfrage ist bereits beantwortet, falsch.
 *
 * Der Adapter hier zählt seine Netzzugriffe. Bleibt der Zähler auf
 * null, hat der Riegel an der richtigen Stelle gehalten.
 */

const GLOBAL_KEY = Symbol.for("paycheck.db.handle");
let close: () => Promise<void>;

beforeAll(async () => {
  // Eine echte, aber flüchtige Datenbank. Ohne sie könnte der letzte
  // Test nicht zeigen, dass ein freigegebener Anbieter tatsächlich
  // durchkommt — und dann prüften die ersten beiden Tests nichts.
  const handle = await createInMemoryDb();
  close = handle.close;
  await runMigrations(handle.db);
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = handle;
}, 120_000);

afterAll(async () => {
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = null;
  await close?.();
});

function zaehlenderAdapter(): { adapter: JobSourceAdapter; zugriffe: () => number } {
  let n = 0;
  const adapter: JobSourceAdapter = {
    key: "test_provider",
    displayName: "Testanbieter",
    kind: "licensed_api",
    licenseStatus: "licensed",
    attributionRequired: false,
    attributionText: null,
    termsUrl: null,
    isConfigured: () => true,
    async fetchListings() {
      n += 1;
      return [];
    },
  };
  return { adapter, zugriffe: () => n };
}

describe("Anbieter-Not-Aus", () => {
  it("greift vor dem ersten Netzzugriff", async () => {
    const { adapter, zugriffe } = zaehlenderAdapter();

    const result = await ingestFromAdapter(adapter, {
      policy: {
        decision: "link_only",
        allowedOperations: ["PublicDisplay"],
        reason: "Anbieter abgeschaltet (Not-Aus)",
      },
    });

    expect(zugriffe()).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.errors.join(" ")).toContain("Not-Aus");
  });

  it("hilft eine erlaubte Nebenoperation nicht über die fehlende Suchfreigabe hinweg", async () => {
    const { adapter, zugriffe } = zaehlenderAdapter();

    // "approved" allein reicht nicht. Es muss die Operation freigegeben
    // sein, um die es hier geht — nämlich Search.
    const result = await ingestFromAdapter(adapter, {
      policy: {
        decision: "approved",
        allowedOperations: ["PublicDisplay", "Cache"],
        reason: "Nur Anzeige freigegeben",
      },
    });

    expect(zugriffe()).toBe(0);
    expect(result.errors).not.toHaveLength(0);
  });

  it("greift auch dann, wenn der Aufrufer nichts mitgibt", async () => {
    // Der wichtigste Fall. Die erste Fassung nahm die Entscheidung als
    // optionalen Parameter entgegen: wer ihn vergass, rief ungeprüft
    // ab — und nichts schlug fehl. Ein Riegel, den man durch Weglassen
    // öffnet, ist keiner.
    const { adapter, zugriffe } = zaehlenderAdapter();

    const result = await ingestFromAdapter(adapter);

    expect(zugriffe()).toBe(0);
    expect(result.errors.join(" ")).toMatch(/nicht freigegeben/);
  });

  it("lässt einen freigegebenen Anbieter arbeiten", async () => {
    const { adapter, zugriffe } = zaehlenderAdapter();

    await ingestFromAdapter(adapter, {
      policy: {
        decision: "approved",
        allowedOperations: ["Search", "FetchDetails", "Cache"],
        reason: "Freigegeben",
      },
    }).catch(() => undefined);

    // Ohne Datenbank scheitert das Schreiben — der Abruf selbst muss
    // aber stattgefunden haben, sonst prüft der Test oben nichts.
    expect(zugriffe()).toBe(1);
  });
});
