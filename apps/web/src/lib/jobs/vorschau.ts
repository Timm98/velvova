import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { ortNachschlagen } from "@paycheck/jobs";
import type { JobRowData } from "@/components/jobs/JobRow";
import { referenzenFuerKldb, referenzenFuerTitel } from "@/lib/jobs/berufsreferenz";
import { listJobsForUser, loadProfileContext } from "@/lib/matching";
import { zeilenAusStellen } from "@/lib/jobs/zeilen";

/**
 * Die besten Treffer als fertige Listenzeilen.
 *
 * ══════════════════════════════════════════════════════════════
 * Wofür das da ist
 * ══════════════════════════════════════════════════════════════
 *
 * Die Gesprächsseite zeigt unter dem letzten Wort, was dabei
 * herausgekommen ist: ein paar Stellen, in denselben Zeilen wie auf
 * der Stellenseite. Wer weiterscrollt, sieht sie — ohne Geste, ohne
 * Schwelle, ohne Übergang. Es ist dieselbe Seite.
 *
 * ── Warum nicht die Stellenseite aufrufen ─────────────────────
 *
 * Weil sie tausend Zeilen Filter, Blättern und Auswahl mitbringt, von
 * denen hier nichts gebraucht wird. Was gebraucht wird, ist die
 * Rechnung — und die steht in `listJobsForUser` und
 * `zeilenAusStellen`, beide von hier und dort aufrufbar.
 *
 * ── Was diese Funktion NICHT tut ──────────────────────────────
 *
 * Sie filtert nicht nach eingetippten Bedingungen. Es ist eine
 * Vorschau, kein Suchergebnis: die besten Treffer nach dem Profil.
 * Wer filtern will, geht auf die Stellenseite — dafür ist sie da.
 */

/** Anzeigenamen der Vertragsarten — dieselben wie in der Liste. */
const CONTRACT: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  internship: "Praktikum",
  working_student: "Werkstudium",
  apprenticeship: "Ausbildung",
  freelance: "Freiberuflich",
  temp_agency: "Zeitarbeit",
};

/**
 * Wie viele Stellen die Vorschau zeigt.
 *
 * Fünf. Genug, um zu sehen, dass etwas da ist und von welcher Art;
 * zu wenig, um sie hier durchzuarbeiten. Wer mehr will, scrollt
 * weiter — und landet auf der Stellenseite, wo alles steht.
 */
export const VORSCHAU_ANZAHL = 5;

export async function vorschauZeilen(userId: string): Promise<JobRowData[]> {
  const db = await getDb();

  const [ctx, saved, wohnzeile] = await Promise.all([
    loadProfileContext(userId),
    withUser(db, userId, (tx) =>
      tx
        .select({ jobId: schema.savedJobs.jobId })
        .from(schema.savedJobs)
        .where(eq(schema.savedJobs.userId, userId)),
    ).catch(() => [] as { jobId: string }[]),
    withUser(db, userId, (tx) =>
      tx
        .select({ baseLocation: schema.userSettings.baseLocation })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, userId))
        .limit(1),
    ).catch(() => [] as { baseLocation: string | null }[]),
  ]);

  const { jobs } = await listJobsForUser(userId, ctx, {
    sort: "best_overall",
    sichtbar: VORSCHAU_ANZAHL,
    limit: VORSCHAU_ANZAHL,
  });

  const stellen = jobs.slice(0, VORSCHAU_ANZAHL);
  if (stellen.length === 0) return [];

  /*
   * Der Wohnort in Koordinaten — für Entfernung und Fahrzeit an jeder
   * Zeile. `ambiguous` zählt ausdrücklich nicht: Ein falscher
   * Mittelpunkt verschiebt nicht eine Anzeige, sondern alle.
   */
  const wohnpunkt = wohnzeile[0]?.baseLocation
    ? await ortNachschlagen(db, wohnzeile[0].baseLocation)
        .then((a) =>
          (a.status === "resolved_exact" || a.status === "resolved_city") &&
          a.latitude !== null &&
          a.longitude !== null
            ? { latitude: a.latitude, longitude: a.longitude }
            : null,
        )
        .catch(() => null)
    : null;

  /* Referenzgehälter nur für die Stellen, die selbst keines nennen. */
  const ohneGehalt = stellen.filter((j) => !j.job.salary);
  const [nachKldb, nachTitel] = await Promise.all([
    referenzenFuerKldb(ohneGehalt.map((j) => j.job.kldb)).catch(() => new Map()),
    referenzenFuerTitel(ohneGehalt.map((j) => j.job.title)).catch(() => new Map()),
  ]);

  return zeilenAusStellen(stellen, {
    wohnpunkt,
    fortbewegung: ctx.constraints.commuteMode ?? null,
    savedIds: new Set(saved.map((s) => s.jobId)),
    nachKldb,
    nachTitel,
    vertragsarten: CONTRACT,
  });
}
