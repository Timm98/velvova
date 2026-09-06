import type { Job, JobSource, ListingConfidenceResult } from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";
import { toScore100 } from "./weighted.ts";

/**
 * Listing Confidence: wie vertrauenswürdig ist die Anzeige selbst?
 *
 * Das Wort "Fake" fällt hier nie. Wir können aus der Ferne nicht
 * feststellen, ob eine Anzeige betrügerisch ist - wohl aber, ob die
 * Quelle nachvollziehbar, die Anzeige vollständig und der Link noch
 * erreichbar ist. Genau das wird gesagt, nicht mehr.
 */

const DAY = 86_400_000;

export interface ListingConfidenceInput {
  job: Job;
  source: JobSource | null;
  /** Andere Anzeigen mit demselben Inhaltshash, aelter als diese. */
  earlierDuplicateCount?: number;
  now?: Date;
}

export function computeListingConfidence(input: ListingConfidenceInput): ListingConfidenceResult {
  const { job, source } = input;
  const now = input.now ?? new Date();
  const signals: ListingConfidenceResult["signals"] = [];
  let points = 0;
  let max = 0;

  const add = (key: string, label: string, ok: boolean | null, detail: string, weight: number) => {
    signals.push({ key, label, ok, detail });
    max += weight;
    if (ok === true) points += weight;
    else if (ok === null) points += weight * 0.5; // Unbekannt ist halb, nicht null.
  };

  /*
   * „Quelle verlinkt" statt „Originalquelle vorhanden".
   *
   * Der Link führt in aller Regel zu der Stelle, von der WIR die
   * Anzeige haben — bei einem Aggregator also zu einer weiteren
   * Sammelstelle, nicht zum Arbeitgeber. „Original" behauptete an
   * dieser Stelle etwas, das wir nicht wissen, und ausgerechnet unter
   * der Überschrift „Woraus sich das Vertrauen in die Anzeige ergibt".
   *
   * Ob es die Arbeitgeberseite ist, sagt das nächste Signal — und das
   * darf es sagen, weil es die Art der Quelle kennt.
   */
  add("original_url", "Quelle verlinkt", job.originalUrl !== null,
    job.originalUrl
      ? "Die Anzeige lässt sich bei der Quelle nachlesen, aus der wir sie haben."
      : "Es liegt kein Link zur Anzeige vor.", 20);

  add("employer_identity", "Arbeitgeber nachvollziehbar",
    source === null ? null : source.kind === "employer_feed" || source.licenseStatus === "licensed",
    source === null ? "Die Herkunft der Anzeige ist unklar."
      : source.kind === "employer_feed" ? "Die Anzeige stammt direkt vom Arbeitgeber."
      : `Quelle: ${source.displayName} (${source.licenseStatus}).`, 15);

  let possiblyStale = false;
  if (job.publishedAt) {
    const ageDays = Math.round((now.getTime() - job.publishedAt.getTime()) / DAY);
    possiblyStale = ageDays > 60;
    add("age", "Alter der Anzeige", ageDays <= 30 ? true : ageDays <= 60 ? null : false,
      `Veröffentlicht vor ${ageDays} Tagen.`, 20);
  } else {
    add("age", "Alter der Anzeige", null, "Kein Veröffentlichungsdatum angegeben.", 20);
  }

  if (job.expiresAt && job.expiresAt.getTime() < now.getTime()) {
    possiblyStale = true;
    add("expiry", "Bewerbungsfrist", false,
      `Die angegebene Frist ist am ${job.expiresAt.toISOString().slice(0, 10)} abgelaufen.`, 10);
  } else {
    add("expiry", "Bewerbungsfrist", job.expiresAt ? true : null,
      job.expiresAt ? `Frist bis ${job.expiresAt.toISOString().slice(0, 10)}.` : "Keine Frist angegeben.", 10);
  }

  add("link_check", "Letzter Linkcheck", job.lastLinkCheckOk,
    job.lastLinkCheckAt
      ? `Zuletzt geprüft am ${job.lastLinkCheckAt.toISOString().slice(0, 10)}: ${job.lastLinkCheckOk ? "erreichbar" : "nicht erreichbar"}.`
      : "Der Link wurde noch nicht geprüft.", 15);

  const dupes = input.earlierDuplicateCount ?? 0;
  const possibleRepost = dupes > 0;
  add("repost", "Wiederveröffentlichung", dupes === 0 ? true : false,
    dupes === 0 ? "Kein Hinweis auf eine früher identische Anzeige."
      : `Es gibt ${dupes} früher erfasste Anzeige(n) mit gleichem Inhalt. Das kann Nachbesetzung oder bloße Wiedervorlage bedeuten.`, 10);

  const complete = [job.salary.disclosed, job.coreTasks.length > 0, job.contractType !== null, job.descriptionLength > 200];
  const completeCount = complete.filter(Boolean).length;
  add("completeness", "Vollständigkeit", completeCount >= 3 ? true : completeCount >= 2 ? null : false,
    `${completeCount} von 4 Grundangaben sind vorhanden.`, 10);

  const score = toScore100(max > 0 ? points / max : 0);
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return { score, level, signals, possiblyStale, possibleRepost, version: SCORING_VERSION };
}
