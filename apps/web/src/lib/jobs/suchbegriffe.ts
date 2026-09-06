import { and, isNull } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { suchrichtungen } from "@paycheck/matching";
import { UserConstraintsSchema, type EvidenceItem } from "@paycheck/domain";

/**
 * Wonach der nächste Abruf tatsächlich suchen soll.
 *
 * ── Die stille Verengung ──────────────────────────────────────
 *
 * Die Bundesagentur wurde bis hierher mit fünf fest eingetragenen
 * Begriffen befragt: Sachbearbeitung, Kundenbetreuung, Disposition,
 * Büromanagement, Vertriebsinnendienst. Eine vernünftige
 * Grundausstattung — aber der Bestand wuchs damit in genau fünf
 * Richtungen.
 *
 * Wer in eine sechste wollte, fand dort nichts. Nicht weil es nichts
 * gibt, sondern weil nie jemand danach gefragt hatte. Und weil die
 * Jobseite anschliessend ehrlich meldete „1.428 Stellen geprüft", sah
 * das Ergebnis nach gründlicher Suche aus.
 *
 * Der Adapter konnte es die ganze Zeit: `abfragen` steht seit jeher in
 * seinem Konstruktor, und der Kommentar dort nennt ausdrücklich „die
 * Suchrichtungen aus ihrem Profil". Übergeben hat sie nur niemand.
 *
 * ── Warum über alle Profile und nicht je Person ───────────────
 *
 * Weil der Abruf den gemeinsamen Bestand füllt, nicht die Liste einer
 * einzelnen Person. Je Nutzer bei jedem Anbieter anzufragen hiesse:
 * Nutzerzahl × Richtungen × Anbieter Anfragen je Lauf — Kosten, die
 * mit der Nutzerzahl multiplizieren, für Stellen, die anschliessend
 * ohnehin allen zur Verfügung stehen.
 *
 * Stattdessen: einmal fragen, wonach die Menschen im System suchen,
 * und den Bestand dorthin wachsen lassen. Die Zuordnung zur einzelnen
 * Person passiert danach beim Abgleich, wo sie hingehört.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Kein Sprachmodell. Die Richtungen kommen aus
 * `packages/matching/src/suchrichtungen.ts`, einem überprüfbaren
 * Katalog: Jede Richtung nennt die Aussagen, die zu ihr geführt haben.
 * Ein Modell, das aus Lebensläufen Berufsbezeichnungen erfindet, würde
 * hier Suchbegriffe erzeugen, für die niemand Rechenschaft ablegen
 * kann — und die Stellen kämen trotzdem als echte Treffer zurück.
 */

/**
 * Wie viele Begriffe höchstens.
 *
 * Jeder Begriff ist bei der Bundesagentur eine eigene Anfrage, und der
 * Adapter teilt sein Limit durch ihre Anzahl: doppelt so viele Begriffe
 * heissen halb so viele Treffer je Begriff. Zwölf ist der Punkt, an dem
 * beides noch trägt — mehr Breite als die bisherigen fünf, ohne dass
 * die einzelne Richtung zu dünn wird.
 */
const HOECHSTENS = 12;

/**
 * Ab wann eine Richtung zählt.
 *
 * `suchrichtungen()` liefert auch schwache Treffer. Eine Richtung, die
 * bei einer einzigen Person schwach angeschlagen hat, soll den
 * gemeinsamen Bestand nicht mitbestimmen — sie steht dieser Person
 * weiterhin auf ihrer Jobseite, wo sie hingehört.
 */
const MINDESTSTAERKE = 0.35;

export interface Begriffsherkunft {
  begriff: string;
  /** Bei wie vielen Konten diese Richtung aufgetaucht ist. */
  konten: number;
  /** Summe der Stärken — trennt „oft schwach" von „selten deutlich". */
  gewicht: number;
}

/**
 * Die Begriffe für den nächsten Abruf, mit ihrer Herkunft.
 *
 * Die Herkunft kommt mit zurück, damit der Abrufbericht sie nennen
 * kann. Ein Lauf, der ohne Begründung andere Begriffe verwendet als
 * beim letzten Mal, ist nicht nachvollziehbar.
 */
export async function suchbegriffeAusProfilen(): Promise<Begriffsherkunft[]> {
  const db = await getDb();

  /*
   * Bewusst ohne `withUser`.
   *
   * Diese Abfrage überschreitet absichtlich die Grenze eines einzelnen
   * Kontos — sie soll ja gerade wissen, wonach die Menschen im System
   * insgesamt suchen. Was sie herausgibt, sind Berufsbezeichnungen wie
   * „Disposition", keine personenbezogenen Aussagen: Die Belegtexte
   * bleiben in dieser Funktion und verlassen sie nicht.
   */
  const zeilen = await db
    .select({
      userId: schema.evidenceItems.userId,
      statement: schema.evidenceItems.statement,
      confidence: schema.evidenceItems.confidence,
      userConfirmed: schema.evidenceItems.userConfirmed,
      userRejected: schema.evidenceItems.userRejected,
    })
    .from(schema.evidenceItems)
    .where(and(isNull(schema.evidenceItems.deletedAt)));

  const proKonto = new Map<string, EvidenceItem[]>();
  for (const z of zeilen) {
    if (z.userRejected) continue;
    const liste = proKonto.get(z.userId) ?? [];
    liste.push({
      statement: z.statement,
      confidence: z.confidence,
      userConfirmed: z.userConfirmed,
      userRejected: z.userRejected,
    } as EvidenceItem);
    proKonto.set(z.userId, liste);
  }

  /*
   * Leere Bedingungen für alle.
   *
   * Die Suchrichtungen entstehen hier aus dem, was jemand über seine
   * Arbeit gesagt hat — nicht aus Gehalt, Ort oder Vertragsart. Die
   * echten Bedingungen jedes Kontos zusätzlich zu laden wäre eine
   * Abfrage je Person für Werte, die auf das Ergebnis keinen Einfluss
   * haben.
   */
  const ohneBedingungen = UserConstraintsSchema.parse({
    minSalaryPerYear: null,
    baseLocation: null,
    maxCommuteMinutes: null,
    weeklyHoursMin: null,
    weeklyHoursMax: null,
    maxTravelPercent: null,
  });

  const gesammelt = new Map<string, Begriffsherkunft>();
  for (const [, evidence] of proKonto) {
    const richtungen = suchrichtungen({
      evidence,
      energisingTasks: [],
      drainingTasks: [],
      statedInterests: [],
      constraints: ohneBedingungen,
    });
    for (const r of richtungen) {
      if (r.staerke < MINDESTSTAERKE) continue;
      const bisher = gesammelt.get(r.begriff) ?? { begriff: r.begriff, konten: 0, gewicht: 0 };
      bisher.konten += 1;
      bisher.gewicht += r.staerke;
      gesammelt.set(r.begriff, bisher);
    }
  }

  /*
   * Nach Gewicht, nicht nach Häufigkeit.
   *
   * Eine Richtung, die bei drei Personen deutlich angeschlagen hat,
   * sagt mehr über den gebrauchten Bestand als eine, die bei zehn
   * gerade so die Schwelle überschritten hat.
   */
  return [...gesammelt.values()].sort((a, b) => b.gewicht - a.gewicht).slice(0, HOECHSTENS);
}
