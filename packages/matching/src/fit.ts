import type { EvidenceItem, FitBand, FitResult, Job, JobRequirement, UserConstraints } from "@paycheck/domain";
import { SCORING_VERSION, isConfirmedFact } from "@paycheck/domain";
import { toScore100, weightedScore, type WeightedInput } from "./weighted.ts";

/**
 * Fit Score: fachliche Passung zwischen Mensch und Stelle.
 *
 * Ausdrücklich KEINE Einstellungswahrscheinlichkeit. Wer eingeladen wird,
 * hängt an Dingen, die wir nicht kennen - Bewerberfeld, Timing, interne
 * Kandidaten. Diese Zahl beantwortet nur: passt die Tätigkeit zu dem,
 * was dieser Mensch belegt kann und will?
 */

/** Startgewichtung als Managementannahme, vom Menschen anpassbar. */
export interface FitWeights {
  provenSkills: number;
  preferredTasks: number;
  workStyle: number;
  valuesAndMotives: number;
  growthPotential: number;
  marketRealism: number;
  statedInterest: number;
}

/**
 * Die Startgewichte.
 *
 * Belegte Fähigkeiten wiegen am schwersten, weil sie das Einzige sind,
 * das nachprüfbar ist. Interessen wiegen am leichtesten — nicht weil
 * sie unwichtig wären, sondern weil eine Selbstauskunft über Interesse
 * die am wenigsten belastbare Angabe im ganzen Profil ist.
 *
 * Evidenzqualität ist bewusst KEINE eigene Achse. Sie sagt etwas über
 * die Verlässlichkeit einer Aussage, nicht über die Passung — und
 * fließt deshalb in die Sicherheit ein, wo sie hingehört. Sie hier
 * mitzurechnen hieße, eine gut belegte schlechte Passung besser
 * aussehen zu lassen als eine schlecht belegte gute.
 */
export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  provenSkills: 0.25,
  preferredTasks: 0.20,
  workStyle: 0.15,
  growthPotential: 0.15,
  statedInterest: 0.10,
  marketRealism: 0.10,
  valuesAndMotives: 0.05,
};

/** Grenzen, in denen der Mensch die Gewichte verschieben darf. */
export const WEIGHT_BOUNDS: Record<keyof FitWeights, [number, number]> = {
  provenSkills: [0.15, 0.50],
  preferredTasks: [0.05, 0.35],
  workStyle: [0.05, 0.30],
  valuesAndMotives: [0.00, 0.25],
  growthPotential: [0.00, 0.25],
  marketRealism: [0.00, 0.25],
  statedInterest: [0.00, 0.20],
};

const WEIGHT_KEYS = [
  "provenSkills", "preferredTasks", "workStyle", "valuesAndMotives",
  "growthPotential", "marketRealism", "statedInterest",
] as const satisfies readonly (keyof FitWeights)[];

export function normaliseWeights(w: Partial<FitWeights>): FitWeights {
  const merged: FitWeights = { ...DEFAULT_FIT_WEIGHTS, ...w };

  const clamped = {} as FitWeights;
  for (const k of WEIGHT_KEYS) {
    const [lo, hi] = WEIGHT_BOUNDS[k];
    clamped[k] = Math.min(hi, Math.max(lo, merged[k]));
  }

  const sum = WEIGHT_KEYS.reduce((acc, k) => acc + clamped[k], 0);
  if (sum === 0) return DEFAULT_FIT_WEIGHTS;

  const normalised = {} as FitWeights;
  for (const k of WEIGHT_KEYS) normalised[k] = clamped[k] / sum;
  return normalised;
}

export interface FitInput {
  job: Job;
  requirements: JobRequirement[];
  evidence: EvidenceItem[];
  constraints: UserConstraints;
  /** Tätigkeiten, die Energie geben - aus dem Interview bestätigt. */
  energisingTasks: string[];
  /** Tätigkeiten, die gemieden werden. */
  drainingTasks: string[];
  /** Bevorzugte Arbeitsweise, z. B. "fokussierte Tiefe" oder "viel Austausch". */
  workStylePreferences: string[];
  /** Werte in Reihenfolge der Bedeutung. */
  rankedValues: string[];
  /** Rollen oder Felder, die der Mensch selbst genannt hat. */
  statedInterests: string[];
  weights?: Partial<FitWeights>;
}

