import { and, asc, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Die Vorhaben eines Menschen für die Seitenleiste.
 *
 * Nur die offenen. Ein abgeschlossenes Vorhaben ist nicht gelöscht —
 * es steht nur nicht mehr im Weg, und wer es sucht, findet es über
 * die Übersicht.
 *
 * ── Warum das den Fehler schluckt ───────────────────────────────
 *
 * Die Seitenleiste steht auf jeder Seite des Arbeitsbereichs. Wenn
 * die Tabelle noch nicht existiert — die Migration läuft nicht beim
 * Deploy —, darf das nicht die ganze Anwendung mitnehmen. Ohne
 * Projekte zeichnet die Leiste den Abschnitt einfach nicht.
 */
export async function projekteFuerLeiste(
  userId: string,
): Promise<{ id: string; titel: string; href: string }[]> {
  try {
    const db = await getDb();
    const zeilen = await withUser(db, userId, (tx) =>
      tx
        .select({ id: schema.projekte.id, name: schema.projekte.name })
        .from(schema.projekte)
        .where(
          and(
            eq(schema.projekte.userId, userId),
            eq(schema.projekte.status, "aktiv"),
          ),
        )
        .orderBy(asc(schema.projekte.ordnung), asc(schema.projekte.name)),
    );
    return zeilen.map((z) => ({
      id: z.id,
      titel: z.name,
      href: `/app/projekte/${z.id}`,
    }));
  } catch {
    /* Siehe oben: kein Abschnitt ist besser als keine Anwendung. */
    return [];
  }
}

/* ══════════════════════════════════════════════════════════════════
   Ein einzelnes Vorhaben mit allem, was daran hängt
   ══════════════════════════════════════════════════════════════════ */

export interface Projektansicht {
  id: string;
  name: string;
  ziel: string | null;
  status: string;
  angelegtAm: Date;
  stellen: { id: string; jobId: string; titel: string; firma: string }[];
  bewerbungen: { id: string; jobId: string; titel: string; firma: string; stand: string }[];
  gespraeche: number;
}

/**
 * Ein Vorhaben laden — oder `null`.
 *
 * `null` deckt zwei Fälle ab, die absichtlich nicht unterschieden
 * werden: „gibt es nicht" und „gehört jemand anderem". Wer eine
 * Kennung rät, soll aus der Antwort nicht schliessen können, ob sie
 * existiert.
 */
export async function projektLaden(
  userId: string,
  projektId: string,
): Promise<Projektansicht | null> {
  try {
    return await projektLesen(userId, projektId);
  } catch (fehler) {
    /*
     * Fehlt die Tabelle, gibt es das Vorhaben nicht.
     *
     * Die Migration läuft nicht beim Deploy. Zwischen dem Ausrollen
     * des Codes und dem Ausführen der Migration existiert `projekte`
     * nicht, und eine geworfene Abfrage würde daraus eine 500 machen
     * — für eine Seite, die man nur über einen Link erreicht, den es
     * ohne Daten gar nicht gibt.
     *
     * Protokolliert wird trotzdem: Ein verschluckter Fehler, den
     * niemand sieht, ist der nächste stille.
     */
    console.warn("[projekte] konnte nicht geladen werden:", (fehler as Error).message);
    return null;
  }
}

async function projektLesen(
  userId: string,
  projektId: string,
): Promise<Projektansicht | null> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [projekt] = await tx
      .select({
        id: schema.projekte.id,
        name: schema.projekte.name,
        ziel: schema.projekte.ziel,
        status: schema.projekte.status,
        createdAt: schema.projekte.createdAt,
      })
      .from(schema.projekte)
      .where(and(eq(schema.projekte.id, projektId), eq(schema.projekte.userId, userId)))
      .limit(1);

    if (!projekt) return null;

    /*
     * Die Unterfunktionen, die sich im Vorhaben aufbauen: erst die
     * gemerkten Stellen, dann die Bewerbungen daraus.
     */
    const [stellen, bewerbungen, gespraeche] = await Promise.all([
      tx
        .select({
          id: schema.savedJobs.id,
          jobId: schema.jobs.id,
          titel: schema.jobs.title,
          firma: schema.companies.name,
        })
        .from(schema.savedJobs)
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.savedJobs.jobId))
        .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
        .where(and(eq(schema.savedJobs.userId, userId), eq(schema.savedJobs.projektId, projektId))),
      tx
        .select({
          id: schema.applications.id,
          jobId: schema.jobs.id,
          titel: schema.jobs.title,
          firma: schema.companies.name,
          stand: schema.applications.stage,
        })
        .from(schema.applications)
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
        .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
        .where(
          and(
            eq(schema.applications.userId, userId),
            eq(schema.applications.projektId, projektId),
          ),
        ),
      tx
        .select({ id: schema.ninaConversations.id })
        .from(schema.ninaConversations)
        .where(
          and(
            eq(schema.ninaConversations.userId, userId),
            eq(schema.ninaConversations.projektId, projektId),
          ),
        ),
    ]);

    return {
      id: projekt.id,
      name: projekt.name,
      ziel: projekt.ziel,
      status: projekt.status,
      angelegtAm: projekt.createdAt,
      stellen,
      bewerbungen,
      gespraeche: gespraeche.length,
    };
  });
}
