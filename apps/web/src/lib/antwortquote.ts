import { getDb, schema, withSystem } from "@paycheck/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Antwortet dieser Arbeitgeber überhaupt?
 *
 * ── Warum das keine Plattform zeigt ───────────────────────────
 *
 * Weil ihre Kunden die Arbeitgeber sind. Eine Zahl, die sagt „hier
 * bekommen sechs von zehn Bewerbern nie eine Antwort", verkauft keine
 * Stellenanzeigen.
 *
 * Für den Suchenden ist es eine der nützlichsten Auskünfte überhaupt:
 * Sie kostet ihn eine Stunde Arbeit je Bewerbung, und er erfährt erst
 * nach Wochen, dass sie vergeblich war.
 *
 * ── Warum eine Absage als Antwort zählt ───────────────────────
 *
 * Weil sie eine ist. Wer absagt, respektiert die Zeit des anderen;
 * das ist etwas anderes als Schweigen. Eine Quote, die beides
 * gleichsetzte, bestrafte den ehrlicheren Arbeitgeber.
 *
 * ── Warum erst nach vier Wochen gezählt wird ──────────────────
 *
 * Eine Bewerbung von gestern ist nicht unbeantwortet, sondern neu.
 * Vier Wochen sind die Grenze, ab der Schweigen eine Aussage ist —
 * darunter wäre die Quote nur ein Mass dafür, wie frisch die
 * Bewerbungen sind.
 */

/** Ab wann Schweigen eine Aussage ist. */
const FRIST_TAGE = 28;

/**
 * Ab wie vielen Bewerbungen eine Quote erscheint.
 *
 * Bei fünf springt sie um zwanzig Prozentpunkte, sobald eine anders
 * ausgeht — und bei kleinen Arbeitgebern liesse sich aus ihr auf
 * einzelne Bewerber schliessen.
 */
export const MIN_BEWERBUNGEN = 10;

export interface Antwortquote {
  /** Wie viele Bewerbungen alt genug sind, um zu zählen. */
  beurteilt: number;
  beantwortet: number;
  /** 0 bis 1. `null` unter der Schwelle. */
  quote: number | null;
  /** Mediane Tage bis zur ersten Reaktion. `null`, wenn zu wenige. */
  medianTage: number | null;
}

/**
 * Was aus den Bewerbungen bei dieser Firma wurde.
 *
 * Über die Systemverbindung und nur als Summe: Wer sich wo beworben
 * hat, verlässt diese Funktion nie.
 */
export async function antwortquoteFuerFirma(companyId: string): Promise<Antwortquote> {
  const db = await getDb();

  const [r] = await withSystem(db, (tx) =>
    tx
      .select({
        beurteilt: sql<number>`count(*)::int`,
        beantwortet: sql<number>`count(*) filter (where antwort_am is not null)::int`,
        medianTage: sql<number | null>`
          percentile_cont(0.5) within group (
            order by extract(epoch from (antwort_am - gesendet_am)) / 86400
          ) filter (where antwort_am is not null)`,
      })
      .from(
        sql`(
          select
            e.application_id,
            min(e.occurred_at) filter (where e.type = 'application_sent') as gesendet_am,
            min(e.occurred_at) filter (
              where e.type in ('acknowledged','response_received','interview_scheduled',
                               'interview_held','offer_received','rejected')
            ) as antwort_am
          from application_events e
          join applications a on a.id = e.application_id
          join jobs j on j.id = a.job_id
          where j.company_id = ${companyId} and e.application_id is not null
          group by e.application_id
        ) as je_bewerbung`,
      )
      .where(
        /*
         * Nur abgeschickte und alt genug.
         *
         * Eine Bewerbung ohne `application_sent` wurde nie
         * abgeschickt — sie sagt über den Arbeitgeber nichts.
         */
        and(
          sql`gesendet_am is not null`,
          sql`gesendet_am < now() - interval '${sql.raw(String(FRIST_TAGE))} days'`,
        ),
      ),
  ).catch(() => [{ beurteilt: 0, beantwortet: 0, medianTage: null }]);

  const beurteilt = Number(r?.beurteilt ?? 0);
  const beantwortet = Number(r?.beantwortet ?? 0);
  const genug = beurteilt >= MIN_BEWERBUNGEN;

  return {
    beurteilt,
    beantwortet,
    quote: genug ? beantwortet / beurteilt : null,
    medianTage: genug && r?.medianTage !== null && r?.medianTage !== undefined
      ? Math.round(Number(r.medianTage))
      : null,
  };
}