/** Sehr einfache Wortüberlappung. Ersetzt kein semantisches Modell,
 *  reicht aber für eine nachvollziehbare Grundbewertung ohne Netzzugriff. */
/**
 * Die Normalisierung, auf die sich alles stützt.
 *
 * Kleinschreiben, alles ausser Buchstaben und Ziffern zu Leerzeichen,
 * Wörter über drei Zeichen, jedes einmal. Kurze Wörter fallen heraus,
 * weil „und", „für", „mit" in jeder Anzeige stehen und deshalb nichts
 * über Passung aussagen — sie würden jeden Wert nach oben ziehen.
 */
function wortmenge(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3),
  );
}

/**
 * Eine Beschreibung auf das eindampfen, was die Bewertung von ihr liest.
 *
 * Beim Import einmal aufgerufen, in `jobs.description_tokens` abgelegt.
 * Weil `overlap()` ohnehin nur `wortmenge()` sieht, ist die Bewertung
 * über den Tokens bitgleich zu der über dem Fliesstext — die Sortierung
 * dient allein der Lesbarkeit beim Nachschauen in der Datenbank.
 *
 * Der Gewinn steht in der Abfrage: 4,35 MB Fliesstext werden zu 2,42 MB
 * Wortmengen, und die Ranglistenabfrage wird messbar schneller, ohne
 * dass sich ein einziger Wert verschiebt.
 */
export function beschreibungsTokens(beschreibung: string): string {
  return [...wortmenge(beschreibung)].sort().join(" ");
}

