import { describe, expect, it } from "vitest";
import {
  autoAdvance,
  canAdvance,
  completedGroups,
  resolveStage,
  type StageEvidence,
} from "./stages.ts";
import { evaluateReadiness, looksLikeJobRequest, type ReadinessInput } from "./readiness.ts";
import { NinaTurnSchema } from "./turn-schema.ts";

const LEER: StageEvidence = {
  goals: 0, careerEvidence: 0, skills: 0, preferredTasks: 0, dislikedTasks: 0,
  workStyle: 0, values: 0, constraints: 0, roleHypotheses: 0, confirmed: 0,
  hasLocation: false, hasRemotePreference: false,
};

function mit(patch: Partial<ReadinessInput> = {}): ReadinessInput {
  return { ...LEER, userAgreedToSeeJobs: false, userExplicitlyAskedForJobs: false, ...patch };
}

/* ── Stufen ─────────────────────────────────────────────────────── */

describe("Stufenmaschine", () => {
  it("lässt das Modell nicht über Stufen springen", () => {
    // Der teuerste Fehler: ein Modell erklärt sich für fertig und
    // empfiehlt danach Jobs, die auf nichts beruhen.
    const r = canAdvance("orientation", "job_ready", LEER);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Sprung");
  });

  it("lässt keinen Schritt vorwärts, solange die Stufe leer ist", () => {
    expect(canAdvance("evidence_discovery", "task_preferences", LEER).allowed).toBe(false);
  });

  it("lässt einen Schritt vorwärts, wenn die Anforderung erfüllt ist", () => {
    const e = { ...LEER, careerEvidence: 2, skills: 1 };
    expect(canAdvance("evidence_discovery", "task_preferences", e).allowed).toBe(true);
  });

  it("erlaubt Rückwärts immer", () => {
    // Wer korrigieren will, muss zurück können. Ein Automat, der das
    // verweigert, zwingt zum Neuanfang.
    expect(canAdvance("validation", "orientation", LEER).allowed).toBe(true);
  });

  it("behält die Stufe bei einem unzulässigen Vorschlag bei", () => {
    const r = resolveStage("orientation", "job_search", LEER);
    expect(r.stage).toBe("orientation");
    expect(r.changed).toBe(false);
  });

  it("ignoriert einen fehlenden Vorschlag, statt zu raten", () => {
    expect(resolveStage("work_style", null, LEER).stage).toBe("work_style");
  });

  it("meldet abgeschlossene Gruppen für die ruhige Übersicht", () => {
    const e = { ...LEER, goals: 1, preferredTasks: 2, dislikedTasks: 1 };
    expect(completedGroups(e)).toContain("goal");
    expect(completedGroups(e)).toContain("tasks");
    expect(completedGroups(e)).not.toContain("experience");
  });
});

/* ── Jobreife: genau die Fälle aus der Vorgabe ──────────────────── */

describe("JobSearchReadinessEngine", () => {
  it("A — nur ein Ziel genannt: keine gerankte Jobliste", () => {
    const r = evaluateReadiness(mit({ goals: 1 }));
    expect(r.state).toBe("not_ready");
    expect(r.missing.length).toBeGreaterThan(3);
  });

  it("B — Ziel, Standort und zwei Präferenzen: frühe Exploration", () => {
    const r = evaluateReadiness(
      mit({ goals: 1, hasLocation: true, hasRemotePreference: true, preferredTasks: 2, careerEvidence: 2 }),
    );
    expect(r.state).toBe("exploratory");
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.score).toBeLessThan(70);
  });

  it("C — vollständiges Profil mit Zustimmung: Monday darf Jobs anbieten", () => {
    const r = evaluateReadiness(
      mit({
        goals: 1, hasLocation: true, hasRemotePreference: true,
        careerEvidence: 3, skills: 2, preferredTasks: 2, dislikedTasks: 1,
        values: 2, constraints: 1, roleHypotheses: 1, confirmed: 2,
        userAgreedToSeeJobs: true,
      }),
    );
    expect(r.state).toBe("ready");
    expect(r.minimumMet).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("C ohne Zustimmung: nicht ready, egal wie vollständig", () => {
    // Zustimmung ist Voraussetzung, nicht Bonus. Ohne sie zeigt Monday
    // nichts bildschirmfüllend an.
    const r = evaluateReadiness(
      mit({
        goals: 1, hasLocation: true, hasRemotePreference: true,
        careerEvidence: 5, skills: 5, preferredTasks: 4, dislikedTasks: 2,
        values: 3, constraints: 2, roleHypotheses: 2, confirmed: 3,
        userAgreedToSeeJobs: false,
      }),
    );
    expect(r.minimumMet).toBe(false);
    expect(r.state).not.toBe("ready");
  });

  it("D — Nutzer verlangt früh Jobs: Vorschläge mit offener Unsicherheit", () => {
    const r = evaluateReadiness(mit({ goals: 1, userExplicitlyAskedForJobs: true }));
    expect(r.state).toBe("exploratory");
    // Entscheidend: die Unsicherheit wird benannt, nicht verschwiegen.
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.reason).toContain("verlässlichere");
  });

  it("die Punktzahl lässt sich aus den Beiträgen nachrechnen", () => {
    const r = evaluateReadiness(mit({ goals: 1, hasLocation: true }));
    expect(r.breakdown.reduce((s, b) => s + b.points, 0)).toBe(r.score);
    expect(r.breakdown.every((b) => b.points <= b.max)).toBe(true);
  });

  it("erkennt eine ausdrückliche Jobanfrage", () => {
    expect(looksLikeJobRequest("Zeig mir Jobs")).toBe(true);
    expect(looksLikeJobRequest("kannst du mir passende Stellen zeigen?")).toBe(true);
    expect(looksLikeJobRequest("Ich habe fünf Jahre im Kundenservice gearbeitet")).toBe(false);
    // Wichtig: kein Fehlalarm bei einer Erzählung über den alten Job.
    expect(looksLikeJobRequest("In meinem letzten Job war ich Teamleiterin")).toBe(false);
  });
});

