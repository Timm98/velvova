import { describe, expect, it } from "vitest";
import { ALL_TASKS, fallbackRoute, route, type ModelTier, eskalieren } from "./router.ts";

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
      expect(["FAST", "DEFAULT", "DEEP", "REALTIME"]).toContain(d.tier);
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
    expect(route("cover_letter_draft").tier).toBe("DEEP");
    expect(route("cv_section_draft").tier).toBe("DEEP");
  });

  it("hält das Gespräch schnell", () => {
    expect(route("interview_turn").tier).toBe("DEFAULT");
    expect(route("interview_turn").timeoutMs).toBeLessThanOrEqual(20_000);
  });

  it("verschwendet keine Tiefe an Klassifikation", () => {
    expect(route("language_detection").tier).toBe("FAST");
    expect(route("job_normalisation").tier).toBe("FAST");
  });

  it("weicht bei einer Urteilsaufgabe nicht auf das schnelle Modell aus", () => {
    // Ein Rückfall auf TERRA würde ein Ergebnis erzeugen, das aussieht
    // wie ein Urteil, aber keines ist. Lieber gar keine Antwort.
    const luna = ALL_TASKS.filter((t) => route(t).tier === "DEEP");
    expect(luna.length).toBeGreaterThan(0);
    for (const task of luna) {
      expect(route(task).fallback).not.toBe("FAST");
    }
  });

  it("gibt bei fehlendem Rückfall null zurück statt einer Notlösung", () => {
    const ohneRueckfall = route("language_detection");
    expect(ohneRueckfall.fallback).toBeNull();
    expect(fallbackRoute(ohneRueckfall)).toBeNull();
  });

  it("nennt im Rückfall beide Stufen", () => {
    const zurueck = fallbackRoute(route("profile_synthesis"));
    expect(zurueck?.tier).toBe("DEFAULT");
    expect(zurueck?.reason).toContain("DEEP");
    expect(zurueck?.reason).toContain("DEFAULT");
  });

  it("führt Sprache über einen eigenen Pfad, mit ehrlichem Textrückfall", () => {
    const d = route("voice_session");
    expect(d.tier).toBe("REALTIME");
    expect(d.fallback).toBe("DEFAULT");
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

describe("Eskalation zur höchsten Stufe", () => {
  const tief = route("career_transition_analysis");

  it("bleibt bei einer gewöhnlichen Analyse auf DEEP", () => {
    expect(eskalieren(tief, { optionen: 2, konfidenz: 0.8 }).tier).toBe("DEEP");
  });

  it("lässt ein einzelnes Merkmal nicht genügen", () => {
    /*
     * Vier Optionen sind bei einer Karriereberatung normal. Vier
     * Optionen UND eine unsichere Vorabanalyse sind es nicht.
     */
    const b = eskalieren(tief, { optionen: 5 });
    expect(b.eskaliert).toBe(false);
    expect(b.grund).toMatch(/nur ein Merkmal/);
  });

  it("eskaliert bei zwei zusammentreffenden Merkmalen", () => {
    const b = eskalieren(tief, { optionen: 5, konfidenz: 0.3 });
    expect(b.tier).toBe("ULTRA");
    expect(b.grund).toContain("Optionen");
    expect(b.grund).toContain("unsicher");
  });

  it("folgt einer ausdrücklichen Bitte sofort", () => {
    /* Das ist keine Heuristik, sondern eine Aussage der Person. */
    expect(eskalieren(tief, { ausdruecklichGruendlich: true }).tier).toBe("ULTRA");
  });

  it("eskaliert ein Gespräch niemals", () => {
    /*
     * „Hallo Monday" darf die teuerste Stufe nie erreichen — auch nicht,
     * wenn im Hintergrund zwanzig Stellen liegen.
     */
    const gespraech = route("nina_chat");
    const b = eskalieren(gespraech, {
      optionen: 9,
      konfidenz: 0.1,
      widersprueche: 5,
      stellen: 30,
      ausdruecklichGruendlich: true,
    });
    expect(b.tier).toBe(gespraech.tier);
    expect(b.eskaliert).toBe(false);
  });

  it("eskaliert eine Extraktion niemals", () => {
    /* Eine Extraktion wird nicht schwer, weil viele Stellen im Spiel
       sind — sie bleibt eine Extraktion. */
    const b = eskalieren(route("evidence_extraction"), { stellen: 50, optionen: 9, konfidenz: 0.1 });
    expect(b.eskaliert).toBe(false);
  });
});
