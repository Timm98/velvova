import { z } from "zod";

/**
 * Ninas Werkzeuge.
 *
 * Das ist die vollständige Liste dessen, was die Assistenz an Daten
 * verändern darf. Alles andere kann sie nicht — nicht weil der Prompt
 * es untersagt, sondern weil es kein Werkzeug dafür gibt.
 *
 * Der Unterschied ist entscheidend. Ein Prompt ist eine Bitte; ein
 * fehlendes Werkzeug ist eine Wand. Ein Modell, das angewiesen wurde,
 * nichts zu erfinden, erfindet gelegentlich trotzdem. Ein Modell ohne
 * Schreibzugriff auf ein Feld kann dieses Feld nicht falsch füllen.
 *
 * Drei Regeln für jedes Werkzeug hier:
 *
 *   1. Die Eingabe wird serverseitig gegen das Zod-Schema geprüft, bevor
 *      irgendetwas geschieht. Was das Modell schickt, ist ein Vorschlag.
 *   2. Die Nutzerkennung kommt NIE aus dem Werkzeugaufruf, sondern immer
 *      aus der Sitzung. Sonst könnte ein manipuliertes Gespräch in
 *      fremde Daten schreiben.
 *   3. Alles, was das Modell ableitet, entsteht im Zustand "inferred".
 *      Auf "confirmed" setzt ausschließlich ein Mensch.
 */

/** Der Zustand einer Aussage. Nur "confirmed" zählt in Empfehlungen. */
export const EvidenceStatusSchema = z.enum([
  "confirmed",
  "inferred",
  "needs_evidence",
  "rejected",
]);

export const ToolSchemas = {
  /**
   * Eine Antwort im Gespräch festhalten. Wortlaut unverändert — die
   * eigenen Worte der Person sind der Beleg, nicht die Zusammenfassung
   * des Modells.
   */
  save_interview_answer: z.object({
    stage: z.string().min(1).max(64),
    questionKey: z.string().max(120).nullable(),
    answer: z.string().min(1).max(8000),
  }),

  /**
   * Eine Aussage anlegen oder ändern.
   *
   * `status` fehlt hier absichtlich: das Modell darf ihn nicht setzen.
   * Was es anlegt, ist "inferred". Punkt.
   */
  create_or_update_evidence: z.object({
    id: z.string().uuid().optional(),
    statement: z.string().min(3).max(600),
    kind: z
      .enum(["strength", "experience", "preference", "value", "constraint", "interest"])
      .default("strength"),
    situation: z.string().max(1200).nullable().optional(),
    task: z.string().max(1200).nullable().optional(),
    action: z.string().max(1200).nullable().optional(),
    result: z.string().max(1200).nullable().optional(),
    sourceRef: z.string().max(200).nullable().optional(),
    confidence: z.number().min(0).max(1).default(0.5),
  }),

  /**
   * Eine Einstellung ändern.
   *
   * Bewusst eng: Gehalt, Ort, Arbeitszeit und Remote-Anteil sind
   * Entscheidungsbedingungen. Ein Modell, das sie beiläufig anpassen
   * kann, verschiebt am Ende die Grenzen, die jemand gezogen hat.
   */
  update_user_preference: z.object({
    field: z.enum([
      "location_text",
      "search_radius_km",
      "max_commute_minutes",
      "remote_preference",
      "employment_types",
      "desired_salary_min",
      "relocation_willingness",
    ]),
    value: z.union([z.string().max(200), z.number(), z.array(z.string().max(64)).max(12)]),
    /** Warum diese Änderung — wird der Person angezeigt, bevor sie greift. */
    rationale: z.string().min(3).max(300),
  }),

  /** Einen Profilentwurf erzeugen. Er gilt erst nach Bestätigung. */
  generate_career_profile_draft: z.object({
    careerCompass: z.string().min(20).max(800),
    roleClusters: z
      .array(
        z.object({
          title: z.string().min(2).max(120),
          kind: z.enum(["obvious", "adjacent", "niche"]),
          rationale: z.string().min(10).max(800),
          gaps: z.array(z.string().max(200)).max(8).default([]),
          entryRealism: z.enum(["direct", "with_bridge", "longer_path", "unclear"]),
          nextValidationStep: z.string().max(300),
        }),
      )
      .min(1)
      .max(5),
    openQuestions: z.array(z.string().max(300)).max(10).default([]),
  }),

  /**
   * Eine Aussage bestätigen.
   *
   * Auch dieses Werkzeug setzt nichts allein: es legt der Person die
   * Bestätigung vor. Der Server verweigert jede Statusänderung, die
   * nicht aus einer Nutzerhandlung stammt.
   */
  confirm_profile_item: z.object({
    evidenceId: z.string().uuid(),
    proposedStatus: EvidenceStatusSchema,
    reason: z.string().max(400),
  }),

  /** Stellen suchen. Harte Bedingungen kommen aus dem Profil, nicht von hier. */
  search_jobs: z.object({
    query: z.string().max(400).optional(),
    remoteType: z.enum(["on_site", "hybrid", "remote"]).optional(),
    employmentType: z.string().max(64).optional(),
    postedWithinDays: z.number().int().min(1).max(180).optional(),
    limit: z.number().int().min(1).max(20).default(8),
  }),

  get_job_detail: z.object({ jobId: z.string().uuid() }),

  save_job: z.object({ jobId: z.string().uuid(), note: z.string().max(500).optional() }),

  /**
   * Passung berechnen.
   *
   * Das Modell stößt die Berechnung an — es rechnet nicht. Der Wert
   * entsteht deterministisch im Code. Ein Modell, das seinen eigenen
   * Score erfindet, ist kein Matching, sondern eine Meinung mit
   * Nachkommastelle.
   */
  calculate_match: z.object({ jobId: z.string().uuid() }),

  create_application: z.object({ jobId: z.string().uuid() }),

  /** Einen Dokumententwurf erzeugen. Jede Aussage braucht einen Beleg. */
  generate_document_draft: z.object({
    applicationId: z.string().uuid(),
    kind: z.enum(["cv_ats", "cover_letter", "application_email"]),
    locale: z.enum(["de", "en"]).default("de"),
  }),

  schedule_follow_up: z.object({
    applicationId: z.string().uuid(),
    dueAt: z.string().datetime(),
    label: z.string().min(3).max(200),
  }),
} as const;

