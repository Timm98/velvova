import { z } from "zod";
import { NINA_STAGES } from "./stages.ts";

/**
 * Was Monday außer der sichtbaren Antwort noch liefert.
 *
 * Die Extraktion läuft als eigener, günstiger Aufruf NACH dem
 * sichtbaren Strom. Das ist Absicht: die Person hat ihre Antwort dann
 * schon gelesen, und eine strukturierte Analyse davor würde nur
 * Wartezeit erzeugen, die niemand sieht und jeder spürt.
 *
 * Zwei Regeln, die alles andere tragen:
 *
 *   1. **Nichts hiervon geht ungeprüft in die Datenbank.** Der Server
 *      validiert, ordnet der Sitzung zu und legt alles als
 *      unbestätigte Hypothese ab. Bestätigen darf ausschließlich ein
 *      Mensch.
 *
 *   2. **Die Stufe ist ein Vorschlag.** Das Feld heißt deshalb
 *      `next_stage_suggestion` und nicht `next_stage`. Ein Modell, das
 *      seinen eigenen Fortschritt setzen darf, ist irgendwann fertig,
 *      ohne fertig zu sein.
 */

const KurzerSatz = z.string().min(3).max(300);

/*
 * Alles ist PFLICHT, nichts ist optional.
 *
 * Der strikte Modus der Responses-API verlangt, dass jeder Schlüssel in
 * `required` steht — sonst lehnt sie das Schema mit HTTP 400 ab, und
 * zwar bevor ein einziges Token entsteht. Genau das ist passiert: die
 * Auswertung schlug bei jedem Zug fehl, und von außen sah es aus, als
 * würde Monday sich nichts merken.
 *
 * Also: keine `.optional()`, keine `.default()` im Wire-Schema. Wo
 * wirklich nichts da sein kann, steht `.nullable()` — eine leere Liste
 * und ein `null` sind Ergebnisse, ein fehlender Schlüssel ist ein
 * Formatfehler.
 */

/**
 * Ein einzelner Fund.
 *
 * `evidence` ist Pflicht und darf nicht leer sein: eine Aussage über
 * einen Menschen ohne die Stelle, an der sie herkommt, ist eine
 * Behauptung. Genau daran soll sie scheitern.
 */
const Fund = z.object({
  statement: KurzerSatz,
  /** Wörtlicher Bezug auf das, was die Person gesagt hat. */
  evidence: z.string().min(3).max(400),
  /** Wie sicher, 0 bis 1. Das Modell darf unsicher sein. */
  confidence: z.number().min(0).max(1),
});

const Bedingung = Fund.extend({
  /*
   * Der Unterschied, der später über eine Bewerbung entscheidet.
   *
   * „Ich brauche mindestens 45.000" ist etwas anderes als „wäre schön".
   * Eine harte Bedingung darf nie stillschweigend gelockert werden — und
   * dafür muss sie als solche erkannt sein.
   */
  kind: z.enum(["hard", "strong_preference", "flexible_preference", "open_question"]),
});

const Rollenhypothese = z.object({
  role: z.string().min(2).max(120),
  group: z.enum(["adjacent", "neighbouring", "unusual"]),
  /** Welche bestätigte Erfahrung darauf hindeutet. */
  basedOn: z.string().min(3).max(400),
  /** Was anders wäre als bisher. */
  difference: z.string().max(400),
  /** Was fehlt. */
  gap: z.string().max(400),
  /** Wie man es klein ausprobiert. */
  smallTest: z.string().max(400),
  confidence: z.number().min(0).max(1),
});

const Extrakt = z.object({
  goals: z.array(Fund).max(5),
  career_evidence: z.array(Fund).max(8),
  skills: z.array(Fund).max(10),
  preferred_tasks: z.array(Fund).max(8),
  disliked_tasks: z.array(Fund).max(8),
  work_style_preferences: z.array(Fund).max(8),
  values: z.array(Fund).max(8),
  constraints: z.array(Bedingung).max(8),
  role_hypotheses: z.array(Rollenhypothese).max(6),
  contradictions: z.array(KurzerSatz).max(5),
  open_questions: z.array(KurzerSatz).max(5),
});

