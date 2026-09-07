import { and, desc, eq, gte } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { HANDLUNGEN } from "@paycheck/matching";

/**
 * Warum hat Monday das gemacht?
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Antworten auf dieselbe Frage
 * ══════════════════════════════════════════════════════════════
 *
 * Die Person bekommt einen Satz: „Du hast diese Stelle mehrfach
 * geöffnet." Das genügt ihr, und mehr will sie nicht wissen.
 *
 * Wer den Fehler sucht, braucht etwas anderes: welche Ereignisse,
 * welche Berechtigung, welche Regelfassung, was dabei herauskam, ob
 * geredet wurde und wenn nein, warum nicht.
 *
 * Beides aus derselben Zeile zu lesen ist der Punkt: Es gibt keine
 * zweite Aufzeichnung, die von der ersten abweichen könnte.
 *
 * ══════════════════════════════════════════════════════════════
 * Nur für innen
 * ══════════════════════════════════════════════════════════════
 *
 * Diese Ausgabe gehört in ein Terminal oder ein Betriebswerkzeug,
 * nicht in die Anwendung. Sie nennt Ereigniskennungen und
 * Regelnamen — für die Person wäre das keine Erklärung, sondern ein
 * Beleg dafür, dass hier etwas über sie geführt wird, das sie nicht
 * versteht.
 */

export interface Pruefzeile {
  handlung: string;
  klasse: string;
  beschreibung: string;
  jobId: string | null;
  jobTitel: string | null;
  /* Was der Anlass war. */
  ausloeser: string;
  belege: string[];
  /* Ob die Person diese Automatik erlaubt hat. */
  berechtigung: string;
  policyFassung: string;
  ergebnis: string;
  /* Ob geredet wurde — und wenn nicht, warum. */
  kommunikation: "gesagt" | "still" | "wartet";
  grund: string | null;
  zustand: string;
  erstelltAm: Date;
  gezeigtAm: Date | null;
}

/**
 * Die Prüfspur der letzten Handlungen.
 *
 * ── Warum die Berechtigung aus dem heutigen Stand kommt ───────
 *
 * Weil die Frage lautet „darf sie das", nicht „durfte sie das".
 * Wurde eine Automatik seither abgeschaltet, ist genau das die
 * interessante Auskunft — dann steht hier ein Eintrag, den es heute
 * nicht mehr gäbe.
 */
export async function pruefspur(
  db: Database,
  userId: string,
  optionen: { seit?: Date; grenze?: number } = {},
): Promise<Pruefzeile[]> {
  const seit = optionen.seit ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const grenze = Math.min(optionen.grenze ?? 30, 200);

  return withUser(db, userId, async (tx) => {
    const [einstellung] = await tx
      .select({ abgeschaltet: schema.ninaEigeninitiative.abgeschaltet })
      .from(schema.ninaEigeninitiative)
      .where(eq(schema.ninaEigeninitiative.userId, userId))
      .limit(1);
    const abgeschaltet = new Set(einstellung?.abgeschaltet ?? []);

    const zeilen = await tx
      .select({
        handlung: schema.ninaHandlungen.handlung,
        klasse: schema.ninaHandlungen.klasse,
        jobId: schema.ninaHandlungen.jobId,
        begruendung: schema.ninaHandlungen.begruendung,
        belege: schema.ninaHandlungen.belegEreignisse,
        policyFassung: schema.ninaHandlungen.policyFassung,
        ergebnis: schema.ninaHandlungen.ergebnis,
        nachricht: schema.ninaHandlungen.nachricht,
        zustand: schema.ninaHandlungen.zustand,
        erstelltAm: schema.ninaHandlungen.erstelltAm,
        gezeigtAm: schema.ninaHandlungen.gezeigtAm,
        jobTitel: schema.jobs.title,
      })
      .from(schema.ninaHandlungen)
      .leftJoin(schema.jobs, eq(schema.jobs.id, schema.ninaHandlungen.jobId))
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          gte(schema.ninaHandlungen.erstelltAm, seit),
        ),
      )
      .orderBy(desc(schema.ninaHandlungen.erstelltAm))
      .limit(grenze);

    return zeilen.map((z) => ({
      handlung: z.handlung,
      klasse: z.klasse,
      beschreibung: HANDLUNGEN[z.handlung]?.beschreibung ?? "(nicht in der Regeltabelle)",
      jobId: z.jobId,
      jobTitel: z.jobTitel,
      ausloeser: z.begruendung,
      belege: z.belege,
      berechtigung: abgeschaltet.has(z.handlung) ? "seither abgeschaltet" : "erlaubt",
      policyFassung: z.policyFassung,
      ergebnis: ergebnisWort(z.handlung, z.ergebnis),
      kommunikation:
        z.nachricht === null ? ("still" as const)
        : z.gezeigtAm === null ? ("wartet" as const)
        : ("gesagt" as const),
      grund:
        z.nachricht === null
          ? "gebündelt oder nicht mitteilenswert"
          : z.gezeigtAm === null
            ? "noch nicht abgerufen"
            : null,
      zustand: z.zustand,
      erstelltAm: z.erstelltAm,
      gezeigtAm: z.gezeigtAm,
    }));
  });
}

