import { getDb, schema, withSystem, withUser } from "@paycheck/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { zufriedenheitsSpalte } from "@paycheck/domain";

/**
 * Der Outcome Loop: hat unsere Empfehlung getaugt?
 *
 * ── Warum das der wichtigste Teil ist ─────────────────────────
 *
 * Ein Passungswert ist eine Behauptung über die Zukunft. Ob sie stimmt,
 * zeigt sich Monate später — an Vorstellungsgesprächen, Angeboten und
 * daran, ob jemand nach einem halben Jahr noch zufrieden ist.
 *
 * Ohne Aufzeichnung lernt das System aus Klicks. Klicks messen, was
 * jemand interessant FAND, nicht was ihm gutgetan hat. Der Unterschied
 * ist der ganze Punkt: Eine Stelle, die viele anklicken und niemand
 * behält, sähe nach einem Erfolg aus.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Es wird nichts an einen Arbeitgeber gemeldet. Die Zufriedenheit aus
 * den Check-ins bleibt beim Menschen; für die Auswertung zählt nur die
 * Zahl, und die verlässt die eigene Zeile nie einzeln — `bilanz()`
 * schweigt unterhalb einer Stichprobe, die niemanden erkennbar macht.
 */

/*
 * Ab wann eine Auswertung überhaupt etwas sagt.
 *
 * Dieselbe Haltung wie in `funnel.ts`: Aus drei Bewerbungen lässt sich
 * kein Muster lesen. Der Wert ist bewusst hoch — eine Quote aus fünf
 * Fällen schwankt um dreissig Prozentpunkte, wenn ein einziger Fall
 * anders ausgeht, und sähe trotzdem nach einer Zahl aus.
 */
export const MIN_FUER_AUSSAGE = 20;

/**
 * Friert die Vorhersage ein — beim ersten entscheidenden Ereignis.
 *
 * Kopiert aus `job_matches`, wo der aktuelle Wert ohnehin steht. Neu zu
 * rechnen wäre nicht nur teurer, sondern falsch: Festzuhalten ist, was
 * dem Menschen gezeigt WURDE, nicht was jetzt herauskäme.
 *
 * `onConflictDoNothing` ist hier keine Bequemlichkeit, sondern die ganze
 * Absicht: Steht die Zeile schon, bleibt sie. Eine spätere
 * Neuberechnung darf die damals gezeigte Zahl nicht ersetzen.
 *
 * Ohne Eintrag in `job_matches` passiert nichts — dann hat diese Person
 * für diese Stelle nie einen Wert gesehen, und es gibt nichts
 * einzufrieren.
 */
export async function vorhersageFesthalten(
  userId: string,
  jobId: string,
  applicationId?: string | null,
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, async (tx) => {
    const [m] = await tx
      .select()
      .from(schema.jobMatches)
      .where(and(eq(schema.jobMatches.userId, userId), eq(schema.jobMatches.jobId, jobId)))
      .limit(1);
    if (!m) return;

    await tx
      .insert(schema.empfehlungsErgebnisse)
      .values({
        userId,
        jobId,
        applicationId: applicationId ?? null,
        fitScore: m.fitScore,
        fitBand: m.fitBand,
        fitCoverage: m.fitCoverage,
        confidenceScore: m.confidenceScore,
        constraintVerdict: m.constraintVerdict,
        overallScore: m.overallScore,
        topReason: m.topReason,
        topReservation: m.topReservation,
        scoringVersion: m.scoringVersion,
        /* Das Datum der Bewertung, nicht das von heute — sonst sähe
           jede Vorhersage aus, als wäre sie im Moment der Bewerbung
           entstanden. */
        vorhergesagtAm: m.computedAt,
      })
      .onConflictDoNothing({
        target: [schema.empfehlungsErgebnisse.userId, schema.empfehlungsErgebnisse.jobId],
      });
  }).catch((e) => {
    /*
     * Ein Fehler hier darf die Bewerbung nicht aufhalten.
     *
     * Die Aufzeichnung ist wichtig, aber sie ist nicht das, weswegen
     * jemand auf den Knopf gedrückt hat.
     */
    console.error("[ergebnisse] Vorhersage nicht festgehalten:", e);
  });
}

/** Welches Ereignis welche Spalte füllt. */
const SPALTE = {
  application_sent: "beworbenAm",
  response_received: "antwortAm",
  acknowledged: "antwortAm",
  interview_scheduled: "interviewAm",
  interview_held: "interviewAm",
  offer_received: "angebotAm",
  accepted: "angenommenAm",
  rejected: "abgelehntAm",
} as const;

/**
 * Trägt ein eingetroffenes Ergebnis nach.
 *
 * Nur, wenn die Spalte noch leer ist: Das erste Vorstellungsgespräch
 * ist die Auskunft, das dritte verschiebt nur das Datum.
 */
