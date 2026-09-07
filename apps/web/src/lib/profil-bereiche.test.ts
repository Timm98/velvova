import { describe, expect, it } from "vitest";
import { bereichAus } from "./profil-bereiche.ts";

/**
 * Die Abdeckung muss beide Schemata verstehen.
 *
 * In der Datenbank stehen zwei Benennungen nebeneinander: das ältere
 * `interview:<bereich>:<detail>` und das aktuelle
 * `nina:v3:<thema>:<stufe>`. Die Rechnung kannte nur das erste — also
 * genau jenes, das die heutige Monday NICHT schreibt.
 *
 * Ergebnis im Betrieb: 326 Belege, ein einziges Karriereprofil, und ein
 * Fortschrittsbalken, der bei null stehen blieb, während das Gespräch
 * lief.
 */

describe("Belege den Bereichen zuordnen", () => {
  it("versteht das aktuelle Schema von Monday", () => {
    expect(bereichAus("nina:v3:career_evidence:current_situation")).toBe("experience_episodes");
    expect(bereichAus("nina:v3:constraints:task_preferences")).toBe("hard_constraints");
    expect(bereichAus("nina:v3:preferred_tasks:orientation")).toBe("tasks_and_energy");
    expect(bereichAus("nina:v3:disliked_tasks:orientation")).toBe("tasks_and_energy");
    expect(bereichAus("nina:v3:values:orientation")).toBe("values_and_motives");
    expect(bereichAus("nina:v3:work_style_preferences:orientation")).toBe(
      "work_style_and_environment",
    );
    expect(bereichAus("nina:v3:skills:orientation")).toBe("background");
  });

  it("versteht weiterhin das ältere Schema", () => {
    // Die alten Belege zählen nicht plötzlich nicht mehr — sie stehen
    // in denselben Konten wie die neuen.
    expect(bereichAus("interview:experience_episodes:solved_problem")).toBe("experience_episodes");
    expect(bereichAus("interview:background:education")).toBe("background");
    expect(bereichAus("interview:hard_constraints:must")).toBe("hard_constraints");
  });

  it("zählt Ziele keinem Bereich zu", () => {
    /*
     * Ziele sagen, wohin jemand will — nicht, was er mitbringt. Sie in
     * ein Maß dafür einzurechnen, wie gut wir jemanden verstanden
     * haben, würde den Fortschritt mit Absichtserklärungen füllen.
     */
    expect(bereichAus("nina:v3:goals:evidence_discovery")).toBeNull();
  });

  it("kommt mit Unbekanntem und Leerem zurecht", () => {
    expect(bereichAus(null)).toBeNull();
    expect(bereichAus("")).toBeNull();
    expect(bereichAus("nina:v3:voellig_neues_thema:orientation")).toBeNull();
    expect(bereichAus("interview:consent_and_goal:start")).toBeNull();
  });
});