/**
 * Was dabei herauskam, in einem Wort.
 *
 * ── Warum „ohne Wirkung“ ausdrücklich dasteht ─────────────────
 *
 * Sechs Handlungen sind in der Regeltabelle angelegt und tun noch
 * nichts. Sie sollen nicht entstehen — und falls doch, muss man es
 * hier sehen können, statt einen Eintrag zu lesen, der wie eine
 * erledigte Aufgabe aussieht.
 */
function ergebnisWort(handlung: string, ergebnis: unknown): string {
  const e = ergebnis as { fragen?: unknown[]; vergleich?: { jobIds?: unknown[] } } | null;
  if (e?.vergleich) return `Vergleich über ${e.vergleich.jobIds?.length ?? 0} Stellen`;
  if (e?.fragen) return `${e.fragen.length} offene Fragen`;
  if (handlung === "job_vormerken") return "Vormerkung angelegt";
  if (handlung === "hypothese_merken") return "Vermutung notiert, Profil unverändert";
  if (WIRKUNGSLOS.has(handlung)) return "OHNE WIRKUNG — sollte nicht entstanden sein";
  return "—";
}

/**
 * Handlungen, die in der Regeltabelle stehen und noch nichts tun.
 *
 * Sie sind bewusst nicht gebaut: Erst müssen die vier Kernhandlungen
 * tragen. Ein Eintrag von ihnen wäre eine Zeile in „Von Monday
 * vorbereitet", hinter der nichts steht — und genau das soll die
 * Prüfspur zeigen, statt es zu verbergen.
 */
export const WIRKUNGSLOS = new Set([
  "job_zu_klaeren",
  "aehnliche_gruppieren",
  "geschlossene_ausblenden",
  "aenderung_hervorheben",
  "analyse_vorbereiten",
  "ausschluss_herabstufen",
]);

/** Die Prüfspur als Text — für ein Terminal. */
export function pruefspurAlsText(zeilen: readonly Pruefzeile[]): string {
  if (zeilen.length === 0) return "Keine Handlungen im Zeitraum.";
  return zeilen
    .map((z) =>
      [
        `HANDLUNG      ${z.handlung}  [${z.klasse}]`,
        z.jobTitel ? `STELLE        ${z.jobTitel.slice(0, 60)}` : null,
        `ANLASS        ${z.ausloeser}`,
        `BELEGE        ${z.belege.length > 0 ? z.belege.join(", ") : "keine"}`,
        `BERECHTIGUNG  ${z.berechtigung}`,
        `REGELFASSUNG  ${z.policyFassung}`,
        `ERGEBNIS      ${z.ergebnis}`,
        `KOMMUNIKATION ${z.kommunikation}${z.grund ? ` — ${z.grund}` : ""}`,
        `ZUSTAND       ${z.zustand}`,
      ]
        .filter((x) => x !== null)
        .join("\n"),
    )
    .join("\n\n");
}
