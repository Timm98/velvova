import { and, count, eq, gte, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { isStale, listJobsForUser, loadProfileContext } from "@/lib/matching";

/**
 * Was Monday für jemanden getan hat, während er nicht hingesehen hat.
 *
 * Der Bereich existiert nur für Max — nicht als Belohnung, sondern
 * weil nur dort tatsächlich etwas im Hintergrund passiert. Ihn für
 * Free anzuzeigen und leer zu lassen wäre eine Werbefläche mit
 * Nullen darin.
 *
 * Die Regel für jede Zeile hier: **sie muss aus echten Daten kommen.**
 * Keine erfundenen Zahlen, keine geschätzten „ungefähr", keine Zeile,
 * die immer dasteht. Was Monday nicht belegen kann, sagt sie nicht — und
 * wenn nichts passiert ist, steht hier, dass nichts passiert ist. Das
 * ist eine gültige Auskunft und die einzige ehrliche.
 */

export interface Agentenzeile {
  /** Die Zahl. Steht gross. */
  anzahl: number;
  /** Was sie bedeutet, als ganzer Satzteil. */
  text: string;
  /** Wohin es geht, wenn jemand darauf klickt. */
  href: string;
}

export interface Agentenstand {
  zeilen: Agentenzeile[];
  /** Seit wann gerechnet wird. Für den kleinen Hinweis darunter. */
  seit: Date;
}

/** Wie weit zurück „neu" reicht. Sieben Tage, nicht „seit deinem letzten
 *  Besuch" — letzteres wäre eine Zahl, die sich beim zweiten Hinsehen
 *  ändert, und das liest sich wie ein Fehler. */
const FENSTER_TAGE = 7;

export async function agentenstand(userId: string): Promise<Agentenstand> {
  const seit = new Date(Date.now() - FENSTER_TAGE * 24 * 60 * 60 * 1000);
  const db = await getDb();

  const [offeneErinnerungen, neueTreffer] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select({ n: count() })
        .from(schema.reminders)
        .where(and(eq(schema.reminders.userId, userId), isNull(schema.reminders.completedAt))),
    ).catch(() => [{ n: 0 }]),

    /*
     * Neue Stellen mit guter Passung.
     *
     * Über dieselbe Bewertung wie die Jobliste — nicht über eine
     * zweite, die „ungefähr dasselbe" macht. Zwei Rechenwege für eine
     * Zahl heisst: irgendwann sagen sie Verschiedenes, und niemand
     * weiss, welcher stimmt.
     */
    (async () => {
      try {
        const ctx = await loadProfileContext(userId);
        const { jobs } = await listJobsForUser(userId, ctx, { sort: "best_overall" });
        const frisch = jobs.filter(
          (j) =>
            j.job.publishedAt !== null &&
            j.job.publishedAt.getTime() >= seit.getTime() &&
            !isStale(j.job),
        );
        return {
          neu: frisch.length,
          // „Aussergewöhnlich gut" ist hier eine Zahl, keine Stimmung:
          // die Schwelle für ein hohes Passungsband.
          sehrGut: frisch.filter((j) => j.fit.band === "high").length,
        };
      } catch {
        return { neu: 0, sehrGut: 0 };
      }
    })(),
  ]);

  const [veraltet] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select({ n: count() })
        .from(schema.savedJobs)
        .where(and(eq(schema.savedJobs.userId, userId), gte(schema.savedJobs.createdAt, seit))),
    ).catch(() => [{ n: 0 }]),
  ]);

  const zeilen: Agentenzeile[] = [];

  if (neueTreffer.neu > 0) {
    zeilen.push({
      anzahl: neueTreffer.neu,
      text: neueTreffer.neu === 1 ? "neue passende Stelle" : "neue passende Stellen",
      href: "/app/jobs?sort=newest",
    });
  }
  if (neueTreffer.sehrGut > 0) {
    zeilen.push({
      anzahl: neueTreffer.sehrGut,
      text: neueTreffer.sehrGut === 1 ? "passt besonders gut" : "passen besonders gut",
      href: "/app/jobs",
    });
  }
  if ((offeneErinnerungen[0]?.n ?? 0) > 0) {
    const n = offeneErinnerungen[0]!.n;
    zeilen.push({
      anzahl: n,
      text: n === 1 ? "Bewerbung braucht Nachfassen" : "Bewerbungen brauchen Nachfassen",
      href: "/app/applications",
    });
  }
  if ((veraltet[0]?.n ?? 0) > 0) {
    const n = veraltet[0]!.n;
    zeilen.push({
      anzahl: n,
      text: n === 1 ? "Stelle neu gespeichert" : "Stellen neu gespeichert",
      href: "/app/jobs?saved=1",
    });
  }

  return { zeilen, seit };
}