export type ToolName = keyof typeof ToolSchemas;

export const TOOL_NAMES = Object.keys(ToolSchemas) as ToolName[];

/** Was ein Werkzeug tut — für die Beschreibung gegenüber dem Modell. */
export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  save_interview_answer:
    "Hält die Antwort der Person im Wortlaut fest. Nutze das nach jeder inhaltlichen Antwort.",
  create_or_update_evidence:
    "Legt eine abgeleitete Aussage an. Sie gilt als unbestätigt, bis die Person sie bestätigt.",
  update_user_preference:
    "Ändert eine Suchbedingung. Nur nach ausdrücklicher Aussage der Person, nie aus einer Vermutung.",
  generate_career_profile_draft:
    "Erzeugt einen Profilentwurf mit Rollenclustern. Er wird der Person zur Prüfung vorgelegt.",
  confirm_profile_item:
    "Schlägt eine Statusänderung an einer Aussage vor. Wirksam wird sie erst durch die Person.",
  search_jobs: "Sucht in den gespeicherten echten Stellen.",
  get_job_detail: "Lädt die Einzelheiten einer Stelle.",
  save_job: "Merkt eine Stelle für die Person vor.",
  calculate_match: "Stößt die Berechnung der Passung an. Der Wert entsteht im Code, nicht im Modell.",
  create_application: "Legt eine Bewerbung im Zustand „in Vorbereitung“ an. Versendet nichts.",
  generate_document_draft:
    "Erzeugt einen Dokumententwurf. Jede Tatsachenbehauptung braucht einen Beleg.",
  schedule_follow_up: "Legt eine Erinnerung zu einer Bewerbung an.",
};

/**
 * Werkzeuge, die schreiben. Sie brauchen eine angemeldete Sitzung und
 * werden protokolliert.
 */
export const WRITING_TOOLS: ToolName[] = [
  "save_interview_answer",
  "create_or_update_evidence",
  "update_user_preference",
  "generate_career_profile_draft",
  "confirm_profile_item",
  "save_job",
  "create_application",
  "generate_document_draft",
  "schedule_follow_up",
];

export interface ToolCall {
  id: string;
  name: ToolName;
  input: unknown;
}

export interface ToolResult {
  id: string;
  name: ToolName;
  ok: boolean;
  /** Was der Person angezeigt wird, während das Werkzeug läuft. */
  status: string;
  output?: unknown;
  error?: string;
}

/**
 * Prüft einen Werkzeugaufruf, bevor er ausgeführt wird.
 *
 * Zwei Fehlerarten werden hier unterschieden, und das ist wichtig: ein
 * unbekannter Name ist ein Versuch, etwas zu tun, das es nicht gibt —
 * eine ungültige Eingabe ist ein Formfehler. Der erste Fall wird
 * protokolliert, der zweite an das Modell zurückgegeben.
 */
export function validateToolCall(
  name: string,
  input: unknown,
): { ok: true; name: ToolName; input: unknown } | { ok: false; error: string; unknown: boolean } {
  if (!(name in ToolSchemas)) {
    return { ok: false, unknown: true, error: `Unbekanntes Werkzeug: ${name}` };
  }

  const schema = ToolSchemas[name as ToolName];
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      unknown: false,
      error: `Ungültige Eingabe für ${name}: ${first?.path.join(".")} — ${first?.message}`,
    };
  }

  return { ok: true, name: name as ToolName, input: parsed.data };
}
