import type {
  EvidenceItem,
  Faehigkeitsaussage,
  Job,
  JobRequirement,
  JobSource,
  ReviewAggregate,
  ReviewTheme,
  UserConstraints,
} from "@paycheck/domain";
import { checkConstraints, type CommuteEstimator } from "./constraints.ts";
import { computeFit } from "./fit.ts";
import { computeConfidence } from "./confidence.ts";
import { computeJobQuality } from "./jobQuality.ts";
import { computeAiTransition } from "./aiTransition.ts";
import { computeListingConfidence } from "./listingConfidence.ts";
import { computeOverall } from "./ranking.ts";
import { anzeigenqualitaet } from "./anzeigenqualitaet.ts";

/**
 * Eine Stelle gegen ein Profil bewerten — an einer Stelle im Code.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das aus der Webschicht herausgezogen wurde
 * ══════════════════════════════════════════════════════════════
 *
 * Die Rechnung stand in `apps/web/src/lib/matching.ts`, mitten in der
 * Schleife, die Datenbankzeilen in Ergebnisse verwandelt. Für die
 * Stellenliste war das richtig.
 *
 * Für den Hintergrunddienst ist es unerreichbar: Er läuft als Skript,
 * ohne Next.js, ohne React. Die naheliegende Lösung wäre gewesen, die
 * Rechnung dort noch einmal hinzuschreiben — und genau davor warnt der
 * Auftrag: keine zweite Gewichtung, kein nächtlicher Sonderscore.
 *
 * Zwei Kopien derselben Formel laufen nicht sofort auseinander. Sie
 * laufen beim ersten Mal auseinander, an dem jemand eine davon
 * anpasst — und niemand merkt es, weil beide plausible Zahlen
 * liefern. Die Person sieht in der Liste 74 und in der Mail 81 und
 * weiss nicht, welcher Zahl sie glauben soll.
 *
 * Hier steht sie einmal. Liste und Hintergrunddienst rufen dasselbe.
 */

export interface Bewertungsprofil {
  constraints: UserConstraints;
  evidence: EvidenceItem[];
  energisingTasks: string[];
  drainingTasks: string[];
  workStylePreferences: string[];
  rankedValues: string[];
  statedInterests: string[];
  /** Wie viel des Profils belegt ist — geht in die Datenlage ein. */
  coverage: number;
  /**
   * Belegte Fähigkeiten aus dem Katalog.
   *
   * Leer zu lassen ist erlaubt: Dann rechnet der Fit wie zuvor über
   * die Wortüberlappung. Wo Fähigkeiten vorliegen, entscheiden sie —
   * sie kennen Synonyme, die ein Wortvergleich nicht kennt.
   */
  faehigkeiten?: readonly Faehigkeitsaussage[];
  /** Der Katalog. Fehlt er, wird nichts zugeordnet. */
  schluesselFuerAnforderung?: (text: string) => string | null;
}

export interface Bewertungseingabe {
  job: Job;
  requirements: JobRequirement[];
  source: JobSource | null;
  reviews: ReviewAggregate[];
  themes: ReviewTheme[];
  /** Mitarbeiterzahl des Arbeitgebers, als Text wie in der Anreicherung. */
  mitarbeiter: string | null;
  /** Wie oft derselbe Inhalt früher schon erfasst wurde. */
  earlierDuplicateCount: number;
  profil: Bewertungsprofil;
  commute: CommuteEstimator;
  now: Date;
}

export interface Bewertungsausgabe {
  constraints: ReturnType<typeof checkConstraints>;
  fit: ReturnType<typeof computeFit>;
  confidence: ReturnType<typeof computeConfidence>;
  jobQuality: ReturnType<typeof computeJobQuality>;
  anzeige: ReturnType<typeof anzeigenqualitaet>;
  aiTransition: ReturnType<typeof computeAiTransition>;
  listingConfidence: ReturnType<typeof computeListingConfidence>;
  overall: ReturnType<typeof computeOverall>;
  salaryPerYear: number | null;
  commuteMinutes: number | null;
}

/** Aufs Jahr gerechnet. 40-Stunden-Woche als offengelegte Annahme. */
export function jahresgehalt(job: Job): number | null {
  if (!job.salary.disclosed) return null;
  const betrag = job.salary.max ?? job.salary.min;
  if (betrag === null) return null;
  if (job.salary.period === "month") return betrag * 12;
  if (job.salary.period === "hour") return betrag * 40 * 52;
  return betrag;
}

export function stelleBewerten(e: Bewertungseingabe): Bewertungsausgabe {
  const { job, profil } = e;

  const constraints = checkConstraints(job, profil.constraints, e.commute);
  const fit = computeFit({
    job,
    requirements: e.requirements,
    evidence: profil.evidence,
    constraints: profil.constraints,
    energisingTasks: profil.energisingTasks,
    drainingTasks: profil.drainingTasks,
    workStylePreferences: profil.workStylePreferences,
    rankedValues: profil.rankedValues,
    statedInterests: profil.statedInterests,
    faehigkeiten: profil.faehigkeiten,
    schluesselFuerAnforderung: profil.schluesselFuerAnforderung,
  });
  const confidence = computeConfidence({
    job,
    fitCoverage: fit.coverage,
    profileCoverage: profil.coverage,
    requirementCount: e.requirements.length,
    reviews: e.reviews,
    now: e.now,
  });
  const jobQuality = computeJobQuality({
    job,
    reviews: e.reviews,
    themes: e.themes,
    mitarbeiter: e.mitarbeiter,
  });
  /*
   * Transparenz getrennt von den Bedingungen.
   *
   * `computeJobQuality` misst, was die Stelle BIETET; `anzeigenqualitaet`
   * misst, was die Anzeige PREISGIBT. Sie standen in einer Zahl — eine
   * ausführliche Anzeige mit schlechten Bedingungen und eine knappe mit
   * guten ergaben denselben Wert.
   */
  const anzeige = anzeigenqualitaet(job);
  const aiTransition = computeAiTransition({ job, dataAsOf: null });
  const listingConfidence = computeListingConfidence({
    job,
    source: e.source,
    earlierDuplicateCount: e.earlierDuplicateCount,
    now: e.now,
  });
  const overall = computeOverall({
    constraints,
    fit,
    confidence,
    jobQuality,
    aiTransition,
    listingConfidence,
  });

  const commuteMinutes =
    job.workModel === "remote"
      ? 0
      : profil.constraints.baseLocation
        ? e.commute.estimateMinutes(profil.constraints.baseLocation, job.location, profil.constraints.commuteMode)
        : null;

  return {
    constraints,
    fit,
    confidence,
    jobQuality,
    anzeige,
    aiTransition,
    listingConfidence,
    overall,
    salaryPerYear: jahresgehalt(job),
    commuteMinutes,
  };
}
