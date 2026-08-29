import type { InterviewStage } from "@paycheck/domain";

/**
 * Der Fragenkatalog.
 *
 * Die Fragen sind bewusst nach Situation, Handlung und Ergebnis gebaut,
 * nicht nach Selbsteinschätzung. "Bist du gut im Organisieren?" liefert
 * eine Meinung; "Erzähl von etwas, das du organisiert hast" liefert
 * etwas, das man belegen und in eine Bewerbung schreiben kann.
 *
 * Jede Frage trägt einen stabilen Schlüssel. Der Text darf sich ändern,
 * der Schlüssel nicht - sonst brechen Auswertung und Verlauf.
 */

export interface Question {
  key: string;
  stage: InterviewStage;
  de: string;
  en: string;
  /** Vertiefung, wenn die Antwort zu allgemein bleibt. */
  followUpDe?: string;
  followUpEn?: string;
  /** Welche Art von Evidenz aus der Antwort entstehen kann. */
  yields: string[];
  /** Fragen, die bei fehlender Berufserfahrung an ihre Stelle treten. */
  noExperienceVariantDe?: string;
  noExperienceVariantEn?: string;
  optional?: boolean;
}

export const QUESTIONS: Question[] = [
  // --- Ziel ---
  { key: "goal_change", stage: "consent_and_goal", yields: ["motive", "preference"],
    de: "Was soll sich durch deine nächste berufliche Entscheidung konkret verändern?",
    en: "What should concretely change through your next career decision?",
    followUpDe: "Und woran würdest du merken, dass es sich verändert hat?",
    followUpEn: "And how would you notice that it had changed?" },

  // --- Aktuelle Lage ---
  { key: "current_role", stage: "current_situation", yields: ["experience_episode"],
    de: "Wo stehst du gerade beruflich - was machst du im Moment, und seit wann?",
    en: "Where are you right now - what are you doing, and since when?" },
  { key: "search_status", stage: "current_situation", yields: ["preference"],
    de: "Wie läuft deine Suche bisher? Wie viele Bewerbungen hast du ungefähr geschrieben, und was kam zurück?",
    en: "How has your search gone so far? Roughly how many applications, and what came back?" },

  // --- Hintergrund ---
  { key: "education", stage: "background", yields: ["qualification"],
    de: "Welche Ausbildung oder welches Studium hast du abgeschlossen oder bist du gerade dabei abzuschliessen?",
    en: "What training or degree have you completed, or are you about to complete?" },
  { key: "tools_and_methods", stage: "background", yields: ["tool", "knowledge"],
    de: "Welche Werkzeuge, Sprachen, Methoden oder Lizenzen beherrschst du - und welchen konkreten Beleg gibt es dafür?",
    en: "Which tools, languages, methods or licences do you know - and what concrete evidence is there?" },

  // --- Erfahrungsepisoden: der Kern ---
  { key: "lost_track_of_time", stage: "experience_episodes", yields: ["experience_episode", "action", "preference"],
    de: "Erzähl von einer Aufgabe, bei der du die Zeit vergessen hast. Was hast du dabei tatsächlich getan?",
    en: "Tell me about a task where you lost track of time. What did you actually do?",
    followUpDe: "Was genau war dabei dein eigener Anteil, und was haben andere gemacht?",
    followUpEn: "What exactly was your own part, and what did others do?",
    noExperienceVariantDe:
      "Erzähl von etwas - aus Studium, Ausbildung, Ehrenamt, einem Hobby oder zu Hause -, bei dem du die Zeit vergessen hast. Was hast du dabei getan?",
    noExperienceVariantEn:
      "Tell me about something - from study, training, volunteering, a hobby or at home - where you lost track of time. What did you do?" },
  { key: "solved_problem", stage: "experience_episodes", yields: ["experience_episode", "action", "result"],
    de: "Welches Problem hast du zuletzt selbstständig gelöst?",
    en: "What problem did you most recently solve on your own?",
    followUpDe: "Welche Schritte hast du dabei gewählt, und warum gerade diese?",
    followUpEn: "What steps did you choose, and why those?" },
  { key: "concrete_result", stage: "experience_episodes", yields: ["result"],
    de: "Welches konkrete Ergebnis ist daraus entstanden?",
    en: "What concrete outcome came out of it?",
    followUpDe: "Lässt sich das irgendwie beziffern oder zeigen - auch grob?",
    followUpEn: "Can that be quantified or shown somehow - even roughly?" },
  { key: "proud_of", stage: "experience_episodes", yields: ["result", "experience_episode"],
    de: "Auf welche Leistung der vergangenen zwei Jahre bist du besonders stolz?",
    en: "Which achievement from the past two years are you most proud of?",
    followUpDe: "Was war dabei genau dein eigener Anteil?",
    followUpEn: "What exactly was your own contribution?" },

  // --- Anerkennung von aussen ---
  { key: "asked_for_help", stage: "feedback_and_recognition", yields: ["skill"],
    de: "Wobei bitten dich andere regelmäßig um Hilfe?",
    en: "What do other people regularly ask you for help with?" },
  { key: "repeated_feedback", stage: "feedback_and_recognition", yields: ["skill"],
    de: "Welches positive Feedback hörst du wiederholt - und woran wurde es festgemacht?",
    en: "What positive feedback do you hear repeatedly - and what was it based on?" },
  { key: "easy_for_you", stage: "feedback_and_recognition", yields: ["skill"],
    de: "Welche Tätigkeit fällt dir leicht, die andere häufig schwierig finden?",
    en: "Which task comes easily to you that others often find difficult?",
    followUpDe: "Welchen Beleg oder welches Beispiel gibt es dafür?",
    followUpEn: "What evidence or example is there for that?" },

  // --- Energie ---
  { key: "draining_but_able", stage: "tasks_and_energy", yields: ["preference"],
    de: "Welche Aufgaben kannst du gut, obwohl sie dich viel Energie kosten?",
    en: "Which tasks do you do well even though they cost you a lot of energy?" },
  { key: "avoided_tasks", stage: "tasks_and_energy", yields: ["preference", "constraint"],
    de: "Welche Aufgaben vermeidest du - und was genau stört dich daran?",
    en: "Which tasks do you avoid - and what exactly bothers you about them?" },

  // --- Arbeitsweise ---
  { key: "depth_vs_breadth", stage: "work_style_and_environment", yields: ["work_environment"],
    de: "Arbeitest du lieber lange an einem komplexen Thema oder an mehreren kurzen Aufgaben?",
    en: "Do you prefer working long on one complex topic or on several short tasks?" },
  { key: "exchange_vs_focus", stage: "work_style_and_environment", yields: ["work_environment"],
    de: "Wie viel Austausch und wie viel ungestörte Zeit brauchst du an einem normalen Arbeitstag?",
    en: "How much exchange and how much uninterrupted time do you need on a normal working day?" },
  { key: "structure_vs_building", stage: "work_style_and_environment", yields: ["work_environment"],
    de: "Bevorzugst du klare Abläufe oder möchtest du lieber etwas Neues aufbauen?",
    en: "Do you prefer clear processes or would you rather build something new?" },
  { key: "shifting_priorities", stage: "work_style_and_environment", yields: ["skill", "work_environment"],
    de: "Wie gehst du mit kurzfristig wechselnden Prioritäten um? Nenn mir bitte ein Beispiel.",
    en: "How do you handle priorities that shift at short notice? Please give an example." },

  // --- Verantwortung und Werte ---
  { key: "responsibility_wanted", stage: "values_and_motives", yields: ["motive"],
    de: "Welche fachliche, Projekt- oder Personalverantwortung möchtest du übernehmen?",
    en: "What professional, project or people responsibility would you like to take on?" },
  { key: "own_decisions", stage: "values_and_motives", yields: ["motive"],
    de: "Welche Entscheidungen möchtest du selbst treffen dürfen?",
    en: "Which decisions do you want to be allowed to make yourself?" },
  { key: "value_ranking", stage: "values_and_motives", yields: ["motive"],
    de: "Ordne bitte nach Bedeutung: Gehalt, Sicherheit, Lernen, Autonomie, Sinn, Status, Flexibilität, Team.",
    en: "Please rank by importance: pay, security, learning, autonomy, purpose, status, flexibility, team." },
  { key: "potential_blocked", stage: "values_and_motives", yields: ["work_environment", "constraint"],
    de: "Wann konntest du dein Potenzial in der Vergangenheit nicht zeigen?",
    en: "When were you unable to show your potential in the past?",
    followUpDe: "Welche Bedingungen haben damals gefehlt?",
    followUpEn: "What conditions were missing back then?" },

  // --- Harte Bedingungen ---
  { key: "non_negotiables", stage: "hard_constraints", yields: ["constraint"],
    de: "Welche drei Bedingungen sind für deinen nächsten Job nicht verhandelbar?",
    en: "Which three conditions are non-negotiable for your next job?" },
  { key: "minimum_salary", stage: "hard_constraints", yields: ["constraint"],
    de: "Welches Mindestgehalt brauchst du realistisch?",
    en: "What minimum salary do you realistically need?" },
  { key: "salary_tradeoffs", stage: "hard_constraints", yields: ["constraint", "preference"],
    de: "Welche anderen Bedingungen könnten einen niedrigeren Betrag ausnahmsweise ausgleichen?",
    en: "What other conditions could exceptionally make up for a lower figure?" },
  { key: "quit_after_three_months", stage: "hard_constraints", yields: ["constraint"],
    de: "Was müsste in einem neuen Job passieren, damit du bereits nach drei Monaten wieder kündigen möchtest?",
    en: "What would have to happen in a new job for you to want to leave after three months?" },

  // --- Standort ---
  { key: "location_options", stage: "location_and_logistics", yields: ["constraint"],
    de: "Welche Standorte, Pendelzeiten, Remote-Anteile, Reise- und Schichtmodelle sind für dich möglich?",
    en: "Which locations, commute times, remote shares, travel and shift models work for you?" },

  // --- Interessen ---
  { key: "current_targets", stage: "learning_goals", yields: ["role", "preference"],
    de: "Welche Jobtitel oder Tätigkeitsfelder interessieren dich momentan?",
    en: "Which job titles or fields interest you at the moment?",
    followUpDe: "Was genau zieht dich daran an - die Aufgaben, das Umfeld, das Gehalt, der Status oder etwas anderes?",
    followUpEn: "What exactly attracts you - the tasks, the environment, the pay, the status, or something else?" },
  { key: "excluded_roles", stage: "learning_goals", yields: ["constraint"],
    de: "Welche Rollen oder Branchen schliesst du ausdrücklich aus?",
    en: "Which roles or industries do you explicitly rule out?" },
  { key: "learning_goal_year", stage: "learning_goals", yields: ["motive"],
    de: "Was möchtest du in den nächsten zwölf Monaten gelernt oder nachweisbar verbessert haben?",
    en: "What do you want to have learned or demonstrably improved in the next twelve months?" },
];