/* ── Strukturierte Ausgabe ──────────────────────────────────────── */

describe("NinaTurnSchema", () => {
  /* Das Wire-Schema kennt keine optionalen Felder: der strikte Modus
     der Responses-API verlangt jeden Schlüssel in `required`, sonst
     lehnt sie das Schema mit HTTP 400 ab — bevor ein Token entsteht. */
  const VOLLSTAENDIG = {
    assistant_summary: "",
    current_stage: "orientation" as const,
    next_stage_suggestion: null,
    next_question: "",
    extracted: {
      goals: [], career_evidence: [], skills: [], preferred_tasks: [],
      disliked_tasks: [], work_style_preferences: [], values: [],
      constraints: [], role_hypotheses: [], contradictions: [], open_questions: [],
    },
    confirmation_required: [],
    profile_completeness: 0,
    job_readiness: { state: "not_ready" as const, score: 0, missing_information: [], reason: "" },
    recommended_action: "ask" as const,
  };

  it("nimmt eine vollständige Ausgabe an", () => {
    const r = NinaTurnSchema.parse(VOLLSTAENDIG);
    expect(r.recommended_action).toBe("ask");
    expect(r.next_stage_suggestion).toBeNull();
  });

  it("lehnt eine Ausgabe mit fehlendem Schlüssel ab", () => {
    // Genau das ist der Fall, den der strikte Modus verhindert — und
    // den unsere Prüfung danach noch einmal abfängt.
    expect(NinaTurnSchema.safeParse({ current_stage: "orientation" }).success).toBe(false);
  });

  it("verwirft einen Fund ohne Beleg", () => {
    // Eine Aussage über einen Menschen ohne die Stelle, an der sie
    // herkommt, ist eine Behauptung. Genau daran soll sie scheitern.
    const r = NinaTurnSchema.safeParse({
      ...VOLLSTAENDIG,
      current_stage: "evidence_discovery",
      extracted: {
        ...VOLLSTAENDIG.extracted,
        skills: [{ statement: "Kann gut moderieren", evidence: "", confidence: 0.8 }],
      },
    });
    expect(r.success).toBe(false);
  });

  it("verwirft eine erfundene Stufe", () => {
    expect(
      NinaTurnSchema.safeParse({ ...VOLLSTAENDIG, current_stage: "weltherrschaft" }).success,
    ).toBe(false);
  });

  it("verlangt bei einer Bedingung die Einstufung", () => {
    const basis = { ...VOLLSTAENDIG, current_stage: "constraints" as const };

    const ohne = NinaTurnSchema.safeParse({
      ...basis,
      extracted: {
        ...VOLLSTAENDIG.extracted,
        constraints: [
          { statement: "Mindestens 45.000", evidence: "mindestens 45.000", confidence: 0.9 },
        ],
      },
    });
    expect(ohne.success).toBe(false);

    const mitArt = NinaTurnSchema.safeParse({
      ...basis,
      extracted: {
        ...VOLLSTAENDIG.extracted,
        constraints: [
          {
            statement: "Mindestens 45.000",
            evidence: "mindestens 45.000",
            confidence: 0.9,
            kind: "hard",
          },
        ],
      },
    });
    expect(mitArt.success).toBe(true);
  });
});

describe("Automatischer Fortschritt", () => {
  it("rückt ohne Modellvorschlag nach, wenn die Stufe erfüllt ist", () => {
    // Der Fehler, der das nötig machte: das Modell schlägt fast nie eine
    // Stufe vor. Ohne diese Regel stand das Gespräch bei 97 von 100
    // Reifepunkten immer noch in „orientation".
    const e = { ...LEER, goals: 2 };
    expect(resolveStage("orientation", null, e).stage).toBe("current_situation");
  });

  it("bleibt stehen, solange die Stufe nicht erfüllt ist", () => {
    expect(resolveStage("evidence_discovery", null, LEER).stage).toBe("evidence_discovery");
  });

  it("rückt bei einem zu weiten Vorschlag trotzdem einen Schritt", () => {
    const e = { ...LEER, goals: 2 };
    const r = resolveStage("orientation", "job_search", e);
    expect(r.stage).toBe("current_situation");
    expect(r.changed).toBe(true);
  });

  it("läuft nicht über job_ready hinaus", () => {
    // Suche, Bewerbung und Nachfassen hängen an Handlungen, nicht an
    // Wissen. Sie automatisch weiterzuschalten hieße, jemandem eine
    // Bewerbung anzudichten.
    const voll = {
      ...LEER, goals: 3, careerEvidence: 5, skills: 5, preferredTasks: 4,
      dislikedTasks: 2, workStyle: 2, values: 3, constraints: 2,
      roleHypotheses: 2, confirmed: 3, hasLocation: true, hasRemotePreference: true,
    };
    expect(autoAdvance("job_ready", voll)).toBe("job_ready");
  });
});
