/**
 * Mondays Gesprächsstufen.
 *
 * Der entscheidende Satz steht ganz oben, weil alles andere daraus
 * folgt: **das Modell darf die nächste Stufe vorschlagen, entscheiden
 * darf nur der Server.**
 *
 * Ein Modell, das seinen eigenen Fortschritt bestimmt, springt weiter —
 * nicht aus Bosheit, sondern weil es hilfsbereit sein will und ein
 * abgeschlossenes Gespräch nach Erfolg aussieht. Es würde nach drei
 * Antworten „Profil steht“ melden und danach Jobs empfehlen, die auf
 * nichts beruhen.
 *
 * Deshalb ist dieses Modul reine Logik ohne Datenbankzugriff: Zustand
 * kommt herein, Entscheidung geht heraus. Dadurch ist die Regel
 * prüfbar, ohne dass eine Datenbank läuft — und sie steht an einer
 * Stelle statt verteilt über Route Handler.
 */

export const NINA_STAGES = [
  /** Warum bist du hier, was soll sich ändern? */
  "orientation",
  /** Wo stehst du gerade — Rolle, Situation, Dringlichkeit? */
  "current_situation",
  /** Konkrete Situationen, aus denen sich Fähigkeiten ablesen lassen. */
  "evidence_discovery",
  /** Was gern, was ungern, was lernen, was vermeiden? */
  "task_preferences",
  /** Wie arbeitest du am besten — Team, Führung, Tempo, Umgebung? */
  "work_style",
  /** Was ist wichtig, und was gibst du wofür auf? */
  "values_and_tradeoffs",
  /** Harte Bedingungen: Ort, Zeit, Geld, Gesundheit, Familie. */
  "constraints",
  /** Welche Rollen kommen infrage — naheliegend, angrenzend, ungewöhnlich? */
  "role_hypotheses",
  /** Der Mensch bestätigt, korrigiert oder verwirft. */
  "validation",
  /** Genug verstanden, um sinnvoll zu suchen. */
  "job_ready",
  "job_search",
  "application",
  "follow_up",
  /** Nach der Einstellung: Weiterentwicklung statt Suche. */
  "career_mode",
] as const;

export type NinaStage = (typeof NINA_STAGES)[number];

/** Menschliche Statuszeile. Kein „Frage 3 von 40“. */
export const STAGE_STATUS_DE: Record<NinaStage, string> = {
  orientation: "Wir klären gerade, worum es dir geht",
  current_situation: "Wir schauen, wo du gerade stehst",
  evidence_discovery: "Wir sammeln konkrete Beispiele",
  task_preferences: "Wir lernen gerade deine Arbeitsweise kennen",
  work_style: "Wir schauen, wie du am besten arbeitest",
  values_and_tradeoffs: "Wir klären, was dir wirklich wichtig ist",
  constraints: "Wir halten deine Rahmenbedingungen fest",
  role_hypotheses: "Dein Profil wird klarer — wir suchen Richtungen",
  validation: "Kurze Zwischenprüfung: stimmt das so?",
  job_ready: "Dein Profil trägt — ich kann jetzt gezielt suchen",
  job_search: "Wir schauen uns passende Stellen an",
  application: "Wir bereiten deine Bewerbung vor",
  follow_up: "Wir halten deine Bewerbungen im Blick",
  career_mode: "Wir arbeiten an deiner Weiterentwicklung",
};

/**
 * Die Übersicht unter „Fortschritt ansehen“.
 *
 * Sechs Gruppen, nicht vierzehn Stufen. Die Stufen sind ein internes
 * Werkzeug; wer sie als Liste zu sehen bekommt, arbeitet einen
 * Fragebogen ab — und genau das soll es nicht sein.
 */
export const PROGRESS_GROUPS = [
  { key: "goal", label: "Ziel", stages: ["orientation", "current_situation"] },
  { key: "experience", label: "Erfahrungen", stages: ["evidence_discovery"] },
  { key: "tasks", label: "Tätigkeiten", stages: ["task_preferences"] },
  { key: "style", label: "Arbeitsweise", stages: ["work_style"] },
  { key: "conditions", label: "Bedingungen", stages: ["values_and_tradeoffs", "constraints"] },
  { key: "directions", label: "Berufliche Richtungen", stages: ["role_hypotheses", "validation"] },
] as const satisfies readonly {
  key: string;
  label: string;
  stages: readonly NinaStage[];
}[];

/**
 * Was eine Stufe braucht, bevor sie als erledigt gilt.
 *
 * Bewusst Mindestmengen und keine Prozentzahl: „zwei bevorzugte
 * Tätigkeiten“ lässt sich nachzählen, „70 % Arbeitsweise“ nicht.
 */
export interface StageEvidence {
  goals: number;
  careerEvidence: number;
  skills: number;
  preferredTasks: number;
  dislikedTasks: number;
  workStyle: number;
  values: number;
  constraints: number;
  roleHypotheses: number;
  /** Vom Menschen bestätigte Aussagen. */
  confirmed: number;
  /** Hat er Ort bzw. Markt genannt? */
  hasLocation: boolean;
  /** Hat er zu Remote/Mobilität etwas gesagt? */
  hasRemotePreference: boolean;
}

const ANFORDERUNG: Partial<Record<NinaStage, (e: StageEvidence) => boolean>> = {
  orientation: (e) => e.goals >= 1,
  current_situation: (e) => e.goals >= 1,
  evidence_discovery: (e) => e.careerEvidence + e.skills >= 3,
  task_preferences: (e) => e.preferredTasks >= 2 && e.dislikedTasks >= 1,
  work_style: (e) => e.workStyle >= 1,
  values_and_tradeoffs: (e) => e.values >= 2,
  constraints: (e) => e.hasLocation && e.hasRemotePreference,
  role_hypotheses: (e) => e.roleHypotheses >= 1,
  validation: (e) => e.confirmed >= 1,
};

