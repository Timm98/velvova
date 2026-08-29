import { describe, expect, it } from "vitest";
import { TOOL_DESCRIPTIONS, TOOL_NAMES, WRITING_TOOLS, validateToolCall } from "./tools.ts";

/**
 * Die Werkzeugschicht.
 *
 * Geprüft wird vor allem, was NICHT durchkommen darf. Ein Modell, das
 * einen Statuswert oder eine fremde Nutzerkennung mitschickt, ist kein
 * theoretischer Fall — es ist der Normalfall, sobald ein Gespräch lang
 * genug wird.
 */

describe("validateToolCall", () => {
  it("nimmt einen gültigen Aufruf an", () => {
    const result = validateToolCall("save_interview_answer", {
      stage: "experience_episodes",
      questionKey: "first_situation",
      answer: "Ich habe eine Eskalation übernommen und bis zur Lösung begleitet.",
    });
    expect(result.ok).toBe(true);
  });

  it("weist ein unbekanntes Werkzeug ab und kennzeichnet es als solches", () => {
    const result = validateToolCall("delete_all_user_data", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unknown).toBe(true);
      expect(result.error).toContain("Unbekanntes Werkzeug");
    }
  });

  it("weist eine leere Antwort ab", () => {
    const result = validateToolCall("save_interview_answer", {
      stage: "background",
      questionKey: null,
      answer: "",
    });
    expect(result.ok).toBe(false);
  });

  it("lässt das Modell den Status einer Aussage nicht setzen", () => {
    // Der entscheidende Test: was das Modell ableitet, ist unbestätigt.
    // Auf "confirmed" setzt ausschliesslich ein Mensch. Ein
    // mitgeschickter Status darf deshalb nicht durchschlagen.
    const result = validateToolCall("create_or_update_evidence", {
      statement: "Kann komplexe Sachverhalte erklären",
      status: "confirmed",
      confidence: 0.9,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input).not.toHaveProperty("status");
    }
  });

  it("nimmt keine fremde Nutzerkennung entgegen", () => {
    // Die Kennung kommt aus der Sitzung, nie aus dem Aufruf. Zod
    // entfernt unbekannte Felder - genau darauf verlaesst sich die
    // Ausfuehrung.
    const result = validateToolCall("save_job", {
      jobId: "6f1c6b6e-9a5e-4c2b-9a1e-2f0d1c3b4a5e",
      userId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input).not.toHaveProperty("userId");
  });

  it("begrenzt die Trefferzahl einer Suche", () => {
    const tooMany = validateToolCall("search_jobs", { limit: 5000 });
    expect(tooMany.ok).toBe(false);
  });

  it("verlangt für eine Änderung an Bedingungen eine Begründung", () => {
    // Gehalt, Ort und Arbeitszeit sind Entscheidungsbedingungen. Wer sie
    // aendert, muss sagen warum - die Person bekommt das zu lesen.
    const withoutReason = validateToolCall("update_user_preference", {
      field: "desired_salary_min",
      value: 30000,
    });
    expect(withoutReason.ok).toBe(false);

    const withReason = validateToolCall("update_user_preference", {
      field: "desired_salary_min",
      value: 48000,
      rationale: "Du hast gesagt, unter 48.000 € kommt für dich nicht infrage.",
    });
    expect(withReason.ok).toBe(true);
  });

  it("erlaubt nur bekannte Einstellungsfelder", () => {
    const result = validateToolCall("update_user_preference", {
      field: "email",
      value: "fremd@example.invalid",
      rationale: "Versuch",
    });
    expect(result.ok).toBe(false);
  });
});

describe("Werkzeugliste", () => {
  it("beschreibt jedes Werkzeug", () => {
    for (const name of TOOL_NAMES) {
      expect(TOOL_DESCRIPTIONS[name], `Beschreibung für ${name} fehlt`).toBeTruthy();
    }
  });

  it("kennzeichnet jedes schreibende Werkzeug", () => {
    for (const name of WRITING_TOOLS) {
      expect(TOOL_NAMES).toContain(name);
    }
    // Lesende Werkzeuge duerfen nicht in der Schreibliste stehen: daran
    // haengt die Protokollierung und die Sitzungspruefung.
    for (const readOnly of ["search_jobs", "get_job_detail", "calculate_match"] as const) {
      expect(WRITING_TOOLS).not.toContain(readOnly);
    }
  });
});
