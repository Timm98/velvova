import { describe, expect, it } from "vitest";
import { evaluateGate, REQUIRED_STAGES, type InterviewSession } from "./interview.ts";

function sitzung(erledigt: string[]): InterviewSession {
  const jetzt = new Date("2026-09-08T00:00:00Z");
  return {
    id: "s1",
    userId: "u1",
    mode: "text",
    locale: "de",
    stage: "current_situation",
    completedStages: erledigt as InterviewSession["completedStages"],
    skippedStages: [],
    status: "active",
    startedAt: jetzt,
    updatedAt: jetzt,
    completedAt: null,
  };
}

describe("der Hinweis auf der Stellenseite", () => {
  it("benennt, was unbekannt ist — statt Themen zu zählen", () => {
    /*
     * Vorher: „Es fehlen noch 3 Themen, bevor Empfehlungen sinnvoll
     * sind." Gemeldet am 8. September 2026 als sinnlos — der Satz
     * zählt etwas, das niemand sehen kann, und es geht auch gar nicht
     * um Aufgaben, sondern darum, was wir über einen Menschen wissen.
     */
    const erledigt = REQUIRED_STAGES.slice(0, 3);
    const g = evaluateGate(sitzung([...erledigt]), false);

    expect(g.reason).not.toMatch(/Thema|Themen/);
    expect(g.reason).not.toMatch(/\d/);
    expect(g.reason).toMatch(/^Ich weiss noch nicht, /);
  });

  it("nennt die fehlenden Angaben in Worten", () => {
    const g = evaluateGate(sitzung([...REQUIRED_STAGES.slice(0, 5)]), false);
    /* Es fehlt nur noch die letzte Stufe: der Ort. */
    expect(g.reason).toBe("Ich weiss noch nicht, wo du arbeiten kannst.");
  });

  it("verbindet zwei Angaben mit „und“", () => {
    const g = evaluateGate(sitzung([...REQUIRED_STAGES.slice(0, 4)]), false);
    expect(g.reason).toBe(
      "Ich weiss noch nicht, was für dich nicht infrage kommt und wo du arbeiten kannst.",
    );
  });

  it("kürzt, statt sechs Halbsätze aneinanderzureihen", () => {
    /*
     * Eine Liste, die überfordert, erreicht dasselbe wie gar keine.
     */
    const g = evaluateGate(sitzung([]), false);
    expect(g.reason).toMatch(/— und noch \d+ Sachen\.$/);
    expect(g.reason.split(",").length).toBeLessThanOrEqual(4);
  });

  it("sagt bei leerem Anfang nicht „es fehlt“", () => {
    const g = evaluateGate(null, false);
    expect(g.reason).toContain("Bisher weiss ich nichts über dich");
    expect(g.reason).not.toMatch(/fehlt|fehlen/);
  });

  it("bittet zum Nachsehen, sobald alles da ist", () => {
    const g = evaluateGate(sitzung([...REQUIRED_STAGES]), false);
    expect(g.missingStages).toHaveLength(0);
    expect(g.reason).toContain("schau einmal drüber");
  });

  it("gibt frei, wenn das Profil bestätigt ist", () => {
    const g = evaluateGate(sitzung([...REQUIRED_STAGES]), true);
    expect(g.unlocked).toBe(true);
  });
});
