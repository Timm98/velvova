import { listJobsForUser, loadProfileContext } from "@/lib/matching";
import type { JobVorschlag } from "@/components/nina/JobSuggestions";

/**
 * Die höchstens drei Vorschläge, die Monday im Gespräch zeigen darf.
 *
 * Sie kommen aus derselben Bewertungslogik wie die vollständige Liste —
 * nicht aus dem Modell. Das ist der Punkt: eine Reihenfolge, die ein
 * Sprachmodell erfindet, lässt sich nicht begründen und nicht prüfen.
 * Monday darf entscheiden, WANN sie etwas zeigt; WAS oben steht,
 * entscheidet die Bewertung.
 *
 * Was hier nie passiert: eine Zahl erfinden. Ist kein Gehalt angegeben,
 * steht kein Gehalt da — auch keine Spanne „üblicherweise“.
 */

function frische(publishedAt: Date | null, fetchedAt: Date): string {
  const bezug = publishedAt ?? fetchedAt;
  const tage = Math.floor((Date.now() - bezug.getTime()) / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  if (tage < 31) return `vor ${Math.floor(tage / 7)} Wochen`;
  return `vor ${Math.floor(tage / 30)} Monaten`;
}

function gehalt(salary: {
  disclosed: boolean;
  min: number | null;
  max: number | null;
  currency: string;
  period: string;
}): string | null {
  // Schweigt die Anzeige, schweigt Monday. `disclosed === false` heißt
  // "keine Angabe" und nie "null Euro".
  if (!salary.disclosed || (salary.min === null && salary.max === null)) return null;
  const von = salary.min?.toLocaleString("de-DE");
  const bis = salary.max?.toLocaleString("de-DE");
  const spanne = von && bis ? `${von}–${bis}` : (von ?? bis);
  const zeitraum =
    salary.period === "year" ? "Jahr" : salary.period === "month" ? "Monat" : salary.period;
  return `${spanne} ${salary.currency}/${zeitraum}`;
}

const ARBEITSMODELL: Record<string, string> = {
  on_site: "Vor Ort",
  hybrid: "Hybrid",
  remote: "Remote",
};

const KONFIDENZ = (score: number): string =>
  score >= 0.7 ? "hoch" : score >= 0.45 ? "mittel" : "niedrig";

export async function ninaJobSuggestions(userId: string, limit = 3): Promise<JobVorschlag[]> {
  const ctx = await loadProfileContext(userId);
  const { jobs } = await listJobsForUser(userId, ctx, { limit });

  return jobs.slice(0, limit).map((scored) => ({
    id: scored.jobId,
    title: scored.job.title,
    company: scored.job.companyName,
    location: scored.job.location,
    workModel: ARBEITSMODELL[scored.job.workModel] ?? scored.job.workModel,
    salary: gehalt(scored.job.salary),
    freshness: `geprüft ${frische(scored.job.publishedAt, scored.job.fetchedAt)}`,
    sourceName: scored.source?.displayName ?? "unbekannte Quelle",
    fitBand: scored.fit.band,
    confidence: KONFIDENZ(scored.confidence.score),
    /*
     * Grund und Haken kommen aus der Bewertung, nicht aus einer
     * Formulierung. Steht kein Haken drin, steht keiner da — ein
     * erfundener Vorbehalt wäre so falsch wie ein erfundener Vorzug.
     */
    reason: scored.fit.topReason,
    caveat: scored.fit.topReservation || null,
  }));
}
