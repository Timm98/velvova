import { beforeEach, describe, expect, it, vi } from "vitest";
import { gesundheitAlsText, gesundheitVergessen, modellgesundheit } from "./modellgesundheit.ts";
import type { RuntimeConfig } from "@paycheck/config";

function cfg(teil: Partial<RuntimeConfig["ai"]> = {}): RuntimeConfig {
  return {
    ai: {
      provider: "openai",
      apiKey: "probe",
      modelInteractive: "gpt-5-mini",
      modelDeep: "gpt-5",
      modelFast: "gpt-4.1-mini",
      modelRealtime: "gpt-realtime-2.1",
      modelEmbed: "text-embedding-3-small",
      modelInteractiveFallback: "gpt-4.1-mini",
      modelDeepFallback: "gpt-5-mini",
      modelFastFallback: "gpt-5-mini",
      ...teil,
    },
  } as unknown as RuntimeConfig;
}

function antwortMit(ids: string[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), { status: 200 })) as typeof fetch;
}

const JETZT = new Date("2026-09-06T12:00:00Z");

beforeEach(() => gesundheitVergessen());

describe("Modellgesundheit", () => {
  it("meldet je Stufe Modell, Ersatz und Listung", async () => {
    const b = await modellgesundheit({
      cfg: cfg(),
      fetchImpl: antwortMit(["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "text-embedding-3-small"]),
      jetzt: JETZT,
    });

    expect(b.erreichbar).toBe(true);
    expect(b.modelle).toHaveLength(6);

    const standard = b.modelle.find((m) => m.stufe === "DEFAULT")!;
    expect(standard.modell).toBe("gpt-5-mini");
    expect(standard.gelistet).toBe(true);
    expect(standard.ersatz).toBe("gpt-4.1-mini");
  });

  it("nennt ein nicht gelistetes Modell beim Namen", async () => {
    /*
     * Genau der Fall, der uns 404 bescherte: Ein Modell steht in der
     * Konfiguration und existiert auf dem Konto nicht.
     */
    const b = await modellgesundheit({
      cfg: cfg({ modelDeep: "gpt-5.6-sol" }),
      fetchImpl: antwortMit(["gpt-5-mini", "gpt-4.1-mini"]),
      jetzt: JETZT,
    });
    const tief = b.modelle.find((m) => m.stufe === "DEEP")!;
    expect(tief.gelistet).toBe(false);
    expect(gesundheitAlsText(b)).toContain("NICHT GELISTET");
  });

  it("vermerkt, welches Modell im Chat keine Werkzeuge kann", async () => {
    const b = await modellgesundheit({
      cfg: cfg({ modelUltraDeep: "gpt-6-astra" }),
      fetchImpl: antwortMit(["gpt-6-astra"]),
      jetzt: JETZT,
    });
    const ultra = b.modelle.find((m) => m.stufe === "ULTRA")!;
    expect(ultra.nurResponses).toBe(true);
    expect(gesundheitAlsText(b)).toContain("nur über /v1/responses");
  });

  it("unterscheidet „kein Schlüssel“ von „nicht verfügbar“", async () => {
    /*
     * Beides gleich aussehen zu lassen schickt jemanden auf die
     * falsche Suche — beim Anbieter statt in der Umgebung.
     */
    const b = await modellgesundheit({ cfg: cfg({ apiKey: undefined }), jetzt: JETZT });
    expect(b.erreichbar).toBe(false);
    expect(b.grund).toMatch(/Schlüssel/);
  });

  it("fragt innerhalb der Haltbarkeit nicht erneut", async () => {
    const ruf = vi.fn(antwortMit(["gpt-5-mini"]));
    await modellgesundheit({ cfg: cfg(), fetchImpl: ruf as unknown as typeof fetch, jetzt: JETZT });
    await modellgesundheit({ cfg: cfg(), fetchImpl: ruf as unknown as typeof fetch, jetzt: JETZT });
    expect(ruf).toHaveBeenCalledTimes(1);
  });

  it("behält einen Fehlschlag NICHT", async () => {
    /*
     * Dieselbe Falle wie bei der Berufskennung: Ein einzelner
     * Fehlschlag galt dort eine Stunde lang als Befund.
     */
    const kaputt = (async () => {
      throw new Error("Netz weg");
    }) as unknown as typeof fetch;

    const erst = await modellgesundheit({ cfg: cfg(), fetchImpl: kaputt, jetzt: JETZT });
    expect(erst.erreichbar).toBe(false);

    const dann = await modellgesundheit({
      cfg: cfg(),
      fetchImpl: antwortMit(["gpt-5-mini"]),
      jetzt: JETZT,
    });
    expect(dann.erreichbar).toBe(true);
  });
});
