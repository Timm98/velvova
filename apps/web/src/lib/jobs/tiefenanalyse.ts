import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Mondays tiefe Analyse einer Stelle — starten, lesen, fortschreiben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie lange dauern darf
 * ══════════════════════════════════════════════════════════════
 *
 * Die schnelle Einschätzung auf der Seite entsteht aus Zahlen, die
 * ohnehin dastehen — kein Modellaufruf, sofort da, und deshalb
 * knapp. Sie beantwortet „passt das ungefähr".
 *
 * Die tiefe Analyse beantwortet „was heisst das für mich". Dafür muss
 * die Anzeige gelesen, gegen das Profil gehalten und in Sätze gebracht
 * werden, die eine Person tatsächlich weiterbringen. Das sind mehrere
 * Modellrunden.
 *
 * Beides nebeneinander zu haben ist Absicht: Die schnelle Auskunft
 * darf nie auf die langsame warten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Zustand in der Datenbank steht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Ergebnis im Speicher der Seite wäre beim ersten Wechsel weg, und
 * die Person startete dieselbe teure Arbeit erneut. Mit `zustand`
 * lässt sich ausserdem „läuft noch" von „ist fehlgeschlagen"
 * unterscheiden — ohne das sähe beides aus wie „gibt es nicht".
 */

export type Zustand = "laeuft" | "fertig" | "fehlgeschlagen";

export type Tiefenanalyse = {
  zustand: Zustand;
  inhalt: string | null;
  fehler: string | null;
  begonnenAm: Date;
  beendetAm: Date | null;
};

/**
 * Ab wann eine laufende Analyse als steckengeblieben gilt.
 *
 * Ohne diese Grenze bliebe eine Analyse, deren Prozess gestorben ist,
 * für immer auf „läuft" stehen — und die Person bekäme nie wieder
 * einen Knopf zum Neustarten. Zehn Minuten sind grosszügig gegenüber
 * „ein paar Minuten" und trotzdem endlich.
 */
export const STECKENGEBLIEBEN_MS = 10 * 60 * 1000;

export async function analyseLesen(
  userId: string,
  jobId: string,
): Promise<Tiefenanalyse | null> {
  const db = await getDb();
  const [zeile] = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.jobTiefenanalysen)
      .where(
        and(
          eq(schema.jobTiefenanalysen.userId, userId),
          eq(schema.jobTiefenanalysen.jobId, jobId),
        ),
      )
      .limit(1),
  );
  if (!zeile) return null;

  /*
   * Eine zu lange laufende Analyse wird als gescheitert gemeldet.
   *
   * Nicht in der Datenbank umgeschrieben, sondern beim Lesen gedeutet:
   * Wenn der Prozess doch noch antwortet, soll sein Ergebnis zählen.
   * Ein Schreibvorgang hier würde es verwerfen.
   */
  const laeuftZuLange =
    zeile.zustand === "laeuft" &&
    Date.now() - zeile.begonnenAm.getTime() > STECKENGEBLIEBEN_MS;

  return {
    zustand: laeuftZuLange ? "fehlgeschlagen" : (zeile.zustand as Zustand),
    inhalt: zeile.inhalt,
    fehler: laeuftZuLange
      ? "Die Analyse hat zu lange gebraucht. Du kannst sie neu starten."
      : zeile.fehler,
    begonnenAm: zeile.begonnenAm,
    beendetAm: zeile.beendetAm,
  };
}

/**
 * Eine Analyse anlegen oder neu starten.
 *
 * Gibt `false` zurück, wenn bereits eine läuft. Der Aufrufer soll das
 * unterscheiden können: Ein zweiter Start derselben Arbeit ist kein
 * Fehler, aber auch kein Grund, sie noch einmal zu bezahlen.
 */
export async function analyseStarten(userId: string, jobId: string): Promise<boolean> {
  const vorhanden = await analyseLesen(userId, jobId);
  if (vorhanden?.zustand === "laeuft") return false;

  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .insert(schema.jobTiefenanalysen)
      .values({ userId, jobId, zustand: "laeuft", inhalt: null, fehler: null })
      .onConflictDoUpdate({
        target: [schema.jobTiefenanalysen.userId, schema.jobTiefenanalysen.jobId],
        set: {
          zustand: "laeuft",
          inhalt: null,
          fehler: null,
          begonnenAm: new Date(),
          beendetAm: null,
        },
      }),
  );
  return true;
}

/** Das Ergebnis festhalten. */
export async function analyseAbschliessen(
  userId: string,
  jobId: string,
  ergebnis: { inhalt: string; logikfassung: string } | { fehler: string },
): Promise<void> {
  const db = await getDb();
  const fertig = "inhalt" in ergebnis;
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.jobTiefenanalysen)
      .set({
        zustand: fertig ? "fertig" : "fehlgeschlagen",
        inhalt: fertig ? ergebnis.inhalt : null,
        /*
         * Der Fehlertext ist für die Person, nicht für das Protokoll.
         *
         * „ECONNRESET" sagt ihr nichts und klingt nach ihrer Schuld.
         * Der Aufrufer übersetzt; hier wird nur abgelegt, was er
         * übergibt.
         */
        fehler: fertig ? null : ergebnis.fehler,
        logikfassung: fertig ? ergebnis.logikfassung : null,
        beendetAm: new Date(),
      })
      .where(
        and(
          eq(schema.jobTiefenanalysen.userId, userId),
          eq(schema.jobTiefenanalysen.jobId, jobId),
        ),
      ),
  );
}
