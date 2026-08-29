import type { Job, JobSource, ListingConfidenceResult } from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";
import { toScore100 } from "./weighted.js";

/**
 * Listing Confidence: wie vertrauenswuerdig ist die Anzeige selbst?
 *
 * Das Wort "Fake" faellt hier nie. Wir koennen aus der Ferne nicht
 * feststellen, ob eine Anzeige betruegerisch ist - wohl aber, ob die
 * Quelle nachvollziehbar, die Anzeige vollstaendig und der Link noch
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

  add("original_url", "Originalquelle vorhanden", job.originalUrl !== null,
    job.originalUrl ? "Die Anzeige laesst sich im Original oeffnen." : "Es liegt kein Link zur Originalanzeige vor.", 20);

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
      `Veroeffentlicht vor ${ageDays} Tagen.`, 20);
  } else {
    add("age", "Alter der Anzeige", null, "Kein Veroeffentlichungsdatum angegeben.", 20);
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
      ? `Zuletzt geprueft am ${job.lastLinkCheckAt.toISOString().slice(0, 10)}: ${job.lastLinkCheckOk ? "erreichbar" : "nicht erreichbar"}.`
      : "Der Link wurde noch nicht geprueft.", 15);

  const dupes = input.earlierDuplicateCount ?? 0;
  const possibleRepost = dupes > 0;
  add("repost", "Wiederveroeffentlichung", dupes === 0 ? true : false,
    dupes === 0 ? "Kein Hinweis auf eine frueher identische Anzeige."
      : `Es gibt ${dupes} frueher erfasste Anzeige(n) mit gleichem Inhalt. Das kann Nachbesetzung oder blosse Wiedervorlage bedeuten.`, 10);

  const complete = [job.salary.disclosed, job.coreTasks.length > 0, job.contractType !== null, job.description.length > 200];
  const completeCount = complete.filter(Boolean).length;
  add("completeness", "Vollstaendigkeit", completeCount >= 3 ? true : completeCount >= 2 ? null : false,
    `${completeCount} von 4 Grundangaben sind vorhanden.`, 10);

  const score = toScore100(max > 0 ? points / max : 0);
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return { score, level, signals, possiblyStale, possibleRepost, version: SCORING_VERSION };
}