export const NinaTurnSchema = z.object({
  /**
   * Die verdichtete Fassung der sichtbaren Antwort.
   *
   * Nicht die Antwort selbst — die kam schon im Strom. Hier steht, was
   * inhaltlich passiert ist, damit spätere Züge daran anknüpfen können,
   * ohne den ganzen Verlauf zu laden.
   */
  assistant_summary: z.string().max(600),

  current_stage: z.enum(NINA_STAGES),
  /** Ein Vorschlag. Die Anwendung entscheidet. `null` heißt: bleiben. */
  next_stage_suggestion: z.enum(NINA_STAGES).nullable(),
  next_question: z.string().max(500),

  extracted: Extrakt,

  /** Aussagen, die der Mensch bestätigen soll, bevor sie zählen. */
  confirmation_required: z.array(KurzerSatz).max(6),

  /** Einschätzung des Modells. Der Server rechnet eigenständig nach. */
  profile_completeness: z.number().min(0).max(100),

  job_readiness: z.object({
    state: z.enum(["not_ready", "exploratory", "ready"]),
    score: z.number().min(0).max(100),
    missing_information: z.array(KurzerSatz).max(8),
    reason: z.string().max(400),
  }),

  recommended_action: z.enum([
    "ask",
    "clarify",
    "summarize",
    "confirm",
    "offer_jobs",
    "show_jobs",
    "continue_profile",
    "start_application",
    "pause",
  ]),
});

export type NinaTurn = z.infer<typeof NinaTurnSchema>;
export type NinaExtraction = NinaTurn["extracted"];
export type NinaFinding = z.infer<typeof Fund>;
export type NinaConstraint = z.infer<typeof Bedingung>;
export type NinaRoleHypothesis = z.infer<typeof Rollenhypothese>;

/**
 * Die Anweisung für den Extraktionslauf.
 *
 * Getrennt vom Gesprächsprompt, weil es eine andere Aufgabe ist: dort
 * spricht Monday mit einem Menschen, hier liest ein Modell ein Protokoll.
 * Beides in einen Prompt zu packen macht beides schlechter.
 */
export const EXTRACTION_SYSTEM_DE = `Du liest einen Gesprächsausschnitt zwischen einer Karrierebegleitung und einem Menschen und hältst fest, was daraus über den Menschen hervorgeht.

Du sprichst niemanden an. Du erzeugst ausschließlich strukturierte Daten.

REGELN

1. Halte nur fest, was der Mensch SELBST gesagt hat. Nichts ableiten, was
   er nicht gesagt hat.
2. Zu jedem Fund gehört ein wörtlicher Beleg aus seiner Antwort. Ohne
   Beleg kein Fund.
3. Erfinde nichts: keine Erfahrungen, Fähigkeiten, Abschlüsse, Zahlen,
   Gehälter, Unternehmen, Ergebnisse.
4. Leite keine geschützten Merkmale ab — nicht aus Namen, Schreibstil,
   Ort oder Formulierung.
5. Unterscheide harte Bedingung, starke Präferenz, flexible Präferenz und
   offene Frage. Im Zweifel die schwächere Einstufung.
6. Sei bei der Konfidenz ehrlich. Eine beiläufige Erwähnung ist keine 0,9.
7. Findest du zu einem Feld nichts, lasse die Liste leer. Eine leere
   Liste ist ein Ergebnis, kein Fehler.
8. `+"`next_stage_suggestion`"+` ist ein Vorschlag. Die Anwendung entscheidet.
9. Markiere Widersprüche, statt sie aufzulösen.
10. Trage in `+"`confirmation_required`"+` nur Aussagen ein, die für das
    Profil wirklich zählen — nicht jede Nebenbemerkung.`;

export const EXTRACTION_SYSTEM_EN = `You read an excerpt of a conversation between a career companion and a person, and record what it establishes about that person.

You address nobody. You produce structured data only.

RULES

1. Record only what the person said themselves. Infer nothing they did
   not say.
2. Every finding needs a verbatim piece of evidence from their answer.
   No evidence, no finding.
3. Invent nothing: no experience, skills, qualifications, figures,
   salaries, companies or results.
4. Infer no protected characteristics — not from name, writing style,
   location or phrasing.
5. Distinguish hard constraint, strong preference, flexible preference
   and open question. When in doubt, the weaker classification.
6. Be honest about confidence. A passing mention is not 0.9.
7. If you find nothing for a field, leave the list empty. An empty list
   is a result, not a failure.
8. next_stage_suggestion is a suggestion. The application decides.
9. Flag contradictions instead of resolving them.
10. Put only statements that genuinely matter for the profile into
    confirmation_required.`;