/**
 * Darf von `von` nach `nach` gewechselt werden?
 *
 * Drei Regeln:
 *
 *   1. Rückwärts ist immer erlaubt. Wer etwas korrigieren will, muss
 *      zurück können — und ein Automat, der das verweigert, zwingt
 *      Menschen dazu, das Gespräch neu zu beginnen.
 *   2. Vorwärts höchstens eine Stufe. Ein Sprung über drei Stufen ist
 *      kein Fortschritt, sondern eine übersprungene Frage.
 *   3. Vorwärts nur, wenn die aktuelle Stufe ihre Anforderung erfüllt.
 */
export function canAdvance(
  von: NinaStage,
  nach: NinaStage,
  evidence: StageEvidence,
): { allowed: boolean; reason: string } {
  const iVon = NINA_STAGES.indexOf(von);
  const iNach = NINA_STAGES.indexOf(nach);

  if (iNach < 0) return { allowed: false, reason: `Unbekannte Stufe „${nach}“.` };
  if (iNach === iVon) return { allowed: true, reason: "Gleiche Stufe." };
  if (iNach < iVon) return { allowed: true, reason: "Rückwärts ist immer erlaubt." };

  if (iNach > iVon + 1) {
    return {
      allowed: false,
      reason: `Sprung über ${iNach - iVon - 1} Stufe(n) — der Server erlaubt genau einen Schritt.`,
    };
  }

  const prüfung = ANFORDERUNG[von];
  if (prüfung && !prüfung(evidence)) {
    return { allowed: false, reason: `„${von}“ ist noch nicht erfüllt.` };
  }

  return { allowed: true, reason: "Anforderung erfüllt." };
}

/**
 * Die nächste gültige Stufe bestimmen.
 *
 * `vorschlag` kommt vom Modell und ist genau das: ein Vorschlag. Passt
 * er nicht, bleibt die Stufe stehen — es wird nicht ersatzweise
 * irgendwohin gesprungen.
 */
export function resolveStage(
  aktuell: NinaStage,
  vorschlag: NinaStage | null | undefined,
  evidence: StageEvidence,
): { stage: NinaStage; changed: boolean; reason: string } {
  // Ohne Vorschlag rückt der Server selbst nach, sofern die Stufe
  // erfüllt ist. Sonst stünde das Gespräch für immer still.
  if (!vorschlag) {
    const weiter = autoAdvance(aktuell, evidence);
    return {
      stage: weiter,
      changed: weiter !== aktuell,
      reason: weiter === aktuell ? "Kein Vorschlag, Stufe noch nicht erfüllt." : "Stufe erfüllt.",
    };
  }

  const prüfung = canAdvance(aktuell, vorschlag, evidence);
  if (!prüfung.allowed) {
    // Der Vorschlag greift zu weit — aber vielleicht ist der eine
    // Schritt erlaubt, den der Server ohnehin gehen würde.
    const weiter = autoAdvance(aktuell, evidence);
    return {
      stage: weiter,
      changed: weiter !== aktuell,
      reason: `${prüfung.reason}${weiter !== aktuell ? " Ein Schritt war trotzdem möglich." : ""}`,
    };
  }

  return { stage: vorschlag, changed: vorschlag !== aktuell, reason: prüfung.reason };
}

/**
 * Von selbst eine Stufe weiter, wenn die aktuelle erfüllt ist.
 *
 * Der Grund für diese Funktion ist ein Fehler, den man erst im Betrieb
 * sieht: das Modell schlägt fast nie eine neue Stufe vor. Es antwortet
 * hilfsbereit auf die Frage vor sich und hat keinen Anlass, den
 * Fortschritt zu verwalten. Ohne diese Funktion bleibt das Gespräch für
 * immer in `orientation` stehen — bei 97 von 100 Reifepunkten.
 *
 * Der Server besitzt die Stufe. Dann muss er sie auch bewegen.
 *
 * Höchstens ein Schritt je Zug, und nur bis `job_ready`: alles danach
 * (Suche, Bewerbung, Nachfassen) hängt an Handlungen, nicht an Wissen —
 * das automatisch weiterzuschalten hieße, jemandem eine Bewerbung
 * anzudichten.
 */
const LETZTE_AUTOMATISCHE: NinaStage = "job_ready";

export function autoAdvance(aktuell: NinaStage, evidence: StageEvidence): NinaStage {
  const i = NINA_STAGES.indexOf(aktuell);
  if (i < 0 || aktuell === LETZTE_AUTOMATISCHE) return aktuell;
  if (NINA_STAGES.indexOf(LETZTE_AUTOMATISCHE) <= i) return aktuell;

  const nächste = NINA_STAGES[i + 1]!;
  return canAdvance(aktuell, nächste, evidence).allowed ? nächste : aktuell;
}

/** Welche Gruppen sind abgeschlossen? Für die ruhige Fortschrittsübersicht. */
export function completedGroups(evidence: StageEvidence): string[] {
  return PROGRESS_GROUPS.filter((gruppe) =>
    gruppe.stages.every((s) => {
      const prüfung = ANFORDERUNG[s];
      return prüfung ? prüfung(evidence) : false;
    }),
  ).map((g) => g.key);
}

export function isNinaStage(value: unknown): value is NinaStage {
  return typeof value === "string" && (NINA_STAGES as readonly string[]).includes(value);
}
