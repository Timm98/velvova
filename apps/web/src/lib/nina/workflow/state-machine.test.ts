import { describe, expect, it } from "vitest";
import { initialState, resumeMessage, transition, type WorkflowState } from "./state-machine.ts";

/**
 * Der Zustandsautomat.
 *
 * Geprüft wird vor allem, was NICHT passieren darf: Fortschritt
 * verlieren, doppelt zählen, oder behaupten, etwas sei erledigt, wofür
 * kein Ereignis vorliegt.
 */

function run(events: Parameters<typeof transition>[1][]): WorkflowState {
  return events.reduce(transition, initialState());
}

describe("Vorgangszustand", () => {
  it("beginnt bei der Kontoeinrichtung", () => {
    expect(initialState().stage).toBe("ACCOUNT_SETUP");
  });

  it("führt durch die vollständige Journey", () => {
    const state = run([
      { type: "ACCOUNT_COMPLETED" },
      { type: "INTERVIEW_STARTED" },
      { type: "INTERVIEW_STAGE_COMPLETED", stageKey: "erfahrungen", totalRequired: 2, completed: 2 },
      { type: "PROFILE_CONFIRMED" },
      { type: "ROLES_CONFIRMED", clusterCount: 4 },
      { type: "SEARCH_EXECUTED", resultCount: 42 },
      { type: "JOB_SELECTED", jobId: "11111111-1111-1111-1111-111111111111" },
      { type: "APPLICATION_STARTED", applicationId: "22222222-2222-2222-2222-222222222222" },
      { type: "DOCUMENTS_READY" },
      { type: "APPLICATION_APPROVED" },
      { type: "REDIRECTED_TO_SOURCE" },
      { type: "APPLICATION_SUBMITTED" },
    ]);

    expect(state.stage).toBe("APPLICATION_TRACKING");
    expect(state.lastCompletedAction).toBe("Bewerbung versendet");
    expect(state.selectedJobIds).toHaveLength(1);
  });

  it("bleibt im Gespräch, solange Themen fehlen", () => {
    const state = run([
      { type: "ACCOUNT_COMPLETED" },
      { type: "INTERVIEW_STAGE_COMPLETED", stageKey: "ausbildung", totalRequired: 5, completed: 2 },
    ]);
    expect(state.stage).toBe("CAREER_INTERVIEW");
    expect(state.nextRecommendedAction).toContain("Noch 3 Themen");
  });

  it("zählt dieselbe Stelle nicht zweimal", () => {
    // Ein doppelt abgeschickter Klick ist der Normalfall, nicht die
    // Ausnahme. Der Automat muss ihn aushalten.
    const id = "33333333-3333-3333-3333-333333333333";
    const once = transition(initialState(), { type: "JOB_SELECTED", jobId: id });
    const twice = transition(once, { type: "JOB_SELECTED", jobId: id });

    expect(twice.selectedJobIds).toEqual([id]);
    expect(twice.version).toBe(once.version);
  });

  it("verliert keinen Fortschritt durch ein spätes Ereignis", () => {
    // Ein verzoegertes Ereignis aus einem frueheren Schritt darf den
    // Vorgang nicht zurueckwerfen.
    const advanced = run([
      { type: "ACCOUNT_COMPLETED" },
      { type: "PROFILE_CONFIRMED" },
      { type: "ROLES_CONFIRMED", clusterCount: 3 },
    ]);
    const late = transition(advanced, { type: "INTERVIEW_STARTED" });
    expect(late.stage).toBe("JOB_SEARCH");
  });

  it("geht nur auf ausdrücklichen Wunsch zurück", () => {
    const advanced = run([{ type: "ACCOUNT_COMPLETED" }, { type: "PROFILE_CONFIRMED" }]);
    const back = transition(advanced, { type: "USER_JUMPED_BACK", stage: "CAREER_INTERVIEW" });
    expect(back.stage).toBe("CAREER_INTERVIEW");
  });

  it("zählt die Fassung bei jeder echten Änderung hoch", () => {
    // Zwei Geraete, die gleichzeitig weiterschalten, duerfen sich nicht
    // gegenseitig ueberschreiben. Die Fassung ist die Grundlage dafuer.
    const a = initialState();
    const b = transition(a, { type: "ACCOUNT_COMPLETED" });
    expect(b.version).toBe(a.version + 1);
  });
});

describe("Wiederaufnahme", () => {
  it("behauptet nichts, wofür kein Ereignis vorliegt", () => {
    const message = resumeMessage(initialState(), "Nina");
    expect(message).not.toContain("Zuletzt:");
    expect(message).toContain("anfangen");
  });

  it("nennt den letzten Schritt und den offenen", () => {
    const state = run([
      { type: "ACCOUNT_COMPLETED" },
      { type: "PROFILE_CONFIRMED" },
      { type: "ROLES_CONFIRMED", clusterCount: 3 },
      { type: "SEARCH_EXECUTED", resultCount: 12 },
      { type: "APPLICATION_STARTED", applicationId: "44444444-4444-4444-4444-444444444444" },
    ]);
    const message = resumeMessage(state, "Nina");
    expect(message).toContain("Zuletzt: Bewerbung begonnen");
    expect(message).toContain("Offen ist:");
    // Substantive bleiben groß. Der Satz geht ungefiltert an die
    // Person, und "Offen ist: bewerbung fortsetzen" liest sich wie ein
    // Fehler — weil es einer ist.
    expect(message).not.toMatch(/Offen ist: [a-zäöü]/);
  });
});