function overlap(a: string, b: string): number {
  const norm = wortmenge;
  const sa = norm(a);
  const sb = norm(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let hits = 0;
  for (const w of sa) if (sb.has(w)) hits++;
  return hits / Math.min(sa.size, sb.size);
}

function bestOverlap(needle: string, haystack: string[]): number {
  return haystack.reduce((best, h) => Math.max(best, overlap(needle, h)), 0);
}

export function computeFit(input: FitInput): FitResult {
  const w = normaliseWeights(input.weights ?? {});
  const confirmed = input.evidence.filter(isConfirmedFact);

  // --- Belegte Fähigkeiten gegen Muss- und Kann-Anforderungen ---
  const musts = input.requirements.filter((r) => r.kind === "must");
  const nices = input.requirements.filter((r) => r.kind === "nice");
  const evidenceTexts = confirmed.map((e) => e.statement);
  const skillEvidenceIds: string[] = [];

  const scoreRequirement = (r: JobRequirement): number => {
    let best = 0;
    let bestId: string | null = null;
    for (const e of confirmed) {
      const s = overlap(r.text, e.statement);
      if (s > best) { best = s; bestId = e.id; }
    }
    if (bestId && best >= 0.34) skillEvidenceIds.push(bestId);
    return best;
  };

  let skillRaw: number | null = null;
  let mustCovered = 0;
  if (musts.length > 0 || nices.length > 0) {
    const mustScores = musts.map(scoreRequirement);
    const niceScores = nices.map(scoreRequirement);
    mustCovered = mustScores.filter((s) => s >= 0.34).length;
    // Muss-Anforderungen wiegen dreifach gegenueber Kann-Anforderungen.
    const mustPart = musts.length > 0 ? mustScores.reduce((a, b) => a + b, 0) / musts.length : null;
    const nicePart = nices.length > 0 ? niceScores.reduce((a, b) => a + b, 0) / nices.length : null;
    if (mustPart !== null && nicePart !== null) skillRaw = mustPart * 0.75 + nicePart * 0.25;
    else skillRaw = mustPart ?? nicePart;
  }
  if (confirmed.length === 0) skillRaw = null; // Ohne Belege keine Aussage.

  // --- Tätigkeiten und Energie ---
  let taskRaw: number | null = null;
  if (input.job.coreTasks.length > 0 && (input.energisingTasks.length > 0 || input.drainingTasks.length > 0)) {
    const energising = input.job.coreTasks.map((t) => bestOverlap(t, input.energisingTasks));
    const draining = input.job.coreTasks.map((t) => bestOverlap(t, input.drainingTasks));
    const plus = energising.reduce((a, b) => a + b, 0) / input.job.coreTasks.length;
    const minus = draining.reduce((a, b) => a + b, 0) / input.job.coreTasks.length;
    taskRaw = Math.min(1, Math.max(0, plus - minus * 0.6));
  }

  // --- Arbeitsweise und Umfeld ---
  let styleRaw: number | null = null;
  if (input.workStylePreferences.length > 0) {
    /*
     * `descriptionTokens` statt `description` — und das ist kein
     * Kompromiss.
     *
     * `overlap()` normalisiert beide Seiten zu einer MENGE eindeutiger
     * Wörter über drei Zeichen. Was vom Fliesstext im Wert ankommt, ist
     * also weder Reihenfolge noch Häufigkeit noch Grammatik, sondern
     * genau diese Menge. Sie einmal beim Import zu bilden statt bei
     * jedem Aufruf für tausend Stellen ergibt denselben Wert — Ziffer
     * für Ziffer. Geprüft in fit.tokens.test.ts.
     */
    const haystack = [input.job.descriptionTokens, ...input.job.coreTasks, ...input.job.benefits].join(" ");
    const hits = input.workStylePreferences.map((p) => overlap(p, haystack));
    styleRaw = hits.reduce((a, b) => a + b, 0) / hits.length;
  }

  // --- Werte und Motive ---
  let valuesRaw: number | null = null;
  if (input.rankedValues.length > 0 && input.job.benefits.length > 0) {
    const haystack = [...input.job.benefits, input.job.descriptionTokens].join(" ");
    // Früh genannte Werte wiegen mehr.
    let sum = 0, wsum = 0;
    input.rankedValues.forEach((v, i) => {
      const weight = 1 / (i + 1);
      sum += overlap(v, haystack) * weight;
      wsum += weight;
    });
    valuesRaw = wsum > 0 ? sum / wsum : null;
  }

  // --- Entwicklungspotenzial ---
  let growthRaw: number | null = null;
  if (input.job.experienceLevel !== null) {
    const ladder = { entry: 0, junior: 1, mid: 2, senior: 3, lead: 4 } as const;
    const jobLevel = ladder[input.job.experienceLevel];
    // Ein Schritt über dem heutigen Stand ist die beste Lernkurve.
    const userLevel = confirmed.length >= 12 ? 2 : confirmed.length >= 6 ? 1 : 0;
    const gap = jobLevel - userLevel;
    growthRaw = gap === 1 ? 1 : gap === 0 ? 0.8 : gap === 2 ? 0.5 : gap < 0 ? 0.35 : 0.2;
  }

  // --- Marktrealismus ---
  let realismRaw: number | null = null;
  if (musts.length > 0 && confirmed.length > 0) {
    realismRaw = Math.min(1, mustCovered / musts.length + 0.15);
  }

  // --- Ausdrückliches Interesse ---
  let interestRaw: number | null = null;
  if (input.statedInterests.length > 0) {
    interestRaw = bestOverlap(input.job.title, input.statedInterests);
  }

  const inputs: WeightedInput[] = [
    { key: "proven_skills", label: "Belegte Fähigkeiten und Qualifikationen", raw: skillRaw,
      weight: w.provenSkills, evidenceIds: [...new Set(skillEvidenceIds)],
      explanation: skillRaw === null
        /*
         * In der Sprache der Person, nicht in unserer.
         *
         * „Bestätigte Belege, an denen sich Anforderungen messen
         * liessen" ist präzise und liest sich wie ein Prüfbericht.
         * Gemeint ist etwas Einfaches, und so soll es auch dastehen.
         */
        ? "Monday weiss noch nicht, was du kannst — dafür fehlt das Gespräch."
        : `${mustCovered} von ${musts.length} Muss-Anforderungen sind durch bestätigte Erfahrungen gedeckt.` },
    { key: "preferred_tasks", label: "Tätigkeiten, die dir Energie geben", raw: taskRaw,
      weight: w.preferredTasks,
      explanation: taskRaw === null
        ? "Die Anzeige beschreibt keine konkreten Aufgaben, oder es fehlen deine Angaben dazu."
        : "Vergleich der Kernaufgaben mit dem, was dir Energie gibt und was dich auslaugt." },
    { key: "work_style", label: "Arbeitsweise und Umfeld", raw: styleRaw, weight: w.workStyle,
      explanation: styleRaw === null ? "Zu deiner bevorzugten Arbeitsweise liegt noch nichts vor."
        : "Abgleich deiner bevorzugten Arbeitsweise mit der Beschreibung der Stelle." },
    { key: "values", label: "Werte und Motive", raw: valuesRaw, weight: w.valuesAndMotives,
      explanation: valuesRaw === null ? "Die Anzeige nennt zu wenig, um deine Werte abzugleichen."
        : "Deine wichtigsten Werte gegen das, was die Stelle ausdrücklich bietet." },
    { key: "growth", label: "Entwicklungspotenzial", raw: growthRaw, weight: w.growthPotential,
      explanation: growthRaw === null ? "Die Anzeige nennt kein Erfahrungsniveau."
        : "Wie gross der Schritt von deinem heutigen Stand aus wäre." },
    { key: "realism", label: "Umsetzbarkeit", raw: realismRaw, weight: w.marketRealism,
      explanation: realismRaw === null ? "Ohne Muss-Anforderungen oder Belege nicht einschaetzbar."
        : "Wie viele zwingende Anforderungen du heute schon erfuellst." },
    { key: "interest", label: "Dein ausdrückliches Interesse", raw: interestRaw, weight: w.statedInterest,
      explanation: interestRaw === null ? "Du hast noch keine Zielrollen genannt."
        : "Nähe zu den Rollen, die du selbst genannt hast." },
  ];

  const { value, coverage, factors } = weightedScore(inputs);

  /*
   * Eine Zahl nur zeigen, wenn sie etwas bedeutet.
   *
   * Und — das ist der Punkt, an dem es vorher auseinanderlief — die
   * Einstufung hängt an DERSELBEN Schwelle. Zwei getrennte Grenzen
   * führten dazu, dass eine Stelle als "hohe Passung" eingestuft wurde,
   * während die Zahl daneben verweigert wurde. Beides gleichzeitig ist
   * ein Widerspruch: entweder die Datenlage trägt eine Aussage, oder
   * sie trägt keine.
   *
   * Ein Test hat das gefunden, als sich die Gewichte änderten. Er hätte
   * es auch vorher gefunden, wenn die Gewichte anders gestanden hätten
   * — der Fehler war die ganze Zeit da und nur nicht sichtbar.
   */
  const MIN_COVERAGE_FOR_NUMBER = 0.55;
  const showNumber = value !== null && coverage >= MIN_COVERAGE_FOR_NUMBER;

  let band: FitBand;
  if (!showNumber) band = "insufficient_data";
  else if (value! >= 0.7) band = "high";
  else if (value! >= 0.45) band = "medium";
  else band = "exploratory";

  const known = factors.filter((f) => f.raw !== null).sort((a, b) => b.contribution - a.contribution);
  const unknown = factors.filter((f) => f.raw === null);
  const weakest = known.length > 0 ? known[known.length - 1] : undefined;

  const topReason = known[0]
    ? `${known[0].label}: ${known[0].explanation}`
    /*
     * Kurz, weil es im Kopf der Detailseite steht.
     *
     * Hier stand „Es liegen noch zu wenige bestätigte Angaben vor, um
     * eine Passung zu begründen." — wahr, aber als Antwort auf „warum
     * sehe ich diese Stelle?" eine Nichtauskunft in Satzlänge. Was
     * fehlt und wie man es behebt, steht ohnehin eine Zeile darunter
     * im Hinweis auf das Profil.
     */
    /*
     * Der Satz, der unter jeder einzelnen Stelle stand.
     *
     * Fünfundzwanzigmal untereinander, in unseren Begriffen („belegte
     * Passung", „bestätigte Angaben"), und er las sich wie ein Mangel
     * der Stelle statt wie eine Lücke bei uns. Der neue sagt dasselbe
     * und klingt wie ein Mensch.
     */
    : "Sieht interessant aus — für eine belastbare Einschätzung kennt Monday dich noch nicht gut genug.";

  const topReservation = unknown[0]
    ? `${unknown[0].label} ist unbekannt. ${unknown[0].explanation}`
    : weakest
      ? `Am schwächsten: ${weakest.label.toLowerCase()}. ${weakest.explanation}`
      : "Kein einzelner Vorbehalt sticht heraus — prüf die Anforderungen trotzdem selbst.";

  return {
    score: showNumber ? toScore100(value) : null,
    band,
    coverage: Math.round(coverage * 100) / 100,
    factors,
    topReason,
    topReservation,
    version: SCORING_VERSION,
  };
}
