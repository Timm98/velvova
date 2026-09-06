import { and, eq, isNull } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { UserConstraintsSchema, type EvidenceItem, type UserConstraints } from "@paycheck/domain";
import { wirksameKonfidenz, type Belegquelle, type Bewertungsprofil } from "@paycheck/matching";

/**
 * Das Profil einer Person laden — für Liste und Hintergrunddienst.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das aus der Webschicht hierher gewandert ist
 * ══════════════════════════════════════════════════════════════
 *
 * Dieselbe Überlegung wie bei `stelleBewerten`: Der Hintergrunddienst
 * kommt an `apps/web` nicht heran, und eine zweite Fassung dieser
 * Abfrage hiesse, dass die Mail auf einem anderen Profil rechnet als
 * die Liste. Der Unterschied fiele niemandem auf, bis jemand fragt,
 * warum eine Stelle in der Mail steht und in der Liste nicht.
 *
 * ── Was hier bewusst fehlt ────────────────────────────────────
 *
 * Die Sitzungsschicht („nur für diese Suche"). Sie kommt aus einem
 * Keks und gilt für einen Browser, nicht für einen Auftrag. Der
 * Hintergrunddienst hat keine Sitzung, und eine gespeicherte
 * Ausnahme, die dauerhaft weiterwirkt, wäre keine Ausnahme mehr.
 *
 * Die Webschicht legt sie nach dem Laden selbst darüber.
 */

export const LEERE_BEDINGUNGEN: UserConstraints = UserConstraintsSchema.parse({
  minSalaryPerYear: null,
  baseLocation: null,
  maxCommuteMinutes: null,
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  maxTravelPercent: null,
});

export interface Profilkontext extends Bewertungsprofil {
  profileConfirmed: boolean;
}

/**
 * Eine Belegzeile als Beleg — mit gedeckelter Konfidenz.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der gespeicherte Wert hier nicht durchgereicht wird
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 6. September 2026 an 486 Belegen von 96 Menschen:
 *
 *   ai_hypothesis · constraint   44 Belege   Konfidenz 0.90
 *   user_stated   · motive       78 Belege   Konfidenz 0.82
 *
 * Ninas Vermutungen trugen mehr Gewicht als das, was die Menschen
 * selbst gesagt haben. Wer diese Zahlen ungeprüft in den Fit rechnet,
 * lässt das System die Person in ihrer eigenen Sache überstimmen.
 *
 * Der Deckel greift beim Lesen, nicht beim Schreiben: Die gespeicherte
 * Zahl dokumentiert, was das Modell damals meinte. Sie zu überschreiben
 * hiesse, die Geschichte zu ändern; sie ungedeckelt zu benutzen hiesse,
 * ihr zu glauben.
 */
export function zeileZuBeleg(row: typeof schema.evidenceItems.$inferSelect): EvidenceItem {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    statement: row.statement,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    confidence: wirksameKonfidenz({
      quelle: row.sourceType as Belegquelle,
      konfidenz: row.confidence,
      bestaetigt: row.userConfirmed,
      abgelehnt: row.userRejected,
    }),
    userConfirmed: row.userConfirmed,
    userRejected: row.userRejected,
    sensitivityLevel: row.sensitivityLevel,
    retentionClass: row.retentionClass,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export async function profilkontextLaden(db: Database, userId: string): Promise<Profilkontext> {
  return withUser(db, userId, async (tx) => {
    /*
     * Drei unabhängige Abfragen gleichzeitig. Gegen Supabase ist jedes
     * `await` ein eigener Netzweg von rund 44 Millisekunden.
     */
    const [bedingungszeilen, belegzeilen, profilzeilen] = await Promise.all([
      tx.select().from(schema.userConstraints).where(eq(schema.userConstraints.userId, userId)).limit(1),
      tx
        .select()
        .from(schema.evidenceItems)
        .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt))),
      tx.select().from(schema.careerProfiles).where(eq(schema.careerProfiles.userId, userId)).limit(1),
    ]);

    const belege = belegzeilen.map(zeileZuBeleg);
    const lebendig = belege.filter((e) => !e.userRejected);
    const nachRef = (nadel: string) =>
      lebendig.filter((e) => e.sourceRef?.includes(nadel)).map((e) => e.statement);

    const energie = lebendig
      .filter((e) => e.type === "preference" && /energie gibt|geben energie|leicht/i.test(e.statement))
      .map((e) => e.statement);
    const zehrend = lebendig
      .filter((e) => e.type === "preference" && /kostet|laugt|vermeide|falsch an/i.test(e.statement))
      .map((e) => e.statement);

    let bedingungen = LEERE_BEDINGUNGEN;
    const roh = bedingungszeilen[0]?.data;
    if (roh) {
      const geprueft = UserConstraintsSchema.safeParse(roh);
      /* Ein ungültiger Datensatz darf Bedingungen nicht stillschweigend
         wegfallen lassen. Lieber die leere, sichere Fassung. */
      if (geprueft.success) bedingungen = geprueft.data;
    }

    return {
      constraints: bedingungen,
      evidence: belege,
      energisingTasks: energie.length > 0 ? energie : nachRef("tasks_and_energy"),
      drainingTasks: zehrend,
      workStylePreferences: nachRef("work_style_and_environment"),
      rankedValues: nachRef("values_and_motives"),
      statedInterests: nachRef("learning_goals"),
      profileConfirmed: profilzeilen[0]?.confirmedByUser ?? false,
      coverage: profilzeilen[0]?.coverage ?? 0,
    };
  });
}