export async function ergebnisVermerken(
  userId: string,
  jobId: string,
  ereignis: keyof typeof SPALTE,
  wann = new Date(),
): Promise<void> {
  const spalte = SPALTE[ereignis];
  if (!spalte) return;
  const db = await getDb();
  const feld = schema.empfehlungsErgebnisse[spalte];
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.empfehlungsErgebnisse)
      .set({ [spalte]: wann, aktualisiertAm: new Date() })
      .where(
        and(
          eq(schema.empfehlungsErgebnisse.userId, userId),
          eq(schema.empfehlungsErgebnisse.jobId, jobId),
          sql`${feld} is null`,
        ),
      ),
  ).catch((e) => console.error("[ergebnisse] Ergebnis nicht vermerkt:", e));
}

/** Die Zufriedenheit aus einem Check-in nachtragen. */
export async function zufriedenheitVermerken(
  userId: string,
  jobId: string,
  tagesmarke: number,
  wert: number,
): Promise<void> {
  const spalte = zufriedenheitsSpalte(tagesmarke);
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.empfehlungsErgebnisse)
      .set({ [spalte]: wert, aktualisiertAm: new Date() })
      .where(
        and(
          eq(schema.empfehlungsErgebnisse.userId, userId),
          eq(schema.empfehlungsErgebnisse.jobId, jobId),
        ),
      ),
  ).catch((e) => console.error("[ergebnisse] Zufriedenheit nicht vermerkt:", e));
}

export interface BandBilanz {
  band: string;
  beworben: number;
  interview: number;
  angebot: number;
  angenommen: number;
  /** Anteile, aber nur wenn die Stichprobe sie trägt. */
  interviewQuote: number | null;
  angebotQuote: number | null;
  /** Mittlere Zufriedenheit nach 90 Tagen, 1..5. `null` heisst: zu wenige Antworten. */
  zufriedenheit: number | null;
}

export interface Bilanz {
  baender: BandBilanz[];
  gesamt: number;
  /** true, wenn überhaupt eine Aussage getragen wird. */
  tragfaehig: boolean;
  /** Was diese Zahlen NICHT zeigen. Steht immer dabei. */
  grenzen: string;
}

/**
 * Was aus den Empfehlungen wurde, je Passungsband.
 *
 * ── Warum das die eigentliche Auswertung ist ──────────────────
 *
 * Wenn „passt gut" und „passt kaum" zu denselben Quoten führen, sagt
 * unsere Passung nichts — und dann ist das die wichtigste Erkenntnis,
 * die dieses Produkt haben kann. Sie steht nirgends sonst.
 *
 * ── Warum das Schweigen wichtiger ist als die Zahl ────────────
 *
 * Unterhalb von `MIN_FUER_AUSSAGE` Fällen je Band wird keine Quote
 * ausgegeben. Eine Interviewquote aus vier Bewerbungen springt um 25
 * Prozentpunkte, sobald eine einzige anders ausgeht.
 */
export async function bilanz(): Promise<Bilanz> {
  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx
      .select({
        band: schema.empfehlungsErgebnisse.fitBand,
        beworben: sql<number>`count(*) filter (where beworben_am is not null)`,
        interview: sql<number>`count(*) filter (where interview_am is not null)`,
        angebot: sql<number>`count(*) filter (where angebot_am is not null)`,
        angenommen: sql<number>`count(*) filter (where angenommen_am is not null)`,
        zufrieden: sql<number | null>`avg(zufriedenheit_90)`,
        zufriedenAnzahl: sql<number>`count(zufriedenheit_90)`,
      })
      .from(schema.empfehlungsErgebnisse)
      .where(isNotNull(schema.empfehlungsErgebnisse.beworbenAm))
      .groupBy(schema.empfehlungsErgebnisse.fitBand),
  ).catch(() => []);

  const baender: BandBilanz[] = zeilen.map((z) => {
    const beworben = Number(z.beworben);
    const genug = beworben >= MIN_FUER_AUSSAGE;
    return {
      band: String(z.band),
      beworben,
      interview: Number(z.interview),
      angebot: Number(z.angebot),
      angenommen: Number(z.angenommen),
      interviewQuote: genug ? Number(z.interview) / beworben : null,
      angebotQuote: genug ? Number(z.angebot) / beworben : null,
      zufriedenheit:
        Number(z.zufriedenAnzahl) >= MIN_FUER_AUSSAGE && z.zufrieden !== null
          ? Number(z.zufrieden)
          : null,
    };
  });

  const gesamt = baender.reduce((a, b) => a + b.beworben, 0);
  return {
    baender: baender.sort((a, b) => b.beworben - a.beworben),
    gesamt,
    tragfaehig: baender.some((b) => b.interviewQuote !== null),
    grenzen:
      "Die Zahlen zeigen, was auf eine Empfehlung folgte — nicht, dass die Empfehlung es bewirkt hat. " +
      "Wer sich auf gut passende Stellen bewirbt, bewirbt sich meist auch sorgfältiger. " +
      `Unterhalb von ${MIN_FUER_AUSSAGE} Bewerbungen je Band steht bewusst keine Quote.`,
  };
}
