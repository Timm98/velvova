import { describe, expect, it } from "vitest";
import { ALL_TASKS, fallbackRoute, route, type ModelTier } from "./router.ts";

/**
 * Der Router entscheidet, wie viel Rechenzeit eine Aufgabe bekommt. Das
 * ist gleichzeitig eine Kostenfrage und eine Qualitätsfrage, und beide
 * Fehlrichtungen sind teuer: eine Profilsynthese auf dem schnellen
 * Modell liefert ein Ergebnis, das niemand als schlechter erkennt.
 */

describe("Modell-Router", () => {
  it("kennt für jede Aufgabe genau eine Stufe", () => {
    for (const task of ALL_TASKS) {
      const d = route(task);
      expect(d.task).toBe(task);
      expect(["TERRA", "SOL", "LUNA", "REALTIME"]).toContain(d.tier);
    }
  });

  it("begründet jede Entscheidung in ganzen Sätzen", () => {
    for (const task of ALL_TASKS) {
      const { reason } = route(task);
      expect(reason.length).toBeGreaterThan(20);
      expect(reason).toMatch(/\.$/);
    }
  });

  it("gibt alles, was das Haus verlässt, auf die gründliche Stufe", () => {
    // Anschreiben und Lebenslauf gehen an einen Arbeitgeber und tragen
    // den Namen der Person. Hier zu sparen wäre am falschen Ende.
    expect(route("cover_letter_draft").tier).toBe("LUNA");
    expect(route("cv_section_draft").tier).toBe("LUNA");
  });

  it("hält das Gespräch schnell", () => {
    expect(route("interview_turn").tier).toBe("SOL");
    expect(route("interview_turn").timeoutMs).toBeLessThanOrEqual(20_000);
  });

  it("verschwendet keine Tiefe an Klassifikation", () => {
    expect(route("language_detection").tier).toBe("TERRA");
    expect(route("job_normalisation").tier).toBe("TERRA");
  });

  it("weicht bei einer Urteilsaufgabe nicht auf das schnelle Modell aus", () => {
    // Ein Rückfall auf TERRA würde ein Ergebnis erzeugen, das aussieht
    // wie ein Urteil, aber keines ist. Lieber gar keine Antwort.
    const luna = ALL_TASKS.filter((t) => route(t).tier === "LUNA");
    expect(luna.length).toBeGreaterThan(0);
    for (const task of luna) {
      expect(route(task).fallback).not.toBe("TERRA");
    }
  });

  it("gibt bei fehlendem Rückfall null zurück statt einer Notlösung", () => {
    const ohneRueckfall = route("language_detection");
    expect(ohneRueckfall.fallback).toBeNull();
    expect(fallbackRoute(ohneRueckfall)).toBeNull();
  });

  it("nennt im Rückfall beide Stufen", () => {
    const zurueck = fallbackRoute(route("profile_synthesis"));
    expect(zurueck?.tier).toBe("SOL");
    expect(zurueck?.reason).toContain("LUNA");
    expect(zurueck?.reason).toContain("SOL");
  });

  it("führt Sprache über einen eigenen Pfad, mit ehrlichem Textrückfall", () => {
    const d = route("voice_session");
    expect(d.tier).toBe("REALTIME");
    expect(d.fallback).toBe("SOL");
  });

  it("nennt an keiner Stelle einen Modellnamen", () => {
    // Steht erst einmal ein Modellname im Fachcode, ist der
    // Anbieterwechsel ein Umbau statt einer Einstellung.
    const verdaechtig = /\b(gpt|claude|gemini|llama|mistral|o[134](-mini)?)\b/i;
    for (const task of ALL_TASKS) {
      const d = route(task);
      expect(d.reason).not.toMatch(verdaechtig);
      expect(d.tier as ModelTier).not.toMatch(verdaechtig);
    }
  });
});
