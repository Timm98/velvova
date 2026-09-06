import { describe, expect, it } from "vitest";
import { alleModelle, modellFuer, ultraVerfuegbar, werkzeugeNurUeberResponses } from "./modelle.ts";
import type { RuntimeConfig } from "@paycheck/config";

function cfg(ai: Partial<RuntimeConfig["ai"]>): RuntimeConfig {
  return {
    ai: {
      provider: "openai",
      modelInteractive: "gpt-5-mini",
      modelDeep: "gpt-5",
      modelFast: "gpt-4.1-mini",
      modelRealtime: "gpt-realtime-2.1",
      modelEmbed: "text-embedding-3-small",
      modelInteractiveFallback: "gpt-4.1-mini",
      modelDeepFallback: "gpt-5-mini",
      modelFastFallback: "gpt-5-mini",
      ...ai,
    },
  } as unknown as RuntimeConfig;
}

describe("Werkzeugfähigkeit", () => {
  it("kennt die Modelle, die Werkzeuge nur über /v1/responses annehmen", () => {
    /*
     * Gemessen am 6. September 2026: `gpt-5.6-sol` und `gpt-6-astra`
     * antworten an `/v1/chat/completions` mit 400, sobald Werkzeuge
     * mitgeschickt werden. Über `/v1/responses` können sie es.
     */
    expect(werkzeugeNurUeberResponses("gpt-5.6-sol")).toBe(true);
    expect(werkzeugeNurUeberResponses("gpt-6-astra")).toBe(true);
    expect(werkzeugeNurUeberResponses("gpt-5")).toBe(false);
    expect(werkzeugeNurUeberResponses("gpt-5-mini")).toBe(false);
    expect(werkzeugeNurUeberResponses("gpt-4.1-mini")).toBe(false);
  });

  it("fasst datierte Fassungen mit", () => {
    /* `gpt-5.6-sol-2026-03-01` ist dasselbe Modell. */
    expect(werkzeugeNurUeberResponses("gpt-5.6-sol-2026-03-01")).toBe(true);
  });
});

describe("Modellwahl je Stufe", () => {
  it("nimmt für das Gespräch ein werkzeugfähiges Modell", () => {
    const w = modellFuer(cfg({}), "DEFAULT");
    expect(w.modell).toBe("gpt-5-mini");
    expect(w.werkzeugeNurUeberResponses).toBe(false);
  });

  it("gibt je Stufe eine eigene Zeitgrenze", () => {
    expect(modellFuer(cfg({}), "FAST").timeoutMs).toBe(15_000);
    expect(modellFuer(cfg({}), "DEEP").timeoutMs).toBe(90_000);
    expect(modellFuer(cfg({}), "ULTRA").timeoutMs).toBe(120_000);
  });

  it("hält einen gleichnamigen Ersatz für keinen", () => {
    /* Passiert leicht beim Kopieren der Umgebungsvariablen — und wäre
       eine Schleife statt einer Absicherung. */
    const w = modellFuer(cfg({ modelDeep: "gpt-5", modelDeepFallback: "gpt-5" }), "DEEP");
    expect(w.ersatz).toBeNull();
  });
});

describe("Die höchste Stufe", () => {
  it("fällt ohne Einrichtung auf die tiefe zurück", () => {
    /*
     * Wer sie nicht bestellt hat, bekommt sie nicht — und keinen
     * Fehler. „Hallo Nina" darf nicht das teuerste Modell wecken.
     */
    const w = modellFuer(cfg({}), "ULTRA");
    expect(w.modell).toBe("gpt-5");
    expect(ultraVerfuegbar(cfg({}))).toBe(false);
  });

  it("nimmt sie, wenn sie eingetragen ist", () => {
    const c = cfg({ modelUltraDeep: "gpt-6-astra", modelUltraDeepFallback: "gpt-5.6-sol" });
    const w = modellFuer(c, "ULTRA");
    expect(w.modell).toBe("gpt-6-astra");
    expect(w.ersatz).toBe("gpt-5.6-sol");
    expect(ultraVerfuegbar(c)).toBe(true);
    /*
     * Sie nimmt Werkzeuge nur über `/v1/responses` — für uns
     * folgenlos, weil der Anbieter ohnehin nur dort anruft. Der
     * Hinweis bleibt trotzdem sichtbar.
     */
    expect(w.werkzeugeNurUeberResponses).toBe(true);
  });

  it("hält eine Höchststufe, die dem tiefen Modell gleicht, für keine", () => {
    expect(ultraVerfuegbar(cfg({ modelUltraDeep: "gpt-5" }))).toBe(false);
  });
});

describe("Übersicht", () => {
  it("nennt für jede Stufe ein Modell", () => {
    const alle = alleModelle(cfg({ modelUltraDeep: "gpt-6-astra" }));
    expect(Object.values(alle).every((m) => typeof m === "string" && m.length > 0)).toBe(true);
    expect(alle.ULTRA).toBe("gpt-6-astra");
  });
});