export const QUESTIONS_BY_STAGE = QUESTIONS.reduce<Record<string, Question[]>>((acc, q) => {
  (acc[q.stage] ??= []).push(q);
  return acc;
}, {});

export function questionText(q: Question, locale: "de" | "en", hasWorkExperience: boolean): string {
  if (!hasWorkExperience) {
    const variant = locale === "en" ? q.noExperienceVariantEn : q.noExperienceVariantDe;
    if (variant) return variant;
  }
  return locale === "en" ? q.en : q.de;
}

export function followUpText(q: Question, locale: "de" | "en"): string | null {
  return (locale === "en" ? q.followUpEn : q.followUpDe) ?? null;
}

/** Verständliche Themennamen für die Fortschrittsanzeige. */
export const STAGE_LABELS: Record<string, { de: string; en: string }> = {
  consent_and_goal: { de: "Dein Ziel", en: "Your goal" },
  current_situation: { de: "Wo du stehst", en: "Where you are" },
  background: { de: "Ausbildung und Werkzeuge", en: "Education and tools" },
  experience_episodes: { de: "Konkrete Erfahrungen", en: "Concrete experience" },
  tasks_and_energy: { de: "Aufgaben und Energie", en: "Tasks and energy" },
  feedback_and_recognition: { de: "Was andere an dir sehen", en: "What others see in you" },
  work_style_and_environment: { de: "Arbeitsweise", en: "Ways of working" },
  values_and_motives: { de: "Werte und Verantwortung", en: "Values and responsibility" },
  hard_constraints: { de: "Deine Grenzen", en: "Your limits" },
  location_and_logistics: { de: "Ort und Wege", en: "Location and travel" },
  learning_goals: { de: "Richtung und Lernziele", en: "Direction and learning" },
  micro_work_samples: { de: "Kurze Aufgaben (freiwillig)", en: "Short tasks (optional)" },
  synthesis: { de: "Zusammenfassung", en: "Synthesis" },
  user_confirmation: { de: "Deine Bestätigung", en: "Your confirmation" },
  role_clusters: { de: "Passende Richtungen", en: "Matching directions" },
};
